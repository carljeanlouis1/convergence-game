# Convergence

AI research lab strategy simulation built with Next.js, Zustand, Framer Motion, and PixiJS.

## Run locally

```bash
npm install
npm run dev
```

## Build static export

```bash
npm run build
```

The static site is emitted to `out/`.

## Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy out --project-name=convergence-game
```

## Production AI secrets

Cloudflare Pages Functions keep production AI keys server-side. Add the secrets below in the Cloudflare dashboard or with Wrangler:

```bash
npx wrangler pages secret put OPENAI_API_KEY --project-name=convergence-game
npx wrangler pages secret put GEMINI_API_KEY --project-name=convergence-game
```

`OPENAI_API_KEY` is the best-quality path for narrative, GPT Image 2 scene art, and voice. `GEMINI_API_KEY` is optional fallback support for Gemini narrative and image generation.

Optional model overrides:

```bash
OPENAI_TEXT_MODEL=gpt-5.4-mini
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_QUALITY=high
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=marin
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
```

## Features

- Deterministic turn-based simulation across research, finance, rivals, and geopolitics
- Eight-track research web with authored convergence events
- Hiring market with 20+ named researchers
- Fallback dilemma system with 15 authored dilemmas
- Auto-save plus three manual save slots
- Production AI narrative, scene art, and voice through Cloudflare Pages Functions
