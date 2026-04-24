import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_IMAGE_QUALITY,
  PagesContext,
  base64ToBytes,
  envValue,
  extractGeminiImage,
  json,
  parseApiError,
  rateLimitGuard,
  sameOriginGuard,
} from "./_shared";

const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const readPayload = async (request: Request) =>
  (await request.json().catch(() => null)) as
    | {
        prompt?: string;
        mode?: "fast" | "premium";
      }
    | null;

const imageResponse = ({
  bytes,
  mimeType,
  provider,
  model,
  mode,
}: {
  bytes: ArrayBuffer;
  mimeType: string;
  provider: string;
  model: string;
  mode: "fast" | "premium";
}) =>
  new Response(bytes, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "no-store",
      "X-AI-Provider": provider,
      "X-AI-Model": model,
      "X-AI-Mode": mode,
      "X-AI-Message": `${provider === "openai" ? "OpenAI" : "Gemini"} scene art generated successfully.`,
    },
  });

const generateOpenAIImage = async ({
  apiKey,
  model,
  quality,
  prompt,
}: {
  apiKey: string;
  model: string;
  quality: string;
  prompt: string;
}) => {
  const response = await fetch(OPENAI_IMAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1536x1024",
      quality,
    }),
  });

  if (!response.ok) {
    return {
      ok: false as const,
      message: await parseApiError(response, "OpenAI scene art generation failed."),
    };
  }

  const payload = (await response.json()) as {
    data?: Array<{
      b64_json?: string;
      url?: string;
    }>;
  };
  const image = payload.data?.[0];

  if (image?.b64_json) {
    return {
      ok: true as const,
      bytes: base64ToBytes(image.b64_json),
      mimeType: "image/png",
    };
  }

  if (image?.url) {
    const imageDownload = await fetch(image.url);
    if (imageDownload.ok) {
      return {
        ok: true as const,
        bytes: await imageDownload.arrayBuffer(),
        mimeType: imageDownload.headers.get("Content-Type") ?? "image/png",
      };
    }
  }

  return {
    ok: false as const,
    message: "OpenAI responded without image data.",
  };
};

const generateGeminiImage = async ({
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
        responseModalities: ["Image"],
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "2K",
        },
      },
    }),
  });

  if (!response.ok) {
    return {
      ok: false as const,
      message: await parseApiError(response, "Gemini scene art generation failed."),
    };
  }

  const imagePart = extractGeminiImage(await response.json());
  if (!imagePart?.data || !imagePart.mimeType) {
    return {
      ok: false as const,
      message: "Gemini responded without image data.",
    };
  }

  return {
    ok: true as const,
    bytes: base64ToBytes(imagePart.data),
    mimeType: imagePart.mimeType,
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
    scope: "scene-image",
    limit: 12,
    windowSeconds: 3600,
  });
  if (limited) {
    return limited;
  }

  const payload = await readPayload(request);
  const prompt = payload?.prompt?.trim();
  const mode = payload?.mode === "fast" ? "fast" : "premium";

  if (!prompt) {
    return json({ ok: false, message: "Missing scene art prompt." }, 400);
  }

  if (prompt.length > 6_000) {
    return json({ ok: false, message: "Scene art prompt is too large." }, 413);
  }

  const openAIKey = env.OPENAI_API_KEY?.trim();
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const openAIModel = envValue(env.OPENAI_IMAGE_MODEL, DEFAULT_OPENAI_IMAGE_MODEL);
  const openAIQuality = envValue(env.OPENAI_IMAGE_QUALITY, DEFAULT_OPENAI_IMAGE_QUALITY);
  const geminiModel = envValue(env.GEMINI_IMAGE_MODEL, DEFAULT_GEMINI_IMAGE_MODEL);
  let fallbackMessage = "Production AI scene art is not configured yet.";
  const providerOrder =
    mode === "fast" ? (["gemini", "openai"] as const) : (["openai", "gemini"] as const);

  for (const provider of providerOrder) {
    if (provider === "openai" && openAIKey) {
      const result = await generateOpenAIImage({
        apiKey: openAIKey,
        model: openAIModel,
        quality: openAIQuality,
        prompt,
      });

      if (result.ok) {
        return imageResponse({
          bytes: result.bytes,
          mimeType: result.mimeType,
          provider: "openai",
          model: openAIModel,
          mode,
        });
      }

      fallbackMessage = result.message;
    }

    if (provider === "gemini" && geminiKey) {
      const result = await generateGeminiImage({
        apiKey: geminiKey,
        model: geminiModel,
        prompt,
      });

      if (result.ok) {
        return imageResponse({
          bytes: result.bytes,
          mimeType: result.mimeType,
          provider: "gemini",
          model: geminiModel,
          mode,
        });
      }

      fallbackMessage = result.message;
    }
  }

  return json({ ok: false, message: fallbackMessage }, openAIKey || geminiKey ? 502 : 503);
}
