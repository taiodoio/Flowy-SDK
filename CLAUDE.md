# Flowy — Project Cheatsheet for AI Agents

This file provides context for AI coding agents (Claude, Copilot, etc.) working in this repo.

---

## Repository overview

```
/
├── ios-sdk/          Swift Package — capture engine (Apple Vision OCR + swizzling + screenshots)
├── android-sdk/      Android capture engine (ML Kit OCR)
├── web/              Next.js 14 dashboard (TypeScript, Tailwind, Shadcn UI)
├── FlowyTester/      Minimal SwiftUI host app for local SDK testing
├── assets/           Static assets (hero images, etc.)
├── CLAUDE.md         ← you are here
└── README.md         High-level project overview
```

---

## iOS SDK — key files

| File | Purpose |
|---|---|
| `FlowyLogger.swift` | Central coordinator: logs events, schedules captures, manages throttle |
| `FlowyScreenshotCapture.swift` | JPEG compression at configurable scale/quality |
| `ViewHierarchyExtractor.swift` | Full DOM walk (UIKit + SwiftUI accessibility tree) |
| `FlowyHeuristics.swift` | isErrorText / isSuccessText OCR classification rules |
| `UIWindow+Swizzle.swift` | Intercepts all touches; detects scroll gestures (displacement > 12 pt) |
| `UIViewController+Swizzle.swift` | Intercepts viewDidAppear for SCREEN events |
| `UIView+SubviewObserver.swift` | Detects transient views (toasts, banners) via didAddSubview |
| `FlowyWireframeSaver.swift` | JSON serialisation + file I/O (background queue) |
| `FlowyUploader.swift` | Merges individual wireframe files into the session bundle on export |
| `Models.swift` | All Codable structs: FlowyEvent, WireframeFile, ViewNode |

**Build/test:** `cd ios-sdk && swift build`

---

## Web Dashboard — key files

| File | Purpose |
|---|---|
| `src/app/api/analyze/route.ts` | POST endpoint: sends session to Gemini, returns AI report JSON |
| `src/app/api/sessions/[id]/route.ts` | GET/PATCH/DELETE for individual sessions (file-based storage) |
| `src/app/api/sessions/route.ts` | GET (list) / POST (upload new session) |
| `src/app/report/[id]/page.tsx` | Session detail + AI report page |
| `src/app/dashboard/page.tsx` | Session list page |
| `src/lib/wireframe-matcher.ts` | Timestamp-based event→wireframe matching |
| `src/lib/storage.ts` | File system helpers (reads/writes `data/sessions/*.json`) |
| `src/lib/types.ts` | TypeScript types: FlowyEvent, WireframeFile, SessionData |
| `src/components/session-replay.tsx` | Step-by-step event replay UI |
| `src/components/wireframe-heatmap.tsx` | Tap density heatmap overlay |
| `src/components/wireframe-renderer.tsx` | Renders screenshot (if present) or DOM tree rectangles |
| `src/components/analysis-report.tsx` | AI report display component |

**Dev server:** `cd web && npm run dev`
**Type check:** `cd web && npx tsc --noEmit`
**Sessions data:** `web/data/sessions/*.json` (local file storage, not a database)

---

## Current behaviour — capture pipeline (iOS)

1. Touch ends → UIWindow swizzle fires
2. UIGraphicsImageRenderer snapshot → sent to Vision OCR (background)
3. At t+0.8 s: `captureScreenshot(forceFullExtraction: true)` — JPEG + full DOM
4. At t+1.5 s: post-tap OCR scan → logs ERROR/SUCCESS if text matches heuristics
5. viewDidAppear: at t+0.3 s passive screenshot (deduplicated by byte-size delta < 8%)
6. Scroll end (displacement > 12 pt): at t+0.5 s screenshot (`forceFullExtraction: true`)
7. didAddSubview (non-system views): debounce 0.9 s → OCR scan → if match, ERROR/SUCCESS + full DOM

Throttle: non-forced captures are skipped if < 1.0 s since last capture.

---

## Current behaviour — AI analysis (web)

1. Client POSTs full session JSON to `/api/analyze`
2. Route pre-processes: sorts wireframes by `captured_at`, builds compact event timeline
3. Selects up to 5 deduplicated screenshots (first chronologically distinct)
4. Builds Gemini multimodal prompt: system text → S1 image → S2 image … → task text
5. Tries models in order: `gemini-2.5-flash` → `gemini-2.0-flash` → API-listed extras
6. On 429: exits immediately, returns `{ quota_exhausted: true, retry_in_seconds }`
7. On success: parses JSON from response, client PATCHes session with `{ report: data }`

Output format: Italian-language forensic report (header, executive_summary, reconstructed_flow, error_analysis, ux_analysis, maestro_yaml).

---

## Tunable constants

See [`ios-sdk/TUNING.md`](ios-sdk/TUNING.md) for the complete table. Quick reference:

| What | Where | Default |
|---|---|---|
| Screenshot scale | `FlowyScreenshotCapture.swift` `.normal` case | 0.40 |
| Screenshot quality | `FlowyScreenshotCapture.swift` `.normal` case | 0.40 |
| Post-tap delay | `FlowyLogger.swift` `tapCaptureDelay` | 0.8 s |
| Post-scroll delay | `FlowyLogger.swift` `scrollCaptureDelay` | 0.5 s |
| Passive screen delay | `FlowyLogger.swift` `passiveScreenCaptureDelay` | 0.3 s |
| Capture rate-limit | `FlowyLogger.swift` throttle literal | 1.0 s |
| Passive scan debounce | `UIView+SubviewObserver.swift` `debounce` | 0.9 s |
| WF match tight-after | `wireframe-matcher.ts` `<= 5` literal | 5 s |
| WF match full window | `wireframe-matcher.ts` `<= 10` literal | 10 s |
| AI screenshots per call | `analyze/route.ts` `MAX_SCREENSHOTS` | 5 |
| AI primary model | `analyze/route.ts` `HARDCODED_FIRST[0]` | gemini-2.5-flash |

---

## Known constraints

- **Session storage is file-based** — `web/data/sessions/` directory, not a database. Fine for local/single-user use.
- **Gemini free tier** — quota resets per minute. `gemini-2.5-flash` is the most reliable model on the free tier (early 2026). `gemini-1.5-*` models have been removed from v1beta.
- **Session POST body can be large** — a 32-wireframe session is ~320 KB. Next.js default body limit is 1 MB; fine for now.
- **iOS build target is macOS for `swift build`** — actual iOS deployment is via Xcode + TestFlight.
- `forceFullExtraction: true` bypasses the 1.0 s rate-limit. Only use for events that genuinely need a fresh frame (taps, scrolls). Passive captures should go through the throttle.
