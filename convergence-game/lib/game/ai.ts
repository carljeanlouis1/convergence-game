import { GameState, NarrativeSystemId } from "./types";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPTS: Record<NarrativeSystemId, string> = {
  "world-news":
    "You write terse, high-signal AI industry news in a Reuters meets Wired voice. Keep it grounded, specific, and aware of geopolitical context.",
  "rival-labs":
    "You roleplay rival AI lab CEOs choosing strategic moves. Be competitive, realistic, and consistent with prior decisions. Output one concise move summary.",
  discovery:
    "You narrate research breakthroughs for a strategy game. Make them vivid, specific, and slightly ominous without becoming purple prose.",
  "dilemma-writer":
    "You write strategy game dilemmas where no option is cleanly correct. Include visible tradeoffs and avoid moralizing.",
  "chief-of-staff":
    "You write internal chief-of-staff briefings for an AI lab CEO. Sound crisp, candid, and strategically literate.",
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

export const buildNarrativePrompt = (
  system: NarrativeSystemId,
  state: GameState,
  context: string,
) => ({
  system,
  prompt: `${SYSTEM_PROMPTS[system]}\n\nContext:\n${context}\n\nState summary:\n${JSON.stringify(
    {
      turn: state.turn,
      year: state.year,
      quarter: state.quarterIndex + 1,
      resources: state.resources,
      tracks: Object.fromEntries(
        Object.entries(state.tracks).map(([trackId, track]) => [
          trackId,
          { level: track.level, progress: track.progress, unlocked: track.unlocked },
        ]),
      ),
      rivals: Object.fromEntries(
        Object.entries(state.rivals).map(([rivalId, rival]) => [
          rivalId,
          { capability: rival.capability, safety: rival.safety, focus: rival.focus },
        ]),
      ),
      flags: state.flags,
    },
    null,
    2,
  )}\n\nRespond with plain text only.`,
});

export const fetchGeminiNarrative = async (
  state: GameState,
  system: NarrativeSystemId,
  context: string,
) => {
  if (!state.aiSettings.enabled || !state.aiSettings.apiKey) {
    return null;
  }

  const payload = buildNarrativePrompt(system, state, context);
  const cacheKey = `${system}:${stableHash(payload)}`;
  const cached = state.aiSettings.cache[cacheKey];

  if (cached) {
    return { cacheKey, text: cached };
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(state.aiSettings.apiKey)}`, {
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

  return { cacheKey, text };
};
