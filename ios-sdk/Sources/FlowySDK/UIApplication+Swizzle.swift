import Foundation
#if canImport(UIKit)
import UIKit

extension UIApplication {
    static let swizzleSendAction: Void = {
        let originalSelector = #selector(sendAction(_:to:from:for:))
        let swizzledSelector = #selector(swizzled_sendAction(_:to:from:for:))
        
        guard let originalMethod = class_getInstanceMethod(UIApplication.self, originalSelector),
              let swizzledMethod = class_getInstanceMethod(UIApplication.self, swizzledSelector) else {
            return
        }
        
        method_exchangeImplementations(originalMethod, swizzledMethod)
    }()
    
    @objc func swizzled_sendAction(_ action: Selector, to target: Any?, from sender: Any?, for event: UIEvent?) {
        // 1. Call original implementation immediately
        swizzled_sendAction(action, to: target, from: sender, for: event)
        
        // 2. SAFETY CHECK: Privacy
        // If the sender or active focus is a secure field, DO NOT CAPTURE VISUALS
        if let senderView = sender as? UIView {
             if let textField = senderView as? UITextField, textField.isSecureTextEntry {
                 // Log redacted event immediately
                 FlowyLogger.shared.logVisionInteraction(text: "[SECURE_FIELD]", coordinates: nil, window: self.keyWindow)
                 return
             }
        }
        
        // 3. CAPTURE CONTEXT IMMEDIATELY (Main Thread)
        // We need the window state NOW before the action potentially changes the UI (navigation etc)
        guard let window = self.keyWindow else { return }
        
        // Capture Snapshot
        // 'drawHierarchy' is safer for capturing accurate screen state including gl/layers than simple 'snapshotView'
        // But for speed, UIGraphicsImageRenderer is standard.
        // We capture even if we might discard it later.
        let bounds = window.bounds
        let renderer = UIGraphicsImageRenderer(bounds: bounds)
        let snapshot = renderer.image { ctx in
            window.drawHierarchy(in: bounds, afterScreenUpdates: false)
        }
        
        // Get Tap Location
        var tapPoint: CGPoint? = nil
        if let touches = event?.allTouches, let touch = touches.first {
            tapPoint = touch.location(in: window)
        }
        
        guard let finalTapPoint = tapPoint else { return } // No tap location? Can't hit test.
        
        // 4. BACKGROUND PROCESSING
        // Start a background task to ensure we finish OCR even if app suspends
        var bgTask: UIBackgroundTaskIdentifier = .invalid
        bgTask = self.beginBackgroundTask(withName: "FlowyOCR") {
            // Expiration Handler
            self.endBackgroundTask(bgTask)
        }
        
        FlowyVisionEngine.shared.processTap(snapshot: snapshot, tapPoint: finalTapPoint) { recognizedText in
            // Back on whatever queue (likely background), send to logger
            // Note: 'window' captured from main thread context above
            FlowyLogger.shared.logVisionInteraction(text: recognizedText, coordinates: finalTapPoint, window: window)
            
            // Finish task
            self.endBackgroundTask(bgTask)
        }
    }
}
#endif
