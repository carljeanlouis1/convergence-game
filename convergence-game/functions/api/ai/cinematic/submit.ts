import {
  DEFAULT_FAL_VIDEO_MODEL,
  PagesContext,
  envValue,
  json,
  parseApiError,
  rateLimitGuard,
  sameOriginGuard,
} from "../_shared";

type CinematicPayload = {
  prompt?: string;
  imageDataUri?: string;
  duration?: "4" | "5" | "6" | "8" | "10" | "15";
  resolution?: "480p" | "720p" | "1080p";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  generateAudio?: boolean;
};

const normalizeEndpointPath = (model: string, useImageToVideo: boolean) => {
  const clean = model.trim().replace(/^\/+|\/+$/g, "");

  if (clean.endsWith("/image-to-video") || clean.endsWith("/text-to-video")) {
    return clean;
  }

  return `${clean}/${useImageToVideo ? "image-to-video" : "text-to-video"}`;
};

const readPayload = async (request: Request) =>
  (await request.json().catch(() => null)) as CinematicPayload | null;

export async function onRequestPost({ request, env }: PagesContext) {
  const blocked = sameOriginGuard(request);
  if (blocked) {
    return blocked;
  }

  const limited = await rateLimitGuard({
    request,
    env,
    scope: "cinematic-video",
    limit: 8,
    windowSeconds: 3600,
  });
  if (limited) {
    return limited;
  }

  const falKey = env.FAL_KEY?.trim();
  if (!falKey) {
    return json({ ok: false, message: "fal.ai video is not configured yet. Add FAL_KEY in Cloudflare secrets." }, 503);
  }

  const payload = await readPayload(request);
  const prompt = payload?.prompt?.trim();

  if (!prompt) {
    return json({ ok: false, message: "Missing cinematic prompt." }, 400);
  }

  if (prompt.length > 4_000) {
    return json({ ok: false, message: "Cinematic prompt is too large." }, 413);
  }

  const imageDataUri = payload?.imageDataUri?.trim();
  const useImageToVideo = Boolean(imageDataUri);

  if (imageDataUri && !imageDataUri.startsWith("data:image/")) {
    return json({ ok: false, message: "Cinematic image must be a data:image URI." }, 400);
  }

  if (imageDataUri && imageDataUri.length > 28_000_000) {
    return json({ ok: false, message: "Cinematic image is too large for video generation." }, 413);
  }

  const model = envValue(env.FAL_VIDEO_MODEL, DEFAULT_FAL_VIDEO_MODEL);
  const endpointPath = normalizeEndpointPath(model, useImageToVideo);
  const endpoint = `https://queue.fal.run/${endpointPath}`;

  const input = {
    prompt,
    duration: payload?.duration ?? "5",
    resolution: payload?.resolution ?? "720p",
    aspect_ratio: payload?.aspectRatio ?? "16:9",
    generate_audio: Boolean(payload?.generateAudio),
    ...(imageDataUri ? { image_url: imageDataUri } : {}),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return json(
      {
        ok: false,
        message: await parseApiError(response, "fal.ai cinematic generation failed to start."),
      },
      response.status >= 500 ? 502 : response.status,
    );
  }

  const result = (await response.json()) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  };

  if (!result.request_id) {
    return json({ ok: false, message: "fal.ai did not return a request id." }, 502);
  }

  return json({
    ok: true,
    provider: "fal",
    model: endpointPath,
    mode: useImageToVideo ? "image-to-video" : "text-to-video",
    requestId: result.request_id,
    statusUrl: result.status_url,
    resultUrl: result.response_url,
    message: "Cinematic render submitted to fal.ai. You can keep playing while it renders.",
  });
}
