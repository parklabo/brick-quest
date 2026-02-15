# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Brick Quest is an AI-powered LEGO brick scanner and 3D build instruction generator. Users scan their brick collections, build an inventory, and receive AI-generated step-by-step 3D building instructions.

## Architecture

Turborepo + pnpm monorepo with Firebase backend:

```
[Landing (7030)] — Next.js + next-intl (en/ko/ja) marketing site
[Web App (7031)] — Next.js + Three.js + Zustand main app
[Console (7032)] — Next.js + Three.js admin console
        ↓ (httpsCallable)
[Firebase Functions] — submitScan, submitBuild, submitDesign (onCall)
        ↓ (onDocumentCreated / onDocumentUpdated triggers)
[Firestore] — jobs collection (status tracking + results)
        ↓ (onSnapshot)
[Web App] — Real-time result updates
```

### Async Flow
1. Web App → `httpsCallable('submitScan')`, `httpsCallable('submitBuild')`, or `httpsCallable('submitDesign')`
2. Callable function → Firestore `jobs/{jobId}` document created (status: pending)
3. `processJob` (onDocumentCreated) trigger fires → calls Gemini API
4. Trigger updates document (status: completed, result: ...)
5. Web App `onSnapshot` receives real-time update → UI renders result

### Design Flow (extended)
1. `submitDesign` → job created (pending)
2. `processJob` → generates orthographic views → status: `views_ready`
3. User approves → `approveDesignViews` → status: `generating_build`
4. `processDesignUpdate` (onDocumentUpdated) → generates build plan → status: `completed`

## Monorepo Structure

```
brick-quest/
├── apps/
│   ├── landing/          # Next.js 16 + next-intl (port 7030)
│   │   └── firebase.json     # Firebase Hosting config (static export)
│   ├── web/              # Next.js 16 + Three.js (port 7031)
│   │   └── apphosting.yaml   # Firebase App Hosting config
│   └── console/          # Next.js 16 + Three.js admin console (port 7032)
│       └── apphosting.yaml   # Firebase App Hosting config
├── packages/
│   ├── shared/           # @brick-quest/shared - types, constants, utils, shape registry
│   └── functions/        # Firebase Cloud Functions (2nd gen)
│       ├── src/
│       │   ├── index.ts
│       │   ├── config.ts
│       │   ├── callable/     # submitScan, submitBuild, submitDesign, setAdminRole, approveDesignViews, regenerateDesignViews
│       │   ├── services/     # geminiScan, geminiBuild, geminiDesign
│       │   └── triggers/     # processJob, processDesignUpdate
│       └── package.json
├── scripts/
│   ├── prepare-functions-deploy.js   # Predeploy: bundle shared into functions
│   └── cleanup-functions-deploy.js   # Postdeploy: restore workspace:* dep
└── .github/workflows/
    ├── ci.yml                # Build check on PR/push to main
    ├── sync-branches.yml     # Auto-detect changes → trigger deploys
    ├── deploy-landing.yml    # Firebase Hosting deploy (static)
    ├── deploy-web.yml        # Push to deploy/web → App Hosting
    ├── deploy-console.yml    # Push to deploy/console → App Hosting
    └── deploy-functions.yml  # Cloud Functions deploy via firebase-tools
```

## Cloud Functions

| Function | Type | Trigger | Description |
|----------|------|---------|-------------|
| `submitScan` | onCall | HTTP | Upload image → create scan job |
| `submitBuild` | onCall | HTTP | Parts + difficulty → create build job |
| `submitDesign` | onCall | HTTP | Reference image → create design job |
| `setAdminRole` | onCall | HTTP | Set admin custom claim |
| `approveDesignViews` | onCall | HTTP | Approve views → trigger build generation |
| `regenerateDesignViews` | onCall | HTTP | Re-generate orthographic views |
| `processJob` | trigger | document.created (`jobs/{jobId}`) | Process new scan/build/design jobs |
| `processDesignUpdate` | trigger | document.updated (`jobs/{jobId}`) | Handle design state transitions |

## Development Commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps + emulators concurrently
pnpm build                # Build all packages and apps
pnpm typecheck            # TypeScript check across all packages

pnpm dev:web              # Start web app only
pnpm dev:landing          # Start landing page only
pnpm dev:console          # Start admin console only

pnpm firebase:emulators   # Start Firebase emulators (Functions + Firestore + Storage + Auth)
pnpm firebase:deploy      # Deploy Cloud Functions to production
```

## Deployment

### App Hosting (web, console)
- Triggered by pushing to `deploy/web` or `deploy/console` branches
- `sync-branches.yml` auto-detects changes on main and pushes to deploy branches
- Requires `output: 'standalone'` in next.config.ts
- Requires `export const dynamic = 'force-dynamic'` in root layout.tsx (prevents Firebase Auth init during build)
- Next.js version must be pinned to exact version (no `^`/`~` prefix) due to buildpack CVE check

### Firebase Hosting (landing)
- Static export via `output: 'export'` in next.config.ts
- Deployed via `FirebaseExtended/action-hosting-deploy` GitHub Action

### Cloud Functions
- Deployed via `firebase deploy --only functions` or GitHub Actions workflow
- `predeploy` script bundles `@brick-quest/shared` into `_shared/` and replaces `workspace:*` with `file:./_shared`
- `postdeploy` script restores the original `workspace:*` dependency
- `GEMINI_API_KEY` managed via Secret Manager (`defineSecret`), not `.env`

### GitHub Secrets Required
- `FIREBASE_SERVICE_ACCOUNT` — Firebase Admin SDK service account JSON key

## Environment Setup

**apps/web/.env.local** (also apps/console/.env.local):
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**packages/functions/.env** (deployed to cloud):
```
GEMINI_MODEL=gemini-3-pro-preview
GCLOUD_STORAGE_BUCKET=brick-quest.firebasestorage.app
```

**packages/functions/.env.local** (local only, not deployed):
```
GEMINI_API_KEY=your_api_key
```

**Production**: `GEMINI_API_KEY` is stored in Google Secret Manager and injected via `defineSecret` in trigger functions.

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

## Build Physics (packages/shared/src/utils/build-physics.ts)

Post-processing pipeline for AI-generated LEGO build steps:
1. **Phase 0 — Snap**: `snapDimensions` + `snapToStudGrid` for all steps
2. **Phase 1 — Sort**: Sort by Y position (bottom-up)
3. **Phase 2 — Gravity**: Snap bricks down to nearest support
4. **Phase 3 — Overlap**: Check overlaps, nudge before removing (`tryNudgeBrick`)
5. **Phase 4 — Renumber**: Sequential step IDs

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

- **Runtime**: Node.js 22 (see .nvmrc)
- **Package Manager**: pnpm 9.14.2
- **Build System**: Turborepo
- **Frontend**: Next.js 16.1.6 (pinned), React 19, Tailwind CSS v4, Three.js, Zustand
- **Backend**: Firebase Functions (2nd gen), Firestore, Cloud Storage, Secret Manager
- **AI**: Google Gemini (@google/genai)
- **i18n**: next-intl (en, ko, ja)
- **Hosting**: Firebase App Hosting (web, console), Firebase Hosting (landing)
