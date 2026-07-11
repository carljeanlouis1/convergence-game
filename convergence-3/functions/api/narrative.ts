// Cloudflare Pages Function: OpenRouter proxy for the AI narration layer.
// The key lives server-side (wrangler pages secret put OPENROUTER_API_KEY).
// GET  → { configured: boolean }
// POST { tier, system, prompt } → { text } — never throws game-breaking errors; clients fall back to authored copy.

interface Env {
  OPENROUTER_API_KEY?: string;
}

// minimal Pages Functions typing (avoids pulling workers-types into the app tsconfig)
type PagesFunction<E> = (ctx: { request: Request; env: E }) => Promise<Response>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const TIER_MODELS: Record<string, { model: string; maxTokens: number }> = {
  a: { model: "z-ai/glm-4.7-flash", maxTokens: 160 },
  b: { model: "moonshotai/kimi-k2.5", maxTokens: 420 },
  c: { model: "moonshotai/kimi-k2.6", maxTokens: 700 },
};

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true; // same-origin fetches may omit it
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export const onRequestGet: PagesFunction<Env> = async ctx => {
  return json({ configured: Boolean(ctx.env.OPENROUTER_API_KEY) });
};

export const onRequestPost: PagesFunction<Env> = async ctx => {
  if (!sameOrigin(ctx.request)) return json({ error: "forbidden" }, 403);
  const key = ctx.env.OPENROUTER_API_KEY;
  if (!key) return json({ configured: false, error: "not configured" }, 503);

  let body: { tier?: string; system?: string; prompt?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const tier = TIER_MODELS[body.tier ?? ""];
  if (!tier || typeof body.system !== "string" || typeof body.prompt !== "string") {
    return json({ error: "bad request" }, 400);
  }
  if (body.system.length > 6000 || body.prompt.length > 6000) {
    return json({ error: "too long" }, 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://convergence-3.pages.dev",
        "X-Title": "Convergence 3",
      },
      body: JSON.stringify({
        model: tier.model,
        max_tokens: tier.maxTokens,
        temperature: 0.8,
        // reasoning tokens silently eat the budget on GLM/Kimi thinking variants — force them off
        reasoning: { enabled: false },
        messages: [
          { role: "system", content: body.system },
          { role: "user", content: body.prompt },
        ],
      }),
    });
    if (!res.ok) return json({ error: `upstream ` }, 502);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return json({ error: "empty" }, 502);
    return json({ text });
  } catch {
    return json({ error: "timeout" }, 504);
  } finally {
    clearTimeout(timer);
  }
};
