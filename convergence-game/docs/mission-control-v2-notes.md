# Convergence Mission Control V2 Notes

## Production AI

- Production redeploy after secrets succeeded.
- `/api/ai/status` reports OpenAI and Gemini connected.
- Narrative uses the server-side text provider, premium scene art uses GPT Image 2 first, fast automatic scene art prefers Gemini image generation first, and voice uses OpenAI TTS.

## Playtest Snapshot

- Played the live site from a fresh start to turn 8.
- No browser console errors were observed during the run.
- Dilemmas appeared and resolved correctly, including Pentagon Proposal, chip procurement pressure, and transparency-report pressure.
- The strongest UX need was not more mechanics yet. It was clearer state reading: what changed this quarter, why it matters, and what action the player should consider next.

## Research Takeaways

- XCOM 2: the strategic layer works because research, staff, and facilities feel like parts of one command room instead of disconnected menus.
- Democracy 4: causal/metric-heavy simulation needs visual clarity, filters, and plain-language consequences.
- Terra Invicta: deep strategy is exciting, but the UI must aggressively surface next actions or the player drowns.
- Frostpunk: moral pressure lands harder when a dilemma is staged like a crisis moment, not just a text popup.
- Plague Inc.: escalating news and world reactions make a simulation feel alive between mechanical turns.

## Mockups

Separate visual mockups live in `docs/mission-control-v2-mockups/`:

- Home
- Briefing/Dashboard
- Research
- Finance
- Hiring
- Facilities
- Dilemma
- Settings/AI
- Mobile Briefing

## Implementation Direction

- Preserve deterministic game balance for this pass.
- Upgrade presentation to a premium near-future mission-control interface.
- Make every major panel answer three questions: what changed, why it matters, and what to do next.
- Use AI scene art as an atmosphere layer in briefing and dilemma moments, not as required core gameplay.
- Keep public API endpoints unchanged: `/api/ai/status`, `/api/ai/narrative`, `/api/ai/scene-image`, and `/api/ai/tts`.

## Staff Portraits

- Generated square staff portraits for the full researcher catalog with Gemini image generation.
- Portraits live in `public/staff/` and are referenced by researcher ID, for example `/staff/mae-ibarra.jpg`.
- The generation script is `scripts/generate-staff-portraits.mjs` and reads `GEMINI_API_KEY` from the local environment.
- The key is intentionally not stored in the repository.
- Candidate and staff surfaces now show portraits in hiring, research assignment, payroll, and pending-hire queues.
