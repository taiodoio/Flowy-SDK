# FlowySDK (iOS)

**FlowySDK** is a next-generation analytics tool that "sees" what your users see. Instead of relying on brittle view IDs or manual tagging, Flowy uses **Computer Vision (OCR)** and **AI** to automatically track user flows, interactions, and dynamic UI states (like Toasts/Errors) without invasive code changes.

## 🚀 Features

- **👁️ Vision-Based Tracking**: Captures screen text using Apple's Vision framework. Tapping "Add to Cart" logs "Add to Cart", regardless of the underlying view structure (SwiftUI, UIKit, ReactNative, Flutter).
- **🧠 Hybrid Analysis**: Combines Vision OCR with the DOM hierarchy to pinpoint exactly which UI element was tapped.
- **✅ SwiftUI Compatible**: Works seamlessly with SwiftUI Buttons and Gestures via global touch interception.
- **🛡️ Privacy First**: Automatically skips OCR on secure fields (passwords, credit cards).
- **🔥 Dynamic State Detection**: Automatically detects transient UI states like **Error Toasts**, Success Messages, or Alerts appearing after an action.
- **🔋 Background Safe**: Ensures critical events are captured even if the user immediately backgrounds the app.

---

## 📦 Installation

FlowySDK is distributed as a Swift Package.

### 1. Add Package
1.  Open your project in Xcode.
2.  Go to **File > Add Package Dependencies...**
3.  Enter the repository URL (or local path) of FlowySDK.
4.  Add `FlowySDK` to your App Target.

---

## 🛠️ Configuration

Initialize the SDK as early as possible in your app lifecycle.

### SwiftUI (`App` Struct)

```swift
import SwiftUI
import FlowySDK

@main
struct YourApp: App {
    init() {
        // 🚀 Initialize Flowy
        Flowy.configure(apiKey: "YOUR_API_KEY")
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### UIKit (`AppDelegate`)

```swift
import UIKit
import FlowySDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // 🚀 Initialize Flowy
        Flowy.configure(apiKey: "YOUR_API_KEY")
        
        return true
    }
}
```

---

## 📖 How It Works

1.  **Auto-Capture**: The SDK automatically swizzles `UIWindow` and `UIApplication` to detect every touch.
2.  **Vision Analysis**: On every tap, it silently captures a snapshot and uses Neural Text Recognition (OCR) to identify the element under the user's finger (e.g., "Checkout", "Settings").
3.  **Proximity Search**: Precision isn't required. Use smart proximity search to match icons to nearby text labels.
4.  **Logging**: Data is stored locally in `flowy_session.json` (Documents directory) and persisted across sessions.

### Manual Logging (Optional)

While Flowy is automated, you can manually log custom errors or screens if needed:

```swift
// Force log a specific error
Flowy.shared.trackError(description: "Payment Gateway Timeout")

// Force log a specific screen view
Flowy.shared.trackScreen(name: "CheckoutWebView")
```

---

## 🔒 Privacy

Flowy respects user privacy by design:
- **Secure Fields**: Taps on `SecureField` (passwords) are redacted (`[SECURE_FIELD]`).
- **Local Processing**: OCR happens on-device using Apple's Vision framework.

---

## 📊 Viewing Data

1.  Run your app in the Simulator/Device.
2.  Interact with it (Tap buttons, trigger errors).
3.  Retrieve the `flowy_session.json` log from the app's Documents directory.
4.  Upload it to the **Flowy Web Dashboard** to see the visualized user journey node graph.
