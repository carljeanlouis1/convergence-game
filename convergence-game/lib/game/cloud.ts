"use client";

import { CloudCredentials, CloudSaveRecord, CloudSaveSlotId, CloudSaveSummary, GameSnapshot } from "./types";

const CLOUD_PROFILE_KEY = "convergence-cloud-profile";

const encoder = new TextEncoder();

const normalizeCommanderId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);

const digestHex = async (value: string) => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const deriveCloudCredentials = async (
  commanderId: string,
  passphrase: string,
): Promise<CloudCredentials> => {
  const normalizedCommanderId = normalizeCommanderId(commanderId);

  if (normalizedCommanderId.length < 3) {
    throw new Error("Use a commander ID with at least 3 letters or numbers.");
  }

  if (passphrase.trim().length < 8) {
    throw new Error("Use a cloud save passphrase with at least 8 characters.");
  }

  return {
    commanderId: normalizedCommanderId,
    authToken: await digestHex(`${normalizedCommanderId}:${passphrase.trim()}`),
  };
};

export const loadStoredCloudCredentials = (): CloudCredentials | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(CLOUD_PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CloudCredentials;
  } catch {
    return null;
  }
};

export const saveStoredCloudCredentials = (credentials: CloudCredentials) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CLOUD_PROFILE_KEY, JSON.stringify(credentials));
};

export const clearStoredCloudCredentials = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CLOUD_PROFILE_KEY);
};

const postCloudAction = async <T>(
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
  try {
    const response = await fetch("/api/cloud-saves", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          message?: string;
          summaries?: CloudSaveSummary[];
          record?: CloudSaveRecord;
        }
      | null;

    if (!response.ok || !json?.ok) {
      return {
        ok: false,
        message: json?.message ?? "Cloud save request failed.",
      };
    }

    return {
      ok: true,
      data: json as T,
    };
  } catch {
    return {
      ok: false,
      message: "Cloud save service is unavailable right now.",
    };
  }
};

export const listCloudSaves = async (credentials: CloudCredentials) => {
  const response = await postCloudAction<{ summaries: CloudSaveSummary[] }>({
    action: "list",
    ...credentials,
  });

  return response.ok
    ? { ok: true as const, summaries: response.data.summaries }
    : { ok: false as const, message: response.message, summaries: [] as CloudSaveSummary[] };
};

export const loadCloudSave = async (credentials: CloudCredentials, slot: CloudSaveSlotId) => {
  const response = await postCloudAction<{ record: CloudSaveRecord }>({
    action: "load",
    slot,
    ...credentials,
  });

  return response.ok
    ? { ok: true as const, record: response.data.record }
    : { ok: false as const, message: response.message, record: null as CloudSaveRecord | null };
};

export const saveCloudSnapshot = async (
  credentials: CloudCredentials,
  slot: CloudSaveSlotId,
  snapshot: GameSnapshot,
) => {
  const response = await postCloudAction<{ summary: CloudSaveSummary }>({
    action: "save",
    slot,
    snapshot,
    ...credentials,
  });

  return response.ok
    ? { ok: true as const, summary: response.data.summary }
    : { ok: false as const, message: response.message, summary: null as CloudSaveSummary | null };
};
