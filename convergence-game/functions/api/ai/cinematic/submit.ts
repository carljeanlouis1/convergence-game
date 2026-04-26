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

const normalizeModelPath = (model: string) =>
  model
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/(?:image-to-video|text-to-video)$/u, "");

const normalizeEndpointPath = (model: string, useImageToVideo: boolean) => {
  const clean = model.trim().replace(/^\/+|\/+$/g, "");

  if (clean.endsWith("/image-to-video") || clean.endsWith("/text-to-video")) {
    return clean;
  }

  return `${clean}/${useImageToVideo ? "image-to-video" : "text-to-video"}`;
};

const readPayload = async (request: Request) =>
  (await request.json().catch(() => null)) as CinematicPayload | null;

const parseDataImage = (value: string) => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/iu.exec(value);
  if (!match) {
    return null;
  }

  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  return {
    bytes,
    mimeType: match[1],
    extension: match[1].split("/")[1]?.split(/[+;-]/u)[0] || "png",
  };
};

const uploadImageToFal = async ({
  falKey,
  imageDataUri,
}: {
  falKey: string;
  imageDataUri: string;
}) => {
  const parsed = parseDataImage(imageDataUri);
  if (!parsed) {
    throw new Error("Cinematic image must be a base64 data:image URI.");
  }

  const initiate = await fetch("https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      content_type: parsed.mimeType,
      file_name: `convergence-scene-${Date.now()}.${parsed.extension}`,
    }),
  });

  if (!initiate.ok) {
    throw new Error(await parseApiError(initiate, "fal.ai image upload could not be initialized."));
  }

  const upload = (await initiate.json()) as {
    upload_url?: string;
    file_url?: string;
  };

  if (!upload.upload_url || !upload.file_url) {
    throw new Error("fal.ai did not return an upload URL.");
  }

  const uploaded = await fetch(upload.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": parsed.mimeType,
    },
    body: new Blob([parsed.bytes], { type: parsed.mimeType }),
  });

  if (!uploaded.ok) {
    throw new Error(await parseApiError(uploaded, "fal.ai image upload failed."));
  }

  return upload.file_url;
};

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

  if (imageDataUri && !imageDataUri.startsWith("data:image/")) {
    return json({ ok: false, message: "Cinematic image must be a data:image URI." }, 400);
  }

  if (imageDataUri && imageDataUri.length > 28_000_000) {
    return json({ ok: false, message: "Cinematic image is too large for video generation." }, 413);
  }

  let imageUrl: string | null = null;
  let uploadWarning: string | null = null;
  if (imageDataUri) {
    try {
      imageUrl = await uploadImageToFal({ falKey, imageDataUri });
    } catch (error) {
      uploadWarning = error instanceof Error ? error.message : "Scene image upload failed.";
    }
  }

  const model = envValue(env.FAL_VIDEO_MODEL, DEFAULT_FAL_VIDEO_MODEL);
  const queueModel = normalizeModelPath(model);
  const endpointPath = normalizeEndpointPath(model, Boolean(imageUrl));
  const endpoint = `https://queue.fal.run/${endpointPath}`;

  const input = {
    prompt,
    duration: payload?.duration ?? "5",
    resolution: payload?.resolution ?? "720p",
    aspect_ratio: payload?.aspectRatio ?? "16:9",
    generate_audio: Boolean(payload?.generateAudio),
    ...(imageUrl ? { image_url: imageUrl } : {}),
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
    model: queueModel,
    mode: imageUrl ? "image-to-video" : "text-to-video",
    requestId: result.request_id,
    statusUrl: result.status_url,
    resultUrl: result.response_url,
    message: uploadWarning
      ? `Scene image upload failed, so text-to-video was submitted instead. ${uploadWarning}`
      : "Cinematic render submitted to fal.ai. You can keep playing while it renders.",
  });
}
