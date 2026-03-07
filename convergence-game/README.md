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

## Features

- Deterministic turn-based simulation across research, finance, rivals, and geopolitics
- Eight-track research web with authored convergence events
- Hiring market with 20+ named researchers
- Fallback dilemma system with 15 authored dilemmas
- Auto-save plus three manual save slots
- Optional Gemini-powered narrative generation with client-side caching
