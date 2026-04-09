# Flowy — AI-Powered User Session Analysis

![Flowy Hero](assets/flowy-hero.png)

**Flowy** is a zero-instrumentation session-replay and analytics platform. It combines lightweight mobile SDKs with a web dashboard to reconstruct user journeys using **Computer Vision (OCR)**, **selective DOM extraction**, **compressed screenshots**, and **Generative AI** — without any manual tagging.

---

## ✨ Key Features

- **👁️ Hybrid Capture Engine** — OCR always runs; full DOM extraction triggers only on key events (taps, errors, success confirmations); screenshots capture every relevant screen state
- **📸 Screenshot Embedding** — Every meaningful state is captured as a compressed JPEG (scale `0.40`, quality `0.40`, ~18–30 KB) embedded directly in the bundle. The dashboard renders them as visual backgrounds with heatmap overlays
- **🔁 Session Replay** — Step-by-step event playback with timestamp-based wireframe matching: post-tap/scroll screenshots prefer the frame captured ≤5 s *after* the event (destination screen); SCREEN/ERROR/SUCCESS prefer the frame ≤10 s *before*
- **🔥 Tap Heatmap** — All taps overlaid per screen, sorted by volume. Absolute color scale: green = 1–3, yellow = 4–6, orange = 7–8, red = 9+
- **🧠 AI Analysis** — Gemini multimodal report: reconstructed user flow, error/success analysis, UX heuristics, automated Maestro YAML. Up to 5 representative screenshots are selected from the session and sent alongside the full event timeline
- **🔒 Privacy First** — All OCR and analysis are on-device. Secure fields (passwords, credit cards) are redacted to `[SECURE_FIELD]` before anything is recorded
- **📦 Single-file Export** — Events + wireframes + screenshots merged into one `flowy_session_*.json` bundle

---

## 🏗️ Architecture

| Component | Path | Description |
|---|---|---|
| **iOS SDK** | [`/ios-sdk`](./ios-sdk) | Hybrid capture: Apple Vision OCR + DOM swizzling + compressed screenshots. Works with UIKit and SwiftUI NavigationStack |
| **Android SDK** | [`/android-sdk`](./android-sdk) | Android capture: ML Kit OCR, lifecycle/window interception, UI hierarchy matching |
| **Web Dashboard** | [`/web`](./web) | Next.js dashboard: session upload, replay, tap heatmap, AI analysis report |

For all tunable constants (capture timings, screenshot quality, AI model, screenshot count) see [`ios-sdk/TUNING.md`](./ios-sdk/TUNING.md).

---

## 🚀 Getting Started — iOS

### 1. Install

Add `FlowySDK` to your project via Swift Package Manager in Xcode (**File → Add Package Dependencies…**).

### 2. Initialize

```swift
import FlowySDK

@main
struct YourApp: App {
    init() {
        Flowy.configure(apiKey: "YOUR_API_KEY")
    }
    var body: some Scene { WindowGroup { ContentView() } }
}
```

Auto-capture starts immediately — no additional instrumentation needed.

### 3. Export the session

At the end of a test flow, export the full session bundle:

```swift
Flowy.shared.exportSession()
```

This merges the event log + all wireframes and screenshots into a single file:

```
Documents/flowy_session_<timestamp>.json
```

### 4. Upload to the dashboard

Retrieve the bundle via **Xcode → Window → Devices and Simulators → Download Container**, then drag-and-drop `flowy_session_*.json` into the Flowy web dashboard.

---

## 🚀 Getting Started — Android

### 1. Install

Add the `flowy-sdk` module from [`/android-sdk`](./android-sdk) to your app project.

### 2. Initialize

```kotlin
import com.flowy.sdk.Flowy
import com.flowy.sdk.FlowyOptions

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Flowy.configure(
            context = this,
            apiKey = "YOUR_API_KEY",
            options = FlowyOptions(uploadUrl = "https://your-backend.example.com/flowy/events")
        )
    }
}
```

---

## 📦 Session Bundle Format

The export file (`flowy_session_<timestamp>.json`) contains:

```json
{
  "version": 1,
  "exported_at": 1711234567.89,
  "events": [
    {
      "action": "TAP",
      "ocr_text": "Add to Cart [UIButton]",
      "coordinates": { "x": 195.0, "y": 720.0 },
      "screen_name": "Product Detail",
      "timestamp": 1711234567.89
    }
  ],
  "wireframes": [
    {
      "screen_name": "dashboard_3",
      "captured_at": 1711234568.12,
      "tree": { "class_name": "Button", "frame": { "x": 16, "y": 740, "width": 358, "height": 50 }, "text": "Continue", "children": null },
      "screenshot_base64": "<base64 JPEG>"
    }
  ]
}
```

| `action` | Meaning |
|---|---|
| `SCREEN` | Screen became visible |
| `TAP` | User tap with OCR-identified text |
| `SECURE_TAP` | Tap on a password field (text redacted) |
| `SCROLL` | Scroll gesture detected (displacement > 12 pt); generates a post-scroll screenshot |
| `ERROR` | Error text detected on screen |
| `SUCCESS` | Success/confirmation text detected |

---

## 🌐 Web Dashboard Features

| Feature | Description |
|---|---|
| **Session Upload** | Drag-and-drop `flowy_session_*.json` bundles |
| **Session Replay** | Step through every event with the matched screenshot; SCROLL shown with ↕ icon |
| **Tap Heatmap** | Screens sorted by tap count; absolute color scale (not relative) |
| **AI Report** | Gemini multimodal analysis: reconstructed flow, errors, UX heuristics, Maestro YAML |
| **User Flow** | Reconstructed narrative of the full session journey |

---

## 🧪 Run The Dashboard Locally

From the [`/web`](./web) folder:

```bash
npm install
printf 'GEMINI_API_KEY=your_key_here\n' > .env.local
npm run dev
```

Then open `http://localhost:3000` and upload a `flowy_session_*.json` bundle.

Notes:

- `.env.local` is intentionally ignored and must not be committed
- Uploaded sessions are stored locally in `web/data/sessions/`
- The current dashboard uses local file storage, not a hosted database

---

## 🤝 Contributing

1. Fork the repo.
2. Create a feature branch.
3. Submit a Pull Request.

---

*Built with ❤️ by Flavio Montagner*

