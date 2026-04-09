# Flowy — Tuning Reference

This file is the single source of truth for every adjustable constant in the Flowy system.
Change a value here → update the corresponding source file → rebuild/redeploy.

---

## iOS SDK — Screenshot Quality

**File:** `ios-sdk/Sources/FlowySDK/FlowyScreenshotCapture.swift`

| Parameter | Normal profile | Safe profile |
|---|---|---|
| `scaleFactor` | **0.40** | 0.30 |
| `jpegQuality` | **0.40** | 0.35 |

`normal` is the active default.
`safe` is a fallback for bursty activity (more events per second than the rate-limit allows).

**Resulting image size (iPhone 390 pt wide):**

| Profile | Pixel width | Pixel height | Typical file size |
|---|---|---|---|
| normal | ~156 px | ~338 px | 18–30 KB |
| safe | ~117 px | ~253 px | 10–18 KB |

**Trade-offs:**

- Higher `scaleFactor` → sharper replay, better OCR, larger bundles (~700–800 KB for a 5-min session vs ~400 KB at 0.25/0.35)
- Lower values → smaller bundles, faster encoding, slightly blurrier replay

**How to change:**
```swift
// in FlowyScreenshotCapture.swift — QualityProfile enum
case .normal: return 0.40   // ← adjust this
```

**How to force safe profile at runtime:**
```swift
FlowyScreenshotCapture.setQualityProfile(.safe)
```

---

## iOS SDK — Visual-Diff Deduplication

**File:** `ios-sdk/Sources/FlowySDK/FlowyLogger.swift`

Passive captures (viewDidAppear, didAddSubview) are compared by JPEG byte size.
If the new frame differs from the previous by less than the threshold, it is skipped.

| Parameter | Value | Variable |
|---|---|---|
| Dedup threshold | **8%** | `deduplicationThreshold` in `captureScreenshot` |

- Increase (e.g. 15%) → fewer duplicate frames, may miss subtle UI changes
- Decrease (e.g. 3%) → saves more frames, larger bundles

---

## iOS SDK — Capture Timings

### FlowyLogger.swift

| Constant | Value | Effect |
|---|---|---|
| `tapCaptureDelay` | **0.8 s** | Delay after tap before screenshot + DOM — allows navigation animations to complete |
| `scrollCaptureDelay` | **0.5 s** | Delay after scroll end before screenshot — allows content to settle |
| `passiveScreenCaptureDelay` | **0.3 s** | Delay after viewDidAppear before screenshot — enough for screen transition |
| `suppressPassiveCaptureAfterTapWindow` | **1.0 s** | Suppresses viewDidAppear captures for 1 s after a tap — avoids duplicate captures when a tap causes navigation |
| Capture rate-limit (throttle) | **1.0 s** | Minimum gap between any two non-forced captures. Bypassed by `forceFullExtraction: true` |

> **Rule:** Post-tap and post-scroll captures always use `forceFullExtraction: true`, bypassing the rate-limit. Only passive/viewDidAppear captures are subject to throttling.

### UIView+SubviewObserver.swift

| Constant | Value | Effect |
|---|---|---|
| `debounce` | **0.9 s** | Delay after a subview addition before running the OCR scan — allows transient views to finish rendering |
| `minimumScanInterval` | **1.8 s** | Minimum time between two passive scans — prevents rapid sequential toasts from flooding the log |

---

## Web Dashboard — Wireframe Matching

**File:** `web/src/lib/wireframe-matcher.ts`

Each event is matched to the most relevant wireframe by timestamp proximity.

| Parameter | Value | Variable |
|---|---|---|
| TAP/SCROLL tight-after window | **5 s** | `<= 5` in `tightAfter` filter |
| TAP/SCROLL full-after window | **10 s** | `<= 10` in `afterWindow` filter |
| SCREEN/ERROR/SUCCESS before window | **10 s** | `<= 10` in `beforeWindow` filter |

**Strategy per action type:**

| Action | First tries | Then fallback |
|---|---|---|
| `TAP`, `SCROLL` | Wireframe ≤5 s *after* event (destination screen) | ≤10 s after → most-recent before → global closest |
| `SCREEN`, `ERROR`, `SUCCESS` | Most-recent wireframe ≤10 s *before* event | ≤10 s after → global closest |
| Any | Global closest by `|capturedAt - eventTime|` | Fuzzy screen-name match |

**When to adjust:**
- Navigation animations take longer than expected → increase the tight-after window from 5 s to 8 s
- Events are matched to screens from a previous flow → narrow the before-window from 10 s to 5 s

---

## Web Dashboard — AI Analysis (Gemini)

**File:** `web/src/app/api/analyze/route.ts`

### Model selection

| Constant | Value | Purpose |
|---|---|---|
| `HARDCODED_FIRST` | `["gemini-2.5-flash", "gemini-2.0-flash"]` | Tried in order before any API-listed models |
| `extraPatterns` | `["gemini-2.5-", "gemini-2.0-flash"]` | Prefixes used to append additional API-listed models |
| `maxDuration` | **90 s** | Next.js/Vercel maximum function execution time |

The model list is resolved at request time:
1. `HARDCODED_FIRST` models are tried first
2. Any API-listed model whose name **starts with** one of `extraPatterns` is appended
3. Models are tried in sequence; on 429 the loop stops immediately (quota is shared)

**To switch models:** edit `HARDCODED_FIRST` in `route.ts`.

### Screenshot selection for AI

| Constant | Value | Variable |
|---|---|---|
| Maximum screenshots per call | **5** | `MAX_SCREENSHOTS` |
| Dedup key length | **40 chars** of base64 prefix | `b64.substring(0, 40)` |

**Current selection strategy:** first 5 chronologically distinct frames (by b64 prefix).

**Alternative strategies (not yet implemented):**

| Strategy | How | Best for |
|---|---|---|
| Evenly spread | Pick frames at indices 0%, 25%, 50%, 75%, 100% of timeline | Long sessions with many unique screens |
| Event-anchored | Pick frame closest to each unique action type (first TAP, first ERROR, last frame, etc.) | Sessions with critical moments spread across the timeline |
| Highest TAP density | Pick frames that have the most events mapped to them | Heatmap-heavy analysis |

To increase the cap (e.g. on a paid API tier): change `MAX_SCREENSHOTS = 5` to a higher value. Each screenshot is ~2–8 KB of base64 → 10 screenshots ≈ +50 KB of request body, well within Gemini's context limit.

### Quota handling

| Check | Logic |
|---|---|
| 429 detection | `msg.toLowerCase()` includes `"429"`, `"too many requests"`, or `"quota"` |
| On 429 | Loop exits immediately, returns `quota_exhausted: true` + `retry_in_seconds` parsed from the error message |
| Retry seconds parsing | Regex `(\d+)(?:\.\d+)?s` or `retry[^\d]*(\d+)` applied to the raw error string |

---

## Summary — Quick Reference

| What | File | Key | Current value |
|---|---|---|---|
| Screenshot scale | `FlowyScreenshotCapture.swift` | `scaleFactor` | 0.40 |
| Screenshot quality | `FlowyScreenshotCapture.swift` | `jpegQuality` | 0.40 |
| Dedup threshold | `FlowyLogger.swift` | threshold literal | 8% |
| Post-tap delay | `FlowyLogger.swift` | `tapCaptureDelay` | 0.8 s |
| Post-scroll delay | `FlowyLogger.swift` | `scrollCaptureDelay` | 0.5 s |
| Passive screen delay | `FlowyLogger.swift` | `passiveScreenCaptureDelay` | 0.3 s |
| Post-tap suppression window | `FlowyLogger.swift` | `suppressPassiveCaptureAfterTapWindow` | 1.0 s |
| Capture rate-limit | `FlowyLogger.swift` | throttle literal | 1.0 s |
| Passive scan debounce | `UIView+SubviewObserver.swift` | `debounce` | 0.9 s |
| Passive scan min interval | `UIView+SubviewObserver.swift` | `minimumScanInterval` | 1.8 s |
| WF match tight-after window | `wireframe-matcher.ts` | `<= 5` literal | 5 s |
| WF match full window | `wireframe-matcher.ts` | `<= 10` literal | 10 s |
| AI screenshots per call | `analyze/route.ts` | `MAX_SCREENSHOTS` | 5 |
| AI primary model | `analyze/route.ts` | `HARDCODED_FIRST[0]` | gemini-2.5-flash |
| Vercel function timeout | `analyze/route.ts` | `maxDuration` | 90 s |
