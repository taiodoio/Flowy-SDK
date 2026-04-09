# FlowySDK for iOS

**FlowySDK** is a zero-instrumentation session-replay and analytics SDK. It automatically records user flows using **Computer Vision (OCR)**, **compressed screenshots**, and **selective DOM extraction** — no manual tagging needed.

---

## Requirements

| | Minimum |
|---|---|
| iOS | 13.0 |
| Swift | 5.9 |
| Xcode | 15.0 |

---

## Installation

Add `FlowySDK` via Swift Package Manager in Xcode (**File → Add Package Dependencies…**), paste the repo URL, set **Up to Next Major Version**.

> Working from source? Click **Add Local…** and select the `FlowySDK` folder.

---

## Setup

Call `Flowy.configure(apiKey:)` before any UI is presented.

**SwiftUI**

```swift
import SwiftUI
import FlowySDK

@main
struct YourApp: App {
    init() {
        Flowy.configure(apiKey: "YOUR_API_KEY")
    }
    var body: some Scene { WindowGroup { ContentView() } }
}
```

**UIKit**

```swift
import UIKit
import FlowySDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ app: UIApplication, didFinishLaunchingWithOptions _: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        Flowy.configure(apiKey: "YOUR_API_KEY")
        return true
    }
}
```

Auto-capture starts immediately — nothing else needed.

---

## Export

```swift
Flowy.shared.exportSession()
```

Creates `Documents/flowy_session_<timestamp>.json` — events + wireframes + screenshots in a single file. Individual part files are deleted on success.

---

## Retrieve the bundle

**Via Xcode (no setup required)**

Xcode → Window → Devices and Simulators → select device → gear icon → **Download Container…** → open `.xcappdata` → Show Package Contents → `AppData/Documents/`.

**Via Files app (requires Info.plist entries)**

| Key | Type | Value |
|---|---|---|
| `UIFileSharingEnabled` | Boolean | YES |
| `LSSupportsOpeningDocumentsInPlace` | Boolean | YES |

Add these to the **host app's** Info.plist (not the SDK). The bundle then appears in Files → On My iPhone → [App Name].

---

## Automatic capture

Once `Flowy.configure` is called, the SDK records:

| Event | Trigger | Capture |
|---|---|---|
| `SCREEN` | Every `viewDidAppear` | Screenshot + visual-diff dedup (t+0.3 s) |
| `TAP` | Touch end on key window | OCR + screenshot + **full DOM** (t+0.8 s, `forceFullExtraction: true`) |
| `SCROLL` | Swipe > 12 pt displacement | Screenshot (t+0.5 s, `forceFullExtraction: true`) |
| `ERROR` / `SUCCESS` post-tap | 1.5 s after each tap — OCR scan | Screenshot + **full DOM** if text matched |
| `ERROR` / `SUCCESS` passive | New view added to key window | Screenshot + **full DOM** immediately (debounce 0.9 s) |
| `SECURE_TAP` | Tap on a secure field | Coordinates only — no text captured |

---

## Manual API

```swift
// Log a custom error
Flowy.shared.trackError(description: "Payment Gateway Timeout")

// Log a screen manually (useful for non-UIViewController screens)
Flowy.shared.trackScreen(name: "CheckoutWebView")

// Capture wireframe — full DOM extraction
Flowy.shared.captureWireframe(screenName: "OnboardingStep2")

// Capture wireframe — attach existing screenshot, skip DOM extraction (lightweight)
Flowy.shared.captureWireframe(screenName: "OnboardingStep2", screenshotBase64: base64String)

// Force full DOM extraction even when screenshot is attached
Flowy.shared.captureWireframe(screenName: "OnboardingStep2", screenshotBase64: base64String, forceFullExtraction: true)

// Export — keep individual wireframe files after merge (default: false)
Flowy.shared.exportSession(deleteWireframeParts: false)
```

---

## Session bundle format

### Event

```json
{
  "action": "TAP",
  "ocr_text": "Add to Cart [UIButton]",
  "coordinates": { "x": 195.0, "y": 720.0 },
  "screen_name": "Product Detail",
  "timestamp": 1711234567.89,
  "deviceInfo": { "model": "iPhone", "osVersion": "17.4" }
}
```

| `action` | Meaning |
|---|---|
| `SCREEN` | Screen became visible |
| `TAP` | Tap with OCR-identified text |
| `SECURE_TAP` | Tap on a password field (text redacted) |
| `SCROLL` | Scroll gesture > 12 pt; post-scroll screenshot follows |
| `ERROR` | Error text detected on screen |
| `SUCCESS` | Success/confirmation text detected |

### Wireframe entry

```json
{
  "screen_name": "dashboard_3",
  "captured_at": 1711234568.12,
  "tree": {
    "class_name": "Button",
    "frame": { "x": 16, "y": 740, "width": 358, "height": 50 },
    "text": "Continue",
    "children": null
  },
  "screenshot_base64": "<base64 JPEG>"
}
```

| Field | Description |
|---|---|
| `screen_name` | Sequential label — ordering only, not identity |
| `captured_at` | Unix timestamp (seconds) of capture |
| `tree` | Full view tree (key events) or placeholder node (passive captures) |
| `screenshot_base64` | JPEG at 40% scale, ~18–30 KB. Present for all automatic captures |

When `screenshot_base64` is present, the dashboard renders it as the visual background with heatmap overlay. When absent, wireframe rectangles are drawn from the `tree`.

---

## Capture pipeline

```
Touch ends on UIWindow
  │
  ├─ UIGraphicsImageRenderer snapshot (main thread)      → OCR input
  ├─ Vision OCR (background) → text + FlowyHeuristics
  ├─ ViewHierarchyExtractor (main thread)                → full DOM on TAP/ERROR/SUCCESS
  ├─ FlowyScreenshotCapture                              → compressed JPEG, always
  └─ Visual-diff dedup (passive only: skip if size delta < 8%)
```

### Key timing constants

All delay values live in `FlowyLogger.swift` and `UIView+SubviewObserver.swift`. See [`TUNING.md`](./TUNING.md) for the full table and how to adjust them.

| Constant | Default | File |
|---|---|---|
| `tapCaptureDelay` | 0.8 s | `FlowyLogger.swift` |
| `scrollCaptureDelay` | 0.5 s | `FlowyLogger.swift` |
| `passiveScreenCaptureDelay` | 0.3 s | `FlowyLogger.swift` |
| `suppressPassiveCaptureAfterTapWindow` | 1.0 s | `FlowyLogger.swift` |
| Capture rate-limit (throttle) | 1.0 s | `FlowyLogger.swift` |
| Passive scan debounce | 0.9 s | `UIView+SubviewObserver.swift` |
| Passive scan minimum interval | 1.8 s | `UIView+SubviewObserver.swift` |

### Screenshot quality

| Parameter | Normal profile | Safe profile | File |
|---|---|---|---|
| `scaleFactor` | 0.40 | 0.30 | `FlowyScreenshotCapture.swift` |
| `jpegQuality` | 0.40 | 0.35 | `FlowyScreenshotCapture.swift` |
| Visual-diff dedup threshold | 8% | — | `FlowyLogger.swift` |

`normal` is the default. `safe` is switched to automatically under bursty activity. Call `FlowyScreenshotCapture.setQualityProfile(.safe)` to force it.

### Wireframe matching (dashboard)

The dashboard matches each event to a wireframe by **timestamp proximity**:

1. **TAP / SCROLL** → prefer wireframe captured ≤5 s *after* the event (destination screen after navigation). If none, widen to ≤10 s after.
2. **SCREEN / ERROR / SUCCESS** → prefer wireframe captured ≤10 s *before* the event.
3. Fallback: globally closest wireframe by timestamp.
4. Last resort: fuzzy screen-name match.

---

## Privacy

| Concern | Handling |
|---|---|
| Passwords | Secure fields logged as `[SECURE_FIELD]` — no text captured |
| On-device processing | All OCR runs on-device via Apple Vision. No images sent during capture |
| Screenshots | Stored locally; only transmitted when you manually upload the bundle |
| DOM tree | Contains view structure and visible text only |

---

## Troubleshooting

**Screens still as splash screen** — `Flowy.configure` called too late. Move it before the first `viewDidAppear`.

**Wrong screenshot in dashboard** — Upload the full `flowy_session_*.json`. The dashboard needs `captured_at` timestamps to do timestamp-based matching.

**"No key window found"** — `captureWireframe()` called before window hierarchy was ready. Use `viewDidAppear` or `.onAppear`.

**Files not visible in Files app** — Both `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace` must be `YES` in the **host app's** `Info.plist`.
