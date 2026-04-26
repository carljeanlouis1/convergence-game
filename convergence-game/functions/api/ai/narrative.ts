import {
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_OPENAI_TEXT_MODEL,
  PagesContext,
  envValue,
  extractGeminiText,
  extractOpenAIText,
  json,
  parseApiError,
  rateLimitGuard,
  sameOriginGuard,
} from "./_shared";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const NARRATIVE_SYSTEMS = new Set([
  "world-news",
  "rival-labs",
  "discovery",
  "dilemma-writer",
  "chief-of-staff",
  "cinematic-director",
]);

const readPayload = async (request: Request) =>
  (await request.json().catch(() => null)) as
    | {
        system?: string;
        prompt?: string;
      }
    | null;

const generateOpenAINarrative = async ({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}) => {
  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 320,
      reasoning: {
        effort: "none",
      },
    }),
  });

  if (!response.ok) {
    return {
      ok: false as const,
      message: await parseApiError(response, "OpenAI narrative generation failed."),
    };
  }

  const text = extractOpenAIText(await response.json());
  if (!text) {
    return {
      ok: false as const,
      message: "OpenAI responded without narrative text.",
    };
  }

  return {
    ok: true as const,
    text,
  };
};

const generateGeminiNarrative = async ({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}) => {
  const response = await fetch(GEMINI_ENDPOINT(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 320,
        temperature: 0.75,
      },
    }),
  });

  if (!response.ok) {
    return {
      ok: false as const,
      message: await parseApiError(response, "Gemini narrative generation failed."),
    };
  }

  const text = extractGeminiText(await response.json());
  if (!text) {
    return {
      ok: false as const,
      message: "Gemini responded without narrative text.",
    };
  }

  return {
    ok: true as const,
    text,
  };
};

export async function onRequestPost({ request, env }: PagesContext) {
  const blocked = sameOriginGuard(request);
  if (blocked) {
    return blocked;
  }

  const limited = await rateLimitGuard({
    request,
    env,
    scope: "narrative",
    limit: 60,
    windowSeconds: 3600,
  });
  if (limited) {
    return limited;
  }

  const payload = await readPayload(request);
  const prompt = payload?.prompt?.trim();

  if (!payload?.system || !NARRATIVE_SYSTEMS.has(payload.system)) {
    return json({ ok: false, message: "Unknown narrative system." }, 400);
  }

  if (!prompt) {
    return json({ ok: false, message: "Missing narrative prompt." }, 400);
  }

  if (prompt.length > 16_000) {
    return json({ ok: false, message: "Narrative prompt is too large." }, 413);
  }

  const openAIKey = env.OPENAI_API_KEY?.trim();
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const openAIModel = envValue(env.OPENAI_TEXT_MODEL, DEFAULT_OPENAI_TEXT_MODEL);
  const geminiModel = envValue(env.GEMINI_TEXT_MODEL, DEFAULT_GEMINI_TEXT_MODEL);
  let fallbackMessage = "Production AI narrative is not configured yet.";

  if (openAIKey) {
    const result = await generateOpenAINarrative({
      apiKey: openAIKey,
      model: openAIModel,
      prompt,
    });

    if (result.ok) {
      return json({
        ok: true,
        text: result.text,
        provider: "openai",
        model: openAIModel,
      });
    }

    fallbackMessage = result.message;
  }

  if (geminiKey) {
    const result = await generateGeminiNarrative({
      apiKey: geminiKey,
      model: geminiModel,
      prompt,
    });

    if (result.ok) {
      return json({
        ok: true,
        text: result.text,
        provider: "gemini",
        model: geminiModel,
      });
    }

    fallbackMessage = result.message;
  }

  return json({ ok: false, message: fallbackMessage }, openAIKey || geminiKey ? 502 : 503);
}
