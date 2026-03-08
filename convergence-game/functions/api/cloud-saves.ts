import { CloudSaveRecord, CloudSaveSlotId, CloudSaveSummary, GameSnapshot } from "../../lib/game/types";

interface KVNamespaceLike {
  get<T = string>(
    key: string,
    options?: "text" | { type: "json" },
  ): Promise<T | null>;
  put(key: string, value: string): Promise<void>;
}

interface Env {
  CLOUD_SAVES?: KVNamespaceLike;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const allowedSlots: CloudSaveSlotId[] = ["autosave", 1, 2, 3];

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const isValidCommanderId = (value: string) => /^[a-z0-9_-]{3,32}$/.test(value);
const isValidAuthToken = (value: string) => /^[a-f0-9]{64}$/.test(value);

const isValidSlot = (value: unknown): value is CloudSaveSlotId =>
  value === "autosave" || value === 1 || value === 2 || value === 3;

const saveKey = (commanderId: string, authToken: string, slot: CloudSaveSlotId) =>
  `v1:${commanderId}:${authToken}:${slot}`;

const summaryFromSnapshot = (slot: CloudSaveSlotId, snapshot: GameSnapshot): CloudSaveSummary => ({
  slot,
  title: snapshot.state.ending?.title ?? `${snapshot.state.ceo.title} Run`,
  subtitle: `${snapshot.state.year} Q${snapshot.state.quarterIndex + 1} Turn ${snapshot.state.turn}`,
  updatedAt: snapshot.savedAt,
});

const validateSnapshot = (snapshot: unknown): snapshot is GameSnapshot => {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  const candidate = snapshot as GameSnapshot;
  return Boolean(
    candidate.savedAt &&
      candidate.state &&
      typeof candidate.state.turn === "number" &&
      typeof candidate.state.year === "number" &&
      typeof candidate.state.quarterIndex === "number" &&
      typeof candidate.state.mode === "string",
  );
};

export async function onRequestPost({ request, env }: PagesContext) {
  if (!env.CLOUD_SAVES) {
    return json(
      {
        ok: false,
        message: "Cloud save storage is not bound for this deployment yet.",
      },
      503,
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        action?: "list" | "load" | "save";
        commanderId?: string;
        authToken?: string;
        slot?: unknown;
        snapshot?: unknown;
      }
    | null;

  if (!payload?.action || !payload.commanderId || !payload.authToken) {
    return json({ ok: false, message: "Missing cloud save credentials." }, 400);
  }

  if (!isValidCommanderId(payload.commanderId) || !isValidAuthToken(payload.authToken)) {
    return json({ ok: false, message: "Invalid cloud save credentials." }, 400);
  }

  const summaries = async () => {
    const results = await Promise.all(
      allowedSlots.map(async (slot) => {
        const record = await env.CLOUD_SAVES!.get<CloudSaveRecord>(
          saveKey(payload.commanderId!, payload.authToken!, slot),
          { type: "json" },
        );

        return record?.summary ?? null;
      }),
    );

    return results.filter((entry): entry is CloudSaveSummary => Boolean(entry));
  };

  if (payload.action === "list") {
    return json({
      ok: true,
      summaries: await summaries(),
    });
  }

  if (!isValidSlot(payload.slot)) {
    return json({ ok: false, message: "Invalid cloud save slot." }, 400);
  }

  const key = saveKey(payload.commanderId, payload.authToken, payload.slot);

  if (payload.action === "load") {
    const record = await env.CLOUD_SAVES.get<CloudSaveRecord>(key, { type: "json" });
    if (!record) {
      return json({ ok: false, message: "No cloud save found in that slot." }, 404);
    }

    return json({
      ok: true,
      record,
    });
  }

  if (!validateSnapshot(payload.snapshot)) {
    return json({ ok: false, message: "Invalid snapshot payload." }, 400);
  }

  const record: CloudSaveRecord = {
    summary: summaryFromSnapshot(payload.slot, payload.snapshot),
    snapshot: payload.snapshot,
  };

  const serialized = JSON.stringify(record);
  if (serialized.length > 24_000_000) {
    return json({ ok: false, message: "This save is too large for cloud storage." }, 413);
  }

  await env.CLOUD_SAVES.put(key, serialized);

  return json({
    ok: true,
    summary: record.summary,
    summaries: await summaries(),
  });
}
