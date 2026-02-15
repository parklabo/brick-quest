# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Brick Quest is an AI-powered LEGO brick scanner and 3D build instruction generator. Users scan their brick collections, build an inventory, and receive AI-generated step-by-step 3D building instructions.

## Architecture

Turborepo + pnpm monorepo with Firebase backend:

```
[Landing (7030)] — Next.js + next-intl (en/ko/ja) marketing site
[Web App (7031)] — Next.js + Three.js + Zustand main app
        ↓ (httpsCallable)
[Firebase Functions] — submitScan, submitBuild (onCall)
        ↓ (onDocumentCreated trigger)
[Firestore] — jobs collection (status tracking + results)
        ↓ (onSnapshot)
[Web App] — Real-time result updates
```

### Async Flow
1. Web App → `httpsCallable('submitScan')` or `httpsCallable('submitBuild')`
2. Callable function → Firestore `jobs/{jobId}` document created (status: pending)
3. `onDocumentCreated` trigger fires → calls Gemini API
4. Trigger updates document (status: completed, result: ...)
5. Web App `onSnapshot` receives real-time update → UI renders result

## Monorepo Structure

```
brick-quest/
├── apps/
│   ├── landing/          # Next.js 16 + next-intl (port 7030)
│   ├── web/              # Next.js 16 + Three.js (port 7031)
│   └── console/          # Next.js 16 + Three.js admin console (port 7032)
└── packages/
    ├── shared/           # @brick-quest/shared - types, constants, utils, shape registry
    └── functions/        # Firebase Cloud Functions (2nd gen)
        ├── src/
        │   ├── index.ts
        │   ├── config.ts
        │   ├── callable/     # submitScan, submitBuild
        │   ├── services/     # geminiScan, geminiBuild
        │   └── triggers/     # processJob
        └── package.json
```

## Development Commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps concurrently
pnpm build                # Build all packages and apps
pnpm typecheck            # TypeScript check across all packages

pnpm dev:web              # Start web app only
pnpm dev:landing          # Start landing page only
pnpm dev:console          # Start admin console only

pnpm firebase:emulators   # Start Firebase emulators (Functions + Firestore + Storage)
pnpm firebase:deploy      # Deploy Cloud Functions to production
```

## Environment Setup

**apps/web/.env.local**:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**packages/functions/.env**:
```
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-3-pro-preview
```

## Key Shared Types (@brick-quest/shared)

- `DetectedPart` — Scanned LEGO brick with type, shape, color, dimensions
- `BuildStepBlock` — Single step in 3D assembly (position, rotation, size)
- `BuildPlan` — Full construction plan with title, lore, and steps
- `JobState<T>` — Async job tracking (pending → processing → completed/failed)
- `ApiResponse<T>` — Standard API response wrapper
- `BrickShape` — Union of 16 shape IDs (rectangle, corner, round, slope_25..75, slope_inverted, curved_slope, arch, cone, dome, half_cylinder, wedge_plate, technic_beam)
- `BrickType` — Union of 7 type IDs (brick, plate, tile, slope, technic, minifig, other)
- `ShapeDefinition` — Full shape metadata (geometry, studs, heights, gemini aliases, icon2d)
- `SHAPE_REGISTRY` — ReadonlyMap<BrickShape, ShapeDefinition> with 16 entries

## Part System

Parts have:
- **type**: brick | plate | tile | slope | technic | minifig | other
- **shape**: 16 shapes defined in `SHAPE_REGISTRY` (packages/shared/src/registry/shape-registry.ts)
  - Basic: rectangle, corner, round
  - Slopes: slope_25, slope_33, slope_45, slope_65, slope_75, slope_inverted
  - Curved: curved_slope, arch, cone, dome, half_cylinder
  - Special: wedge_plate
  - Technic: technic_beam
- **dimensions**: width/length in studs
- **height rules**: use `getBrickHeight(shape, type)` — brick = 1.2 units, plate/tile = 0.4 units

## 3D Coordinate System

- 1 stud = 1 unit on X/Z grid
- Y position is bottom of part
- Even dimensions: position ends in .5 (e.g., 0.5, 1.5)
- Odd dimensions: position is integer (e.g., 0, 1)

## Port Assignments

| Service | Port |
|---------|------|
| Emulator UI | 7020 |
| Functions Emulator | 7021 |
| Firestore Emulator | 7022 |
| Storage Emulator | 7023 |
| Auth Emulator | 7024 |
| Landing | 7030 |
| Web App | 7031 |
| Admin Console | 7032 |

## Tech Stack

- **Runtime**: Node.js 24 (see .nvmrc)
- **Package Manager**: pnpm 9.14.2
- **Build System**: Turborepo
- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, Three.js, Zustand
- **Backend**: Firebase Functions (2nd gen), Firestore, Cloud Storage
- **AI**: Google Gemini (@google/genai)
- **i18n**: next-intl (en, ko, ja)
