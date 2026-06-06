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
  const rawModel = (url.searchParams.get("model") ?? envValue(env.FAL_VIDEO_MODEL, DEFAULT_FAL_VIDEO_MODEL))
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const model = normalizeQueueModelPath(rawModel);

  if (!requestId) {
    return json({ ok: false, message: "Missing fal request id." }, 400);
  }

  const encodedRequestId = encodeURIComponent(requestId);
  const candidateUrls = [
    `https://queue.fal.run/${rawModel}/requests/${encodedRequestId}/status?logs=1`,
    `https://queue.fal.run/${model}/requests/${encodedRequestId}/status?logs=1`,
    `https://queue.fal.run/${model}/image-to-video/requests/${encodedRequestId}/status?logs=1`,
    `https://queue.fal.run/${model}/text-to-video/requests/${encodedRequestId}/status?logs=1`,
  ].filter((candidate, index, all) => Boolean(candidate) && all.indexOf(candidate) === index);

  let response: Response | null = null;
  for (const candidate of candidateUrls) {
    response = await fetch(candidate, {
      headers: {
        Authorization: `Key ${falKey}`,
      },
    });

    if (response.ok || ![404, 405, 422].includes(response.status)) {
      break;
    }
  }

  if (!response) {
    return json({ ok: false, message: "Unable to locate cinematic status URL." }, 502);
  }

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
    response_url?: string;
    error?: string;
    error_type?: string;
  };

  return json({
    ok: true,
    status: payload.status ?? "UNKNOWN",
    queuePosition: payload.queue_position,
    responseUrl: payload.response_url,
    error: payload.error,
    errorType: payload.error_type,
    logs: payload.logs?.map((entry) => entry.message).filter(Boolean).slice(-5) ?? [],
    message:
      payload.error
        ? payload.error
        : payload.status === "COMPLETED"
        ? "Cinematic render is ready."
        : payload.status === "IN_PROGRESS"
          ? "Cinematic render is in progress."
          : "Cinematic render is queued.",
  });
}
