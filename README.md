# Brick Quest

AI-powered LEGO brick scanner and 3D build instruction generator.

Scan your LEGO bricks, build an inventory, and get AI-generated step-by-step 3D building instructions.

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 9+
- Firebase CLI (`npm install -g firebase-tools`)

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment variables (see CLAUDE.md for details)
# apps/web/.env.local — Firebase web config
# packages/functions/.env — GEMINI_API_KEY

# Start Firebase emulators + web app
pnpm firebase:emulators   # Terminal 1
pnpm dev:web              # Terminal 2
```

### Services

| Service | URL | Description |
|---------|-----|-------------|
| Landing | http://localhost:7030 | Marketing site (en/ko/ja) |
| Web App | http://localhost:7031 | Main application |
| Firebase Emulator UI | http://localhost:4000 | Firestore, Functions, Storage dashboard |

## Architecture

```
[Landing] → Marketing/SEO/i18n
[Web App] → Scan, Inventory, 3D Build Viewer
     ↓ (httpsCallable)
[Firebase Functions] → submitScan, submitBuild
     ↓ (Firestore trigger)
[Gemini AI] → Image analysis / 3D build plans
     ↓ (onSnapshot)
[Web App] → Real-time result updates
```

## Tech Stack

- **Monorepo**: Turborepo + pnpm
- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, Three.js
- **Backend**: Firebase Functions (2nd gen), Firestore, Cloud Storage
- **AI**: Google Gemini 3 Pro
- **i18n**: next-intl (English, Korean, Japanese)

## License

Private
