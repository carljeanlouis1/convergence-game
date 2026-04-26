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

const normalizeFalResultUrl = (value: string | null) => {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.hostname !== "queue.fal.run") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

const extractVideo = (payload: unknown) => {
  const response = payload as {
    video?: {
      url?: string;
      content_type?: string;
      file_name?: string;
      file_size?: number;
    };
    videos?: Array<{
      url?: string;
      content_type?: string;
      file_name?: string;
      file_size?: number;
    }>;
  };

  return response.video ?? response.videos?.[0] ?? null;
};

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
  const resultUrl = normalizeFalResultUrl(url.searchParams.get("resultUrl"));

  if (!requestId) {
    return json({ ok: false, message: "Missing fal request id." }, 400);
  }

  const encodedRequestId = encodeURIComponent(requestId);
  const candidateUrls = [
    resultUrl,
    `https://queue.fal.run/${model}/requests/${encodedRequestId}`,
    `https://queue.fal.run/${model}/requests/${encodedRequestId}/response`,
    rawModel !== model ? `https://queue.fal.run/${rawModel}/requests/${encodedRequestId}` : null,
    rawModel !== model ? `https://queue.fal.run/${rawModel}/requests/${encodedRequestId}/response` : null,
  ].filter((candidate, index, all): candidate is string => Boolean(candidate) && all.indexOf(candidate) === index);

  let response: Response | null = null;
  for (const candidate of candidateUrls) {
    response = await fetch(candidate, {
      headers: {
        Authorization: `Key ${falKey}`,
      },
    });

    if (response.ok || ![404, 405].includes(response.status)) {
      break;
    }
  }

  if (!response) {
    return json({ ok: false, message: "Unable to locate cinematic result URL." }, 502);
  }

  if (!response.ok) {
    return json(
      {
        ok: false,
        message: await parseApiError(response, "Cinematic render is not ready yet."),
      },
      response.status >= 500 ? 502 : response.status,
    );
  }

  const payload = await response.json();
  const video = extractVideo(payload);

  if (!video?.url) {
    return json({ ok: false, message: "fal.ai returned without a video URL." }, 502);
  }

  return json({
    ok: true,
    videoUrl: video.url,
    contentType: video.content_type ?? "video/mp4",
    fileName: video.file_name,
    fileSize: video.file_size,
    message: "Cinematic video is ready.",
  });
}
