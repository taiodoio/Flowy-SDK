
import Foundation
#if canImport(UIKit)
import UIKit

@MainActor
class FlowyLogger {
    static let shared = FlowyLogger()
    
    private let storage: FlowyStorage
    private let uploader: FlowyUploader
    
    // Cache the current screen name for context (updated by logScreenView)
    private var currentScreenName: String = "Unknown"
    
    private init() {
        self.storage = FlowyStorage()
        self.uploader = FlowyUploader(storage: self.storage)
        
        setupLifecycleObservations()
    }
    
    private func setupLifecycleObservations() {
        NotificationCenter.default.addObserver(self, selector: #selector(didEnterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
    }
    
    @objc private func didEnterBackground() {
        print("[Flowy] App entered background. Triggering upload...")
        uploader.triggerUpload()
    }
    
    func startMonitoring() {
        // Trigger swizzling once
        _ = UIApplication.swizzleSendAction
        _ = UIViewController.swizzleViewDidAppear
        _ = UIWindow.swizzleSendEvent
        print("[Flowy] Vision-based Auto-Capture started.")
        
        if let path = storage.sessionFileURL?.path {
            print("[Flowy] Log Path: \(path)")
        }
    }
    
    // MARK: - Vision Logging (New Core)
    
    /// Called by the Vision/OCR engine when a tap is processed
    /// Called by the Vision/OCR engine when a tap is processed
    func logVisionInteraction(text: String?, coordinates: CGPoint?, window: UIWindow?) {
        // Map CGPoint to FlowyEvent.Coordinate
        var coord: FlowyEvent.Coordinate? = nil
        var domNodes: [FlowyDomNode]? = nil
        var elementType: String? = nil

        if let p = coordinates {
            coord = FlowyEvent.Coordinate(x: Double(p.x), y: Double(p.y))
            
            // Capture DOM Context (Hybrid) - Prioritize Main Thread Capture
            if let win = window {
                 if Thread.isMainThread {
                     domNodes = FlowyTreeWalker.captureHierarchy(in: win)
                 } else {
                     DispatchQueue.main.sync {
                         domNodes = FlowyTreeWalker.captureHierarchy(in: win)
                     }
                 }
                
                // Hybrid Match: Find exact element at tap point
                if let nodes = domNodes, let match = FlowyHybridMatcher.findBestMatch(in: nodes, for: p) {
                    // Start simplified: Just identifying key interactive types
                    if match.className.contains("Switch") || 
                       match.className.contains("Button") || 
                       match.className.contains("TextField") ||
                       match.className.contains("Slider") {
                        elementType = match.className
                    }
                }
            }
        }
        
        var textToLog = text ?? "NIL"
        
        // Enhance text with Hybrid info
        if let type = elementType {
            textToLog = "\(textToLog) [\(type)]"
        }
        
        // Determine Action Type
        // If it's a secure field, keep SECURE_TAP. 
        // If it's a known interactive element, we might want to flag it? 
        // For now, keep "TAP", the AI will parse [UISwitch].
        let action = textToLog == "[SECURE_FIELD]" ? "SECURE_TAP" : "TAP"
        
        let event = FlowyEvent(
            action: action,
            ocr_text: textToLog,
            coordinates: coord,
            screen_name: self.currentScreenName
        )
        
        storage.appendEvent(event)
        print("[Flowy] Hybrid TAP: [\(textToLog)] at (\(Int(coord?.x ?? 0)), \(Int(coord?.y ?? 0))) on \(self.currentScreenName)")
    }
    
    // MARK: - Screen Lifecycle
    
    // Improved version called by Swizzler
    func logScreenView(vc: UIViewController) {
        // We delay slightly to allow layout to settle (though less critical for Vision, good for Screen Naming)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self, weak vc] in
            guard let self = self, let vc = vc else { return }
            
            // Deduce screen name using heuristics (still useful for context)
            let deducedName = FlowyScreenReader.deduceScreenName(viewController: vc)
            let finalScreenName = FlowyHeuristics.cleanScreenName(deducedName)
            
            self.currentScreenName = finalScreenName // Update state for future Taps
            
            self.logScreenViewEvent(name: finalScreenName)
            
            // Optional: We can still scan for error labels (hybrid approach), 
            // but the prompt emphasized Vision. Let's keep it minimal.
            self.scanVisibleStatus(in: vc.view)
        }
    }
    
    private func logScreenViewEvent(name: String) {
        let event = FlowyEvent(
            action: "SCREEN",
            ocr_text: nil,
            coordinates: nil,
            screen_name: name
        )
        storage.appendEvent(event)
        print("[Flowy] Screen: \(name)")
    }
    
    // MARK: - Heuristic Scans (Legacy/Hybrid)
    
    // Scan method to find "Success", "Error" labels on screen
    // This is still useful for auto-detecting state changes that aren't taps.
    // MARK: - Post-Action Scanning
    
    /// Triggered 1.0s after an action to check for dynamic updates (Toasts, Error Messages)
    func performAfterActionScan() {
        guard let window = getKeyWindow() else { return }
        
        // Capture Snapshot
        let bounds = window.bounds
        let renderer = UIGraphicsImageRenderer(bounds: bounds)
        let snapshot = renderer.image { ctx in
            window.drawHierarchy(in: bounds, afterScreenUpdates: false)
        }
        
        // Scan via Vision
        FlowyVisionEngine.shared.scanScreen(snapshot: snapshot) { strings in
            // Analyze strings for toast messages
            // Logic: If we find "Error", "Failed", "Success" that wasn't there before?
            // For MVP, just logging presence of keywords as events.
            
            for text in strings {
                if FlowyHeuristics.isErrorText(text) {
                     // Dedup: avoid spamming if the error is static.
                     // But for Toasts, simple logging is safer.
                     DispatchQueue.main.async {
                         self.logManualEvent(type: "ERROR", text: text)
                     }
                     return // Log first error found
                }
                
                // Success Detection
                if FlowyHeuristics.isSuccessText(text) {
                     DispatchQueue.main.async {
                         // Log as SUCCESS type
                         self.logManualEvent(type: "SUCCESS", text: text)
                     }
                     return // Log first success found
                }
            }
        }
    }
    
    private func getKeyWindow() -> UIWindow? {
        // iOS 13+ compatible helper
        return UIApplication.shared.windows.first { $0.isKeyWindow }
    }
    
    // MARK: - Heuristic Scans (Legacy/Hybrid)
    
    // Scan method to find "Success", "Error" labels on screen
    // This is still useful for auto-detecting state changes that aren't taps.
    private func scanVisibleStatus(in view: UIView) {
        // Keeping legacy logic as fallback or auxiliary
        var queue = [view]
        var scannedCount = 0
        
        while !queue.isEmpty && scannedCount < 50 { 
            let current = queue.removeFirst()
            scannedCount += 1
            
            if let label = current as? UILabel, let text = label.text, !text.isEmpty {
                if FlowyHeuristics.isErrorText(text) {
                     logManualEvent(type: "ERROR", text: text)
                     return 
                }
            }
            queue.append(contentsOf: current.subviews)
        }
    }
    
    // Helper to log non-vision events (Errors, etc)
    func logManualEvent(type: String, text: String?) {
        let event = FlowyEvent(
            action: type,
            ocr_text: text,
            coordinates: nil,
            screen_name: self.currentScreenName
        )
        storage.appendEvent(event)
        print("[Flowy] Event: \(type) - \(text ?? "nil")")
    }
    
    // MARK: - Compatibility / Public API Support
    
    func logScreenView(name: String) {
        self.currentScreenName = name
        logScreenViewEvent(name: name)
    }
    
    // Used by Flowy.trackError and Swizzler (legacy) -> Now redirected to logAction if needed or kept for compatibility
    func logAction(type: String, view: UIView?, touchPoint: CGPoint?, window: UIWindow?) {
        let timestamp = Date().timeIntervalSince1970
        
        // 1. Capture DOM (Main Thread - keeping it fast)
        var domSnapshot: [FlowyDomNode] = []
        if let win = window {
             domSnapshot = FlowyTreeWalker.captureHierarchy(in: win)
        } else if let win = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) {
             domSnapshot = FlowyTreeWalker.captureHierarchy(in: win)
        }
        
        // 2. Hybrid Placeholder
        // The OCR part is triggered via `logVisionInteraction` usually.
        // If this comes from Swizzling, we have the DOM.
        
        let event = FlowyEvent(
            action: type,
            ocr_text: nil, // Hybrid matcher would populate this if we had the image here
            coordinates: touchPoint.map { FlowyEvent.Coordinate(x: Double($0.x), y: Double($0.y)) },
            screen_name: self.currentScreenName
        )
        
        // Save to storage
        storage.appendEvent(event)
    }
    
    // Deprecated: interceptAction was related to hierarchy traversal. 
    // The new approach handles taps via UIApplication swizzling -> Vision.
    // We removed the call in Swizzle, so we can remove the method here or keep empty.
    func interceptAction(_ action: Selector, to target: Any?, from sender: Any?, for event: UIEvent?) {
        // No-op in Vision architecture
    }
}
#endif
