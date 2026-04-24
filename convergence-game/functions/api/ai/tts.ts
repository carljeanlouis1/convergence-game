import {
  DEFAULT_OPENAI_TTS_MODEL,
  DEFAULT_OPENAI_TTS_VOICE,
  PagesContext,
  envValue,
  json,
  parseApiError,
  rateLimitGuard,
  sameOriginGuard,
} from "./_shared";

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

const readPayload = async (request: Request) =>
  (await request.json().catch(() => null)) as
    | {
        text?: string;
        instructions?: string;
        voice?: string;
      }
    | null;

export async function onRequestPost({ request, env }: PagesContext) {
  const blocked = sameOriginGuard(request);
  if (blocked) {
    return blocked;
  }

  const limited = await rateLimitGuard({
    request,
    env,
    scope: "tts",
    limit: 40,
    windowSeconds: 3600,
  });
  if (limited) {
    return limited;
  }

  const payload = await readPayload(request);
  const text = payload?.text?.trim();

  if (!text) {
    return json({ ok: false, message: "Missing narration text." }, 400);
  }

  if (text.length > 6_000) {
    return json({ ok: false, message: "Narration text is too long." }, 413);
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return json({ ok: false, message: "OpenAI voice is not configured yet." }, 503);
  }

  const model = envValue(env.OPENAI_TTS_MODEL, DEFAULT_OPENAI_TTS_MODEL);
  const envVoice = envValue(env.OPENAI_TTS_VOICE, DEFAULT_OPENAI_TTS_VOICE);
  const requestedVoice = payload?.voice?.trim();
  const voice = requestedVoice && ALLOWED_VOICES.has(requestedVoice) ? requestedVoice : envVoice;
  const response = await fetch(OPENAI_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      instructions: payload?.instructions?.trim() || undefined,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    return json(
      {
        ok: false,
        message: await parseApiError(response, "OpenAI voice generation failed."),
      },
      502,
    );
  }

  const audio = await response.arrayBuffer();
  if (!audio.byteLength) {
    return json({ ok: false, message: "OpenAI returned an empty audio file." }, 502);
  }

  return new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-AI-Provider": "openai",
      "X-AI-Model": model,
      "X-AI-Message": "OpenAI narration generated successfully.",
    },
  });
}
