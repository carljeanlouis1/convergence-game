import {
  DEFAULT_FAL_VIDEO_MODEL,
  PagesContext,
  envValue,
  json,
  parseApiError,
  sameOriginGuard,
} from "../_shared";

const normalizeEndpointPath = (model: string) => model.trim().replace(/^\/+|\/+$/g, "");

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
  const model = normalizeEndpointPath(url.searchParams.get("model") ?? envValue(env.FAL_VIDEO_MODEL, DEFAULT_FAL_VIDEO_MODEL));

  if (!requestId) {
    return json({ ok: false, message: "Missing fal request id." }, 400);
  }

  const response = await fetch(`https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}/response`, {
    headers: {
      Authorization: `Key ${falKey}`,
    },
  });

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
