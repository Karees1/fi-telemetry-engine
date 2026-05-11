# CLAUDE.md — F1 Telemetry Dashboard

This file is read by Claude Code at the start of every session.
Keep it concise, accurate, and up-to-date. No running plans here.

---

## What this project is

A futuristic, personal F1 telemetry dashboard. Historical race data first,
live race data later. Built with craft — every animation and component is intentional.
This is not a "generic dashboard". It is a portfolio piece and a personal passion project.

---

## Tech Stack

| Layer       | Technology                              |
|-------------|----------------------------------------|
| Framework   | Next.js 14 (App Router, TypeScript)    |
| 3D          | Three.js + @react-three/fiber + drei   |
| Animations  | Framer Motion                          |
| State       | Zustand                                |
| Data        | Python FastF1 service (REST API calls) |
| Styling     | CSS Modules + design-tokens.ts         |
| Deployment  | Vercel                                 |

---

## Commands

```bash
npm run dev          # Start Next.js on localhost:3000
npm run build        # Production build
npm run type-check   # TypeScript validation (no emit)
npm run lint         # ESLint

# Python service (run in separate terminal)
python services/python/fastf1_service.py
```

---

## Project Layout

```
f1-telemetry-app/
├── CLAUDE.md                        ← You are here
├── design-tokens.ts                 ← ALL design rules. Colors, fonts, spacing, effects
├── types/index.ts                   ← ALL TypeScript types and interfaces
├── public/
│   └── world-110m.json              ← Natural Earth 110m TopoJSON (coastlines for globe)
│
├── hooks/                           ← Custom hooks (NOT inside app/ — tsconfig @/hooks/* → ./hooks/*)
│   └── useRaces.ts                  ← Fetch race list with 1-hour sessionStorage cache
│
├── app/
│   ├── layout.tsx                   ← Root layout. Injects CSS vars from design tokens
│   ├── page.tsx                     ← Phase orchestrator: intro → race picker → dashboard
│   ├── globals.css                  ← Global styles, utility classes, animations
│   │
│   ├── components/
│   │   ├── IntroAnimation/          ← CarIntro — 3D car reveal sequence (needs polish later)
│   │   ├── WelcomeScreen/           ← Deprecated — replaced by RacePicker
│   │   ├── RacePicker/              ← ✅ BUILT — 3D globe race selector
│   │   │   ├── RacePicker.tsx       ← Canvas host + header + year selector + search
│   │   │   ├── Globe.tsx            ← R3F scene: sphere + coastlines + lat/lon grid + pins
│   │   │   ├── RaceNode.tsx         ← Individual circuit pin (sphere + glow + tooltip)
│   │   │   ├── RaceCard.tsx         ← Slide-up panel: race info + session pills + CTA
│   │   │   ├── RacePicker.module.css
│   │   │   └── index.ts
│   │   ├── Track3D/                 ← Three.js 3D track visualization (next to build)
│   │   ├── Telemetry/               ← Metric panels (speed, throttle, brake, gear)
│   │   └── Controls/                ← Timeline scrubber, metric toggles
│   │
│   └── api/
│       ├── races/route.ts           ← GET /api/races?year= (2023 + 2024 static; others need FastF1)
│       ├── sessions/route.ts        ← GET /api/sessions/:raceId/:type
│       └── telemetry/route.ts       ← GET /api/telemetry/:sessionId/:driver
│
└── services/python/
    └── fastf1_service.py            ← FastF1 data fetcher (skeleton — not yet a REST API)
```

---

## Design Rules (non-negotiable)

These come from `design-tokens.ts`. Always use the tokens, never raw values.

**Colors:**
- Background: `#0A0E27` (deep space black)
- Primary Red: `#EF1E24` (Ferrari / F1)
- Primary Cyan: `#00D9FF` (electric neon)
- Card bg: `rgba(20, 25, 48, 0.8)` with `backdrop-filter: blur(10px)`
- Text: `#FFFFFF` primary, `#B0B5C1` secondary, `#6B7280` muted

**Typography:**
- Display / headings: `Space Grotesk` (bold, geometric)
- Body / data: `Roboto Mono` (monospace, technical)
- Never use system fonts for primary text

**Components:**
- All panels use glassmorphism: semi-transparent bg + blur + `rgba(0,217,255,0.2)` border
- Hover state: increase border opacity + add `0 0 20px rgba(0,217,255,0.3)` glow
- Buttons: uppercase, letter-spacing 0.05em, snappy spring transition
- No rounded corners above `1rem` except pill buttons

**Animations:**
- All transitions minimum `300ms`
- Use spring easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` for interactive elements
- Framer Motion for page and panel transitions
- Three.js for all 3D animation — never CSS 3D transforms for track/car

---

## Component Architecture Rules

- **React function components only.** No class components.
- **No prop drilling.** Use Zustand for shared state across dashboard panels.
- **CSS Modules** for component styles. Never inline styles except for dynamic Three.js values.
- **Each component folder** should have: `ComponentName.tsx`, `ComponentName.module.css`, `index.ts`
- **Three.js components** always wrapped in `<Suspense>` with a loading fallback.
- Import paths use `@/` alias (configured in tsconfig).

```ts
// ✅ Correct
import { Track3D } from '@/components/Track3D';
import theme from '@/design-tokens';

// ❌ Wrong
import { Track3D } from '../../../components/Track3D';
```

---

## Data Flow

```
User picks race
    → useRaces() fetches GET /api/races
    → GET /api/sessions/:raceId/:sessionType
    → GET /api/telemetry/:sessionId/:driverCode
    → Python FastF1 service fetches + processes data
    → Returns typed JSON (see types/index.ts)
    → Zustand store updates
    → All panels re-render reactively
```

**API response shape** (always follow this):
```ts
{
  status: 'success' | 'error',
  data?: T,
  error?: string,
  timestamp: number
}
```

---

## Three.js / 3D Rules

- Use `@react-three/fiber` (R3F) — never raw Three.js DOM manipulation in React.
- Use `@react-three/drei` for helpers (OrbitControls, Line, Text, Html, etc.)
- Globe scene lives in `app/components/RacePicker/Globe.tsx`
- Track scene will live in `app/components/Track3D/`
- Camera: perspective camera, FOV 48–52 for globe; 75° for track (track coords are in meters)
- Track coordinates come from FastF1 telemetry `X`, `Y`, `Z` values — normalize before rendering
- Globe pin positions: `latLonToCart(lat, lon, radius)` → THREE.js cartesian (Y-up)
- Coastlines fetched from `public/world-110m.json` (Natural Earth 110m TopoJSON via topojson-client)
- Performance: use `instancedMesh` for repeated geometry (DRS indicators, marshal posts etc.)
- Always `dispose()` geometry and materials on component unmount
- `OrbitControls.autoRotate` is the preferred globe spin — pause via `orbitRef.current.autoRotate = false` on hover

---

## Python Service Rules

- FastF1 cache lives in `./cache/` — never commit this folder
- All data returned as JSON — no pickle, no binary formats
- The service runs on `http://localhost:5000` in development
- **SSE stream** at `GET /api/session/load?year=&round=&session=&drivers=`
  - Emits events in order: `connecting → session_meta → lap_times → track_layout → telemetry (×N) → complete`
  - Two-pass load: metadata+laps first (fast), then full telemetry (slow). FastF1 disk cache (`./cache/`) makes repeat loads instant.
- Next.js proxies the SSE stream at `GET /api/session/load` → `http://localhost:5000/api/session/load`
- `hooks/useSessionLoad.ts` consumes the stream and builds state progressively — use this, not raw fetch
- Errors return `{ status: 'error', message: string }` — never throw raw exceptions to the API
- Always use `pd.isna()` to guard pandas NaT/NA values before calling `.total_seconds()` or `bool()` on them

---

## What NOT to do

- ❌ Don't use `any` in TypeScript — if you're unsure, check `types/index.ts`
- ❌ Don't use `useEffect` for data fetching — use the custom hooks in `hooks/`
- ❌ Don't hardcode colors, fonts, or spacing — use `design-tokens.ts`
- ❌ Don't put business logic in components — components render, hooks fetch, services process
- ❌ Don't create new API routes without a matching TypeScript type for the response
- ❌ Don't add new npm packages without checking if drei already has what you need

---

## Current Status

Phase 2 in progress (backend wired, Track3D next).

| Feature                                        | Status        |
|------------------------------------------------|---------------|
| Design tokens                                  | ✅ Locked in   |
| TypeScript types                               | ✅ Defined     |
| Intro animation (CarIntro)                     | ✅ Built — both cars, no lag between them |
| — Mercedes: 3 cinematic shots                  | ✅ Built       |
| — Porsche: 5 cinematic shots (low, rear, top, side, face) | ✅ Built |
| — Both models preloaded, single Canvas, no remount | ✅ Built   |
| 3D globe race picker (RacePicker)              | ✅ Built       |
| — Real coastlines (Natural Earth 110m)         | ✅ Built       |
| — Circuit pins at geo-coordinates              | ✅ Built       |
| — Year selector (2023 / 2024)                  | ✅ Built       |
| — Search + filter                              | ✅ Built       |
| — sessionStorage race list cache               | ✅ Built       |
| — Race card (slide-up, centered, session pills)| ✅ Built       |
| Races API (2023 + 2024 static calendars)       | ✅ Built       |
| Python FastF1 REST + SSE service               | ✅ Built — `services/python/fastf1_server.py` |
| — SSE streaming (7 events, 2-pass load)        | ✅ Built       |
| — `GET /api/session/load` Next.js proxy        | ✅ Built       |
| — `hooks/useSessionLoad.ts` consumer hook      | ✅ Built       |
| — DataUplink cinematic loading screen          | ✅ Built       |
| — Hydration error fix (dangerouslySetInnerHTML)| ✅ Fixed       |
| Track3D component                              | 🔲 Next        |
| Telemetry panels (speed/throttle/brake/gear)   | 🔲 Next        |
| Timeline scrubber                              | 🔲 Next        |
| Driver comparison mode                         | 🔲 Planned     |
| WebSocket live data                            | 🔲 Future      |

### What the data pipeline delivers today
When user picks a race + session and clicks ENTER RACE DATA:
- `loadState.sessionMeta` — driver roster, circuit, date
- `loadState.laps` — all lap rows with lap times + sector splits (ms) + compound
- `loadState.track` — X/Y/Z arrays for the full circuit + bounds (ready for Track3D)
- `loadState.telemetry` — Map keyed by driver code; each entry has columnar arrays for distance/speed/throttle/brake/gear/DRS/x/y/z

### Deferred / Known polish items
- **Intro animation** — do not touch until Track3D and telemetry panels are complete.
- **Older seasons (pre-2023)** — year selector only shows 2023/2024 (static); older years need the Python service (it supports any year FastF1 has data for).
- **Session pill default** — RaceCard defaults to `R` (Race). Sprint weekends need SQ/S awareness.

---

## Deeper Reference

For 3D component specifications and build order, see:
`docs/3D_COMPONENTS_GUIDE.md`

For design system details, see:
`design-tokens.ts`

For all data types, see:
`types/index.ts`
