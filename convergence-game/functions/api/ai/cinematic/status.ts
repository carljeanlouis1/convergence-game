import {
  DEFAULT_FAL_VIDEO_MODEL,
  PagesContext,
  envValue,
  json,
  parseApiError,
  sameOriginGuard,
} from "../_shared";

const normalizeQueueModelPath = (model: string) =>
  model
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/(?:image-to-video|text-to-video)$/u, "");

export async function onRequestGet({ request, env }: PagesContext) {
  const blocked = sameOriginGuard(request);
  if (blocked) {
    return blocked;
  }

  const falKey = env.FAL_KEY?.trim();
  if (!falKey) {
    return json({ ok: false, message: "fal.ai video is not configured yet." }, 503);
  }

  const url = new URL(request.url);
  const requestId = url.searchParams.get("requestId")?.trim();
  const model = normalizeQueueModelPath(url.searchParams.get("model") ?? envValue(env.FAL_VIDEO_MODEL, DEFAULT_FAL_VIDEO_MODEL));

  if (!requestId) {
    return json({ ok: false, message: "Missing fal request id." }, 400);
  }

  const response = await fetch(`https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}/status?logs=1`, {
    headers: {
      Authorization: `Key ${falKey}`,
    },
  });

  if (!response.ok) {
    return json(
      {
        ok: false,
        message: await parseApiError(response, "Unable to check cinematic render status."),
      },
      response.status >= 500 ? 502 : response.status,
    );
  }

  const payload = (await response.json()) as {
    status?: string;
    logs?: Array<{ message?: string }>;
    queue_position?: number;
  };

  return json({
    ok: true,
    status: payload.status ?? "UNKNOWN",
    queuePosition: payload.queue_position,
    logs: payload.logs?.map((entry) => entry.message).filter(Boolean).slice(-5) ?? [],
    message:
      payload.status === "COMPLETED"
        ? "Cinematic render is ready."
        : payload.status === "IN_PROGRESS"
          ? "Cinematic render is in progress."
          : "Cinematic render is queued.",
  });
}
