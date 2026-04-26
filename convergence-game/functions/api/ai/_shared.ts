export interface AIEnv {
  OPENAI_API_KEY?: string;
  OPENAI_TEXT_MODEL?: string;
  OPENAI_IMAGE_MODEL?: string;
  OPENAI_IMAGE_QUALITY?: string;
  OPENAI_TTS_MODEL?: string;
  OPENAI_TTS_VOICE?: string;
  GEMINI_API_KEY?: string;
  GEMINI_TEXT_MODEL?: string;
  GEMINI_IMAGE_MODEL?: string;
  FAL_KEY?: string;
  FAL_VIDEO_MODEL?: string;
  AI_RATE_LIMITS?: KVNamespaceLike;
  CLOUD_SAVES?: KVNamespaceLike;
}

interface KVNamespaceLike {
  get<T = string>(
    key: string,
    options?: "text" | { type: "json" },
  ): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface PagesContext {
  request: Request;
  env: AIEnv;
}

export const DEFAULT_OPENAI_TEXT_MODEL = "gpt-5.4-mini";
export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_OPENAI_IMAGE_QUALITY = "high";
export const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
export const DEFAULT_OPENAI_TTS_VOICE = "marin";
export const DEFAULT_GEMINI_TEXT_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
export const DEFAULT_FAL_VIDEO_MODEL = "bytedance/seedance-2.0";

export const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export const configured = (value: string | undefined) => Boolean(value?.trim());

export const envValue = (value: string | undefined, fallback: string) => value?.trim() || fallback;

export const sameOriginGuard = (request: Request) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");

  if (origin) {
    try {
      if (new URL(origin).origin !== requestUrl.origin) {
        return json({ ok: false, message: "AI requests must come from the game site." }, 403);
      }
    } catch {
      return json({ ok: false, message: "Invalid request origin." }, 403);
    }
  }

  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) {
    return json({ ok: false, message: "AI requests must come from the game site." }, 403);
  }

  return null;
};

export const rateLimitGuard = async ({
  request,
  env,
  scope,
  limit,
  windowSeconds,
}: {
  request: Request;
  env: AIEnv;
  scope: string;
  limit: number;
  windowSeconds: number;
}) => {
  const storage = env.AI_RATE_LIMITS ?? env.CLOUD_SAVES;

  if (!storage) {
    return null;
  }

  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `ai-rate:${scope}:${bucket}:${ip}`;
  const current = Number((await storage.get(key)) ?? "0");

  if (current >= limit) {
    return json(
      {
        ok: false,
        message: "AI rate limit reached. Try again later.",
      },
      429,
    );
  }

  await storage.put(key, String(current + 1), {
    expirationTtl: windowSeconds * 2,
  });

  return null;
};

export const parseApiError = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as {
      message?: string;
      detail?: string | Array<{ msg?: string }>;
      error?: {
        message?: string;
      };
    };

    if (payload.message) return payload.message;
    if (payload.error?.message) return payload.error.message;
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail)) {
      const details = payload.detail.map((entry) => entry.msg).filter(Boolean);
      if (details.length) return details.join(" ");
    }

    return fallback;
  } catch {
    return fallback;
  }
};

export const base64ToBytes = (value: string): ArrayBuffer => {
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

export const extractGeminiText = (payload: unknown) => {
  const response = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? null;
};

export const extractGeminiImage = (payload: unknown) => {
  const response = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: {
            mimeType?: string;
            data?: string;
          };
        }>;
      };
    }>;
  };

  return response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData ?? null;
};

export const extractOpenAIText = (payload: unknown) => {
  const response = payload as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (response.output_text?.trim()) {
    return response.output_text.trim();
  }

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();

  return text || null;
};
