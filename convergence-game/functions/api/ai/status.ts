import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_TEXT_MODEL,
  DEFAULT_OPENAI_TTS_MODEL,
  PagesContext,
  configured,
  envValue,
  json,
} from "./_shared";

export async function onRequestGet({ env }: PagesContext) {
  const hasOpenAI = configured(env.OPENAI_API_KEY);
  const hasGemini = configured(env.GEMINI_API_KEY);
  const openAITextModel = envValue(env.OPENAI_TEXT_MODEL, DEFAULT_OPENAI_TEXT_MODEL);
  const openAIImageModel = envValue(env.OPENAI_IMAGE_MODEL, DEFAULT_OPENAI_IMAGE_MODEL);
  const openAITtsModel = envValue(env.OPENAI_TTS_MODEL, DEFAULT_OPENAI_TTS_MODEL);
  const geminiTextModel = envValue(env.GEMINI_TEXT_MODEL, DEFAULT_GEMINI_TEXT_MODEL);
  const geminiImageModel = envValue(env.GEMINI_IMAGE_MODEL, DEFAULT_GEMINI_IMAGE_MODEL);

  return json({
    ok: true,
    providers: {
      openai: hasOpenAI,
      gemini: hasGemini,
    },
    narrative: {
      available: hasOpenAI || hasGemini,
      provider: hasOpenAI ? "openai" : hasGemini ? "gemini" : null,
      model: hasOpenAI ? openAITextModel : hasGemini ? geminiTextModel : null,
    },
    sceneArt: {
      available: hasOpenAI || hasGemini,
      provider: hasOpenAI ? "openai" : hasGemini ? "gemini" : null,
      model: hasOpenAI ? openAIImageModel : hasGemini ? geminiImageModel : null,
    },
    voice: {
      available: hasOpenAI,
      provider: hasOpenAI ? "openai" : null,
      model: hasOpenAI ? openAITtsModel : null,
    },
    message: hasOpenAI
      ? "Production AI is connected with OpenAI."
      : hasGemini
        ? "Production AI is connected with Gemini."
        : "Production AI secrets are not configured yet.",
  });
}
