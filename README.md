# Brick Quest

> Built for the [**4th Agentic AI Hackathon with Google Cloud**](https://zenn.dev/topics/gch4)

AI-powered LEGO brick scanner and 3D build instruction generator.

Scan your LEGO bricks, build an inventory, and get AI-generated step-by-step 3D building instructions — with an **agentic AI loop** that autonomously validates and improves build quality.

## Getting Started

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 9+
- Docker (for Firebase emulators)

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment variables
# apps/web/.env.local       — Firebase web config (NEXT_PUBLIC_FIREBASE_*)
# apps/console/.env.local   — Firebase web config (same as above)
# packages/functions/.env.local — GEMINI_API_KEY (local dev only)

# Start Firebase emulators + all apps
pnpm dev
```

### Services

| Service | URL | Description |
|---------|-----|-------------|
| Landing | http://localhost:7030 | Marketing site (en/ko/ja) |
| Web App | http://localhost:7031 | Main application |
| Admin Console | http://localhost:7032 | Admin dashboard |
| Emulator UI | http://localhost:7020 | Firebase emulator dashboard |

## Architecture

```
[Landing] → Marketing/SEO/i18n (static export)
[Web App] → Scan, Inventory, Design, 3D Build Viewer
[Console] → Admin dashboard, shape management
     ↓ (httpsCallable)
[Cloud Functions] → submitScan, submitBuild, submitDesign
     ↓ (Firestore triggers)
[Gemini AI] → Image analysis / orthographic views / 3D build plans
     ↓                              ↑
[Physics Engine] → Validate      Feedback with dropped bricks
     ↓            (overlap,       & spatial instructions
     OK?──No──→   gravity)  ──→  Re-prompt Gemini (up to 3×)
     ↓ Yes
     ↓ (onSnapshot)
[Web App] → Real-time result updates
```

## Agentic AI: Self-Improving Build Generation

Gemini generates 3D LEGO build plans, but raw output often contains **physics errors** — overlapping bricks, floating pieces, invalid positions. Brick Quest solves this with an autonomous agent loop:

1. **Generate** — Gemini creates a build plan from the user's parts and prompt
2. **Validate** — A physics engine checks every brick for overlaps, gravity support, and grid alignment
3. **Feedback** — If >15% of bricks are dropped during correction, the system generates detailed spatial feedback (which bricks failed, why, and how to fix them)
4. **Re-generate** — Gemini receives the feedback and produces an improved build
5. **Repeat** — Up to 3 iterations, tracking the best result across all attempts

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Gemini AI  │────→│ Physics      │────→│ Quality Check   │
│  (generate) │     │ Engine       │     │ (>15% dropped?) │
└─────────────┘     │ • snap grid  │     └────────┬────────┘
       ↑            │ • gravity    │              │
       │            │ • overlap    │         No   │  Yes
       │            │ • nudge      │         ↓    │
       │            └──────────────┘      ✅ Done  │
       │                                          │
       └──────── Feedback prompt ─────────────────┘
                 (dropped bricks + reasons)
```

This pattern ensures every delivered build is physically valid, even when the LLM's spatial reasoning isn't perfect.

## Tech Stack

- **Monorepo**: Turborepo + pnpm
- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, Three.js, Zustand
- **Backend**: Firebase Functions (2nd gen), Firestore, Cloud Storage, Secret Manager
- **AI**: Google Gemini 3 Pro
- **i18n**: next-intl (English, Korean, Japanese)

## Deployment

| Service | Platform | Trigger |
|---------|----------|---------|
| Landing | Firebase Hosting | Push to main (if `apps/landing/` changed) |
| Web App | Firebase App Hosting | Push to `deploy/web` branch |
| Console | Firebase App Hosting | Push to `deploy/console` branch |
| Functions | Cloud Functions (2nd gen) | Manual or push to main (if `packages/functions/` changed) |

## License

Private
