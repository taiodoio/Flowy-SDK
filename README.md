# Flowy - AI-Powered User Session Analysis

**Flowy** is a next-generation analytics platform that "sees" what your users see. It combines a lightweight iOS SDK with a powerful Web Dashboard to reconstruct user journeys using **Computer Vision**, **DOM Analysis**, and **Generative AI**.

![Flowy Dashboard](assets/dashboard-preview.png)

## ✨ Key Features

-   **👁️ Hybrid Analysis Engine**: Combines OCR (Vision) with View Hierarchy (DOM) to understand *exactly* what button was tapped, even in complex custom UIs.
-   **🧠 AI-Powered Insights**: Uses Gemini 1.5 Flash to generate forensic reports, flagging "Rage Taps", "Confusion", and "Critical Errors" automatically.
-   **🚇 Metro Map Visualization**: Visualizes the user journey as a clean subway map, highlighting Success (Green) vs. Error (Red) paths.
-   **🔒 Privacy First**: All processing starts on-device. Sensitive fields (passwords) are strictly redacted before they leave the phone.

---

## 🏗️ Architecture

The repository currently focuses on the mobile data capture engine:

| Component | Path | Description |
| :--- | :--- | :--- |
| **iOS SDK** | [`/ios-sdk`](./ios-sdk) | The data capture engine. Uses **Apple Vision Framework** and **DOM Swizzling** to log user interactions, screens, and errors efficiently and privately. |

---

## 🚀 Getting Started

### iOS Integration
To start tracking sessions in your iOS app, check the [iOS SDK Documentation](./ios-sdk/README.md).

**Quick Setup:**
1.  Add `FlowySDK` via Swift Package Manager.
2.  Initialize in your `App` or `AppDelegate`.
```swift
Flowy.configure(apiKey: "YOUR_API_KEY")
```

---

## 🤝 Contributing

1.  Fork the repo.
2.  Create a feature branch.
3.  Submit a Pull Request.

---

*Built with ❤️ by Flavio Montagner*
