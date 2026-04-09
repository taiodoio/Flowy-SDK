import Foundation
#if canImport(UIKit)
import UIKit
#endif

@MainActor
public class Flowy {
    // Singleton instance for manual tracking
    public static let shared = Flowy()
    
    private init() {}
    
    // Singleton entry point
    public static func configure(apiKey: String) {
        // API Key can be stored for future uploads
        print("[Flowy] Configured with API Key: \(apiKey)")
        
        #if canImport(UIKit)
        // Start the logger magic
        FlowyLogger.shared.startMonitoring()
        #endif
    }
    
    // Public API for tracking errors
    public func trackError(description: String) {
        #if canImport(UIKit)
        FlowyLogger.shared.logManualEvent(type: "ERROR", text: description)
        #endif
    }
    
    // Public API for tracking screens manually if needed
    public func trackScreen(name: String) {
        #if canImport(UIKit)
        FlowyLogger.shared.logScreenView(name: name)
        #endif
    }

    // MARK: - Session Export

    /// Merges the session event log and all captured wireframes into a single
    /// `flowy_session_<timestamp>.json` file in the app's Documents directory.
    ///
    /// - Parameter deleteWireframeParts: If `true`, individual per-screen wireframe JSON
    ///   files are deleted after a successful merge. Defaults to `false`.
    public func exportSession(deleteWireframeParts: Bool = false) {
        #if canImport(UIKit)
        print("[Flowy] 📦 exportSession() called")
        FlowyLogger.shared.buildExport(deleteWireframeParts: deleteWireframeParts)
        #endif
    }

    // MARK: - Wireframe Capture

    /// Captures the current screen's view hierarchy and saves it as a structured JSON wireframe
    /// to the app's Documents/Wireframes/ directory (visible in the Files app).
    ///
    /// UI reading happens on the MainActor (this method); encoding and file I/O
    /// are dispatched to a background queue inside `FlowyWireframeSaver`.
    ///
    /// - Parameter screenName: Used as the JSON filename prefix. Defaults to "screen".
    ///
    /// **Host app Info.plist requirements** (to make files visible in the Files app):
    /// - `UIFileSharingEnabled = YES`
    /// - `LSSupportsOpeningDocumentsInPlace = YES`
    public func captureWireframe(screenName: String = "screen", screenshotBase64: String? = nil, forceFullExtraction: Bool = false) {
        #if canImport(UIKit)
        print("[Flowy] 🎬 captureWireframe() called with screenName: \(screenName), forceFullExtraction: \(forceFullExtraction)")
        
        let rootNode: ViewNode
        
        if forceFullExtraction || screenshotBase64 == nil {
            // Full extraction: on key events (tap/error/success) or no screenshot available
            let extractor = ViewHierarchyExtractor()
            guard let extracted = extractor.extract() else {
                print("[Flowy] ❌ captureWireframe: extraction returned nil. View hierarchy is empty or key window not found.")
                return
            }
            rootNode = extracted
            print("[Flowy] ✓ Extraction succeeded")
        } else {
            // Screenshot provided + not forcing extraction: use lightweight placeholder (performance optimization)
            print("[Flowy] 📸 Screenshot provided, skipping extraction for passive capture (optimized)")
            rootNode = ViewNode(
                className: "ScreenshotCapture",
                frame: ViewNodeFrame(CGRect(x: 0, y: 0, width: 390, height: 844)),
                text: nil,
                children: []
            )
        }
        
        print("[Flowy] ✓ Passing to saver...")
        FlowyWireframeSaver().save(node: rootNode, screenName: screenName, screenshotBase64: screenshotBase64)
        #endif
    }
}
