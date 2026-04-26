import { GameState, NarrativeSystemId } from "./types";

export const SERVER_AI_KEY = "__convergence_server_ai__";

const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;
const GEMINI_IMAGE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";
const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = "marin";
const SERVER_AI_STATUS_ENDPOINT = "/api/ai/status";
const SERVER_AI_NARRATIVE_ENDPOINT = "/api/ai/narrative";
const SERVER_AI_SCENE_IMAGE_ENDPOINT = "/api/ai/scene-image";
const SERVER_AI_TTS_ENDPOINT = "/api/ai/tts";
const SERVER_AI_CINEMATIC_SUBMIT_ENDPOINT = "/api/ai/cinematic/submit";
const SERVER_AI_CINEMATIC_STATUS_ENDPOINT = "/api/ai/cinematic/status";
const SERVER_AI_CINEMATIC_RESULT_ENDPOINT = "/api/ai/cinematic/result";

type AIProviderName = "openai" | "gemini" | "fal";

export interface AIProviderConfig {
  available: boolean;
  provider: AIProviderName | null;
  model: string | null;
}

export interface AIProviderStatus {
  ok: boolean;
  providers: {
    openai: boolean;
    gemini: boolean;
    fal?: boolean;
  };
  narrative: AIProviderConfig;
  sceneArt: AIProviderConfig;
  voice: AIProviderConfig;
  cinematic?: AIProviderConfig;
  message: string;
}

const SYSTEM_PROMPTS: Record<NarrativeSystemId, string> = {
  "world-news":
    "You write terse, high-signal AI industry news in a Reuters meets Wired voice. Keep it grounded, specific, and aware of geopolitical context. When referencing money, always format it as USD with scale markers like $8M, $250K, or $1.2B. Never use bare numerals for money.",
  "rival-labs":
    "You roleplay rival AI lab CEOs choosing strategic moves. Be competitive, realistic, and consistent with prior decisions. Output one concise move summary. When referencing money, always format it as USD with scale markers like $8M, $250K, or $1.2B. Never use bare numerals for money.",
  discovery:
    "You narrate research breakthroughs for a strategy game. Make them vivid, specific, and slightly ominous without becoming purple prose. When referencing money, always format it as USD with scale markers like $8M, $250K, or $1.2B. Never use bare numerals for money.",
  "dilemma-writer":
    "You write strategy game context notes for an existing dilemma. You must stay faithful to the supplied title, brief, and exact option labels. Do not invent new options or contradict the listed choices. Frame the stakes so the available options feel like natural responses. When referencing money, always format it as USD with scale markers like $8M, $250K, or $1.2B. Never use bare numerals for money.",
  "chief-of-staff":
    "You write internal chief-of-staff briefings for an AI lab CEO. Sound crisp, candid, and strategically literate. When referencing money, always format it as USD with scale markers like $8M, $250K, or $1.2B. Never use bare numerals for money.",
};

const formatMoney = (value: number) => {
  const absolute = Math.abs(value);

  if (absolute >= 1000) {
    return `${value < 0 ? "-" : ""}$${(absolute / 1000).toFixed(1)}B`;
  }

  if (absolute >= 1) {
    return `${value < 0 ? "-" : ""}$${absolute.toFixed(1)}M`;
  }

  return `${value < 0 ? "-" : ""}$${Math.round(absolute * 1000)}K`;
};

const MONEY_VALUE_PATTERN = "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)";

const normalizeNarrativeMoney = (text: string) => {
  const formatToken = (raw: string) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? formatMoney(parsed) : raw;
  };

  const nounFirst = new RegExp(
    `\\b((?:capital(?:\\s+infusion)?|cash|funding|grant|contract|deal|offer|payment|price|cost|spend|expense|expenses|burn|budget|payroll|salary|bonus|upkeep|revenue(?:\\s+(?:per|a)\\s+(?:turn|quarter))?(?:\\s+boost)?|profit)(?:\\s+(?:of|worth|for|at|near))?\\s*)(${MONEY_VALUE_PATTERN})(?![%\\dA-Za-z])`,
    "gi",
  );
  const valueFirst = new RegExp(
    `\\b(${MONEY_VALUE_PATTERN})(?=\\s+(?:in\\s+)?(?:capital|cash|funding|grant|contract|revenue(?:\\s+per\\s+(?:turn|quarter))?|expenses?|burn|budget|payroll|salary|bonus|upkeep|profit)\\b)`,
    "gi",
  );

  return text
    .replace(nounFirst, (_match, prefix: string, value: string) => `${prefix}${formatToken(value)}`)
    .replace(valueFirst, (value: string) => formatToken(value));
};

const stableHash = (value: unknown) => {
  const json = JSON.stringify(value);
  let hash = 0;

  for (let index = 0; index < json.length; index += 1) {
    hash = (hash << 5) - hash + json.charCodeAt(index);
    hash |= 0;
  }

  return String(hash);
};

const extractText = (payload: unknown) => {
  const response = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? null;
};

const extractImagePart = (payload: unknown) => {
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

  return (
    response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData ?? null
  );
};

const isServerAIKey = (apiKey: string) => apiKey.trim() === SERVER_AI_KEY;

const parseServerError = async (response: Response, fallback: string) => {
  try {
    const json = (await response.json()) as {
      message?: string;
      error?: {
        message?: string;
      };
    };

    return json.message ?? json.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchAIStatus = async () => {
  try {
    const response = await fetch(SERVER_AI_STATUS_ENDPOINT, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AIProviderStatus;
  } catch {
    return null;
  }
};

export const buildNarrativePrompt = (
  system: NarrativeSystemId,
  state: GameState,
  context: string,
) => {
  const formattedState = {
    turn: state.turn,
    year: state.year,
    quarter: state.quarterIndex + 1,
    resources: {
      capital: formatMoney(state.resources.capital),
      revenuePerQuarter: formatMoney(state.resources.revenue),
      burnPerQuarter: formatMoney(state.resources.burn),
      runwayMonths: state.resources.runwayMonths,
      computeCapacityPf: state.resources.computeCapacity,
      trust: state.resources.trust,
      fear: state.resources.fear,
      boardConfidence: state.resources.boardConfidence,
      reputation: state.resources.reputation,
      wealth: formatMoney(state.resources.wealth),
      expenses: Object.fromEntries(
        Object.entries(state.resources.expenses).map(([label, amount]) => [label, formatMoney(amount)]),
      ),
    },
    tracks: Object.fromEntries(
      Object.entries(state.tracks).map(([trackId, track]) => [
        trackId,
        { level: track.level, progress: track.progress, unlocked: track.unlocked },
      ]),
    ),
    rivals: Object.fromEntries(
      Object.entries(state.rivals).map(([rivalId, rival]) => [
        rivalId,
        {
          capability: rival.capability,
          safety: rival.safety,
          goodwill: rival.goodwill,
          focus: rival.focus,
        },
      ]),
    ),
    flags: state.flags,
    note: "All money values are USD. Values at or above 1.0 are millions. Values below 1.0 are thousands.",
  };

  return {
    system,
    prompt: `${SYSTEM_PROMPTS[system]}\n\nContext:\n${context}\n\nState summary:\n${JSON.stringify(
      formattedState,
      null,
      2,
    )}\n\nRespond with plain text only.`,
  };
};

export const fetchGeminiNarrative = async (
  state: GameState,
  system: NarrativeSystemId,
  context: string,
) => {
  const apiKey = state.aiSettings.apiKey.trim();

  if (!state.aiSettings.enabled || !apiKey) {
    return null;
  }

  const payload = buildNarrativePrompt(system, state, context);
  const cacheKey = `${system}:${stableHash(payload)}`;
  const cached = state.aiSettings.cache[cacheKey];

  if (cached) {
    return { cacheKey, text: cached };
  }

  if (isServerAIKey(apiKey)) {
    const response = await fetch(SERVER_AI_NARRATIVE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      text?: string;
    };

    return json.text ? { cacheKey, text: normalizeNarrativeMoney(json.text) } : null;
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: payload.prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as unknown;
  const text = extractText(json);

  if (!text) {
    return null;
  }

  return { cacheKey, text: normalizeNarrativeMoney(text) };
};

export const validateGeminiKey = async (apiKey: string) => {
  if (!apiKey.trim()) {
    return {
      ok: false,
      message: "Enter a Gemini API key first.",
    };
  }

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey.trim())}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Return only the word OK.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      let message = "Gemini rejected the key.";

      try {
        const json = (await response.json()) as {
          error?: {
            message?: string;
          };
        };
        message = json.error?.message ?? message;
      } catch {
        // Keep the default message when the response body is not parseable.
      }

      return {
        ok: false,
        message,
      };
    }

    const json = (await response.json()) as unknown;
    const text = extractText(json);

    return {
      ok: Boolean(text),
      message: text ? "Gemini connection verified." : "Gemini responded without text.",
    };
  } catch {
    return {
      ok: false,
      message: "Unable to reach Gemini. Check the key and network connection.",
    };
  }
};

export const generateGeminiSceneImage = async ({
  apiKey,
  prompt,
  mode = "premium",
}: {
  apiKey: string;
  prompt: string;
  mode?: "fast" | "premium";
}) => {
  const trimmedKey = apiKey.trim();

  if (!trimmedKey) {
    return {
      ok: false as const,
      message: "Activate AI scene art first.",
      blob: null as Blob | null,
    };
  }

  if (isServerAIKey(trimmedKey)) {
    try {
      const response = await fetch(SERVER_AI_SCENE_IMAGE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, mode }),
      });

      if (!response.ok) {
        return {
          ok: false as const,
          message: await parseServerError(response, "AI scene art generation failed."),
          blob: null as Blob | null,
        };
      }

      const blob = await response.blob();
      if (!blob.size) {
        return {
          ok: false as const,
          message: "AI scene art returned an empty image.",
          blob: null as Blob | null,
        };
      }

      return {
        ok: true as const,
        message: response.headers.get("X-AI-Message") ?? "AI scene art generated successfully.",
        blob,
      };
    } catch {
      return {
        ok: false as const,
        message: "Unable to reach production AI scene art right now.",
        blob: null as Blob | null,
      };
    }
  }

  try {
    const response = await fetch(`${GEMINI_IMAGE_ENDPOINT}?key=${encodeURIComponent(trimmedKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      }),
    });

    if (!response.ok) {
      let message = "Gemini image generation failed.";

      try {
        const json = (await response.json()) as {
          error?: {
            message?: string;
          };
        };
        message = json.error?.message ?? message;
      } catch {
        // Use the fallback message if the body cannot be parsed.
      }

      return {
        ok: false as const,
        message,
        blob: null as Blob | null,
      };
    }

    const json = (await response.json()) as unknown;
    const imagePart = extractImagePart(json);
    if (!imagePart?.data || !imagePart.mimeType) {
      return {
        ok: false as const,
        message: "Gemini responded without an image.",
        blob: null as Blob | null,
      };
    }

    const binary = Uint8Array.from(atob(imagePart.data), (character) => character.charCodeAt(0));
    const blob = new Blob([binary], { type: imagePart.mimeType });

    return {
      ok: true as const,
      message: "Gemini scene art generated successfully.",
      blob,
    };
  } catch {
    return {
      ok: false as const,
      message: "Unable to reach Gemini image generation right now.",
      blob: null as Blob | null,
    };
  }
};

const parseOpenAIError = async (response: Response) => {
  try {
    const json = (await response.json()) as {
      error?: {
        message?: string;
      };
    };

    return json.error?.message ?? "OpenAI rejected the request.";
  } catch {
    return "OpenAI rejected the request.";
  }
};

export const synthesizeOpenAITts = async ({
  apiKey,
  text,
  instructions,
}: {
  apiKey: string;
  text: string;
  instructions?: string;
}) => {
  const trimmedKey = apiKey.trim();

  if (isServerAIKey(trimmedKey)) {
    const response = await fetch(SERVER_AI_TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        instructions,
      }),
    });

    if (!response.ok) {
      return {
        ok: false as const,
        message: await parseServerError(response, "OpenAI voice generation failed."),
        blob: null,
      };
    }

    const blob = await response.blob();
    if (!blob.size) {
      return {
        ok: false as const,
        message: "OpenAI returned an empty audio file.",
        blob: null,
      };
    }

    return {
      ok: true as const,
      message: response.headers.get("X-AI-Message") ?? "OpenAI TTS generated audio successfully.",
      blob,
    };
  }

  const response = await fetch(OPENAI_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${trimmedKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text,
      instructions,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    return {
      ok: false as const,
      message: await parseOpenAIError(response),
      blob: null,
    };
  }

  const blob = await response.blob();
  if (!blob.size) {
    return {
      ok: false as const,
      message: "OpenAI returned an empty audio file.",
      blob: null,
    };
  }

  return {
    ok: true as const,
    message: "OpenAI TTS generated audio successfully.",
    blob,
  };
};

export const validateOpenAITtsKey = async (apiKey: string) => {
  if (!apiKey.trim()) {
    return {
      ok: false,
      message: "Enter an OpenAI API key first.",
      blob: null as Blob | null,
    };
  }

  try {
    return await synthesizeOpenAITts({
      apiKey,
      text: "Convergence voice systems online.",
      instructions: "Read this like a calm mission-control system check.",
    });
  } catch {
    return {
      ok: false,
      message: "Unable to reach OpenAI. Check the key and network connection.",
      blob: null as Blob | null,
    };
  }
};

export interface CinematicSubmitResult {
  ok: boolean;
  message: string;
  requestId?: string;
  model?: string;
  mode?: "image-to-video" | "text-to-video";
}

export interface CinematicStatusResult {
  ok: boolean;
  status?: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "UNKNOWN" | string;
  queuePosition?: number;
  responseUrl?: string;
  logs?: string[];
  message: string;
}

export interface CinematicResult {
  ok: boolean;
  message: string;
  videoUrl?: string;
  contentType?: string;
}

export const submitCinematicVideo = async ({
  prompt,
  imageDataUri,
  duration = "5",
  resolution = "720p",
  aspectRatio = "16:9",
  generateAudio = false,
}: {
  prompt: string;
  imageDataUri?: string | null;
  duration?: "4" | "5" | "6" | "8" | "10" | "15";
  resolution?: "480p" | "720p" | "1080p";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  generateAudio?: boolean;
}): Promise<CinematicSubmitResult> => {
  const response = await fetch(SERVER_AI_CINEMATIC_SUBMIT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      imageDataUri,
      duration,
      resolution,
      aspectRatio,
      generateAudio,
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      message: await parseServerError(response, "Unable to submit cinematic render."),
    };
  }

  const payload = (await response.json()) as CinematicSubmitResult;
  return payload;
};

export const fetchCinematicStatus = async ({
  requestId,
  model,
}: {
  requestId: string;
  model: string;
}): Promise<CinematicStatusResult> => {
  const response = await fetch(
    `${SERVER_AI_CINEMATIC_STATUS_ENDPOINT}?requestId=${encodeURIComponent(requestId)}&model=${encodeURIComponent(model)}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return {
      ok: false,
      message: await parseServerError(response, "Unable to check cinematic status."),
    };
  }

  return (await response.json()) as CinematicStatusResult;
};

export const fetchCinematicResult = async ({
  requestId,
  model,
  resultUrl,
}: {
  requestId: string;
  model: string;
  resultUrl?: string;
}): Promise<CinematicResult> => {
  const params = new URLSearchParams({
    requestId,
    model,
  });
  if (resultUrl) {
    params.set("resultUrl", resultUrl);
  }

  const response = await fetch(
    `${SERVER_AI_CINEMATIC_RESULT_ENDPOINT}?${params.toString()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return {
      ok: false,
      message: await parseServerError(response, "Cinematic render is not ready yet."),
    };
  }

  return (await response.json()) as CinematicResult;
};
