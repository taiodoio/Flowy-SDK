
import Foundation
#if canImport(UIKit)
import UIKit

extension UIWindow {
    static let swizzleSendEvent: Void = {
        let originalSelector = #selector(sendEvent(_:))
        let swizzledSelector = #selector(swizzled_sendEvent(_:))
        
        guard let originalMethod = class_getInstanceMethod(UIWindow.self, originalSelector),
              let swizzledMethod = class_getInstanceMethod(UIWindow.self, swizzledSelector) else {
            return
        }
        
        method_exchangeImplementations(originalMethod, swizzledMethod)
    }()
    
    @objc func swizzled_sendEvent(_ event: UIEvent) {
        // 1. Processing Logic (Before or After? Usually before to capture state)
        if event.type == .touches, let touches = event.allTouches {
            // We are looking for the *end* of a touch (Tap)
            // We only care about the primary interaction
            if let touch = touches.first, touch.phase == .ended {
                handleTouchEnd(touch)
            }
        }
        
        // 2. Call original
        swizzled_sendEvent(event)
    }
    
    private func handleTouchEnd(_ touch: UITouch) {
        // Filter out secure inputs explicitly if possible?
        // Logic handled in Vision Engine (Privacy Check) or Logger.
        
        // 1. Capture Snapshot IMMEDIATELY
        // We are on Main Thread.
        let bounds = self.bounds
        let renderer = UIGraphicsImageRenderer(bounds: bounds)
        let snapshot = renderer.image { ctx in
            self.drawHierarchy(in: bounds, afterScreenUpdates: false)
        }
        
        let tapPoint = touch.location(in: self)
        
        // 2. Background Task Validation
        // Ensure we have time to process
        var bgTask: UIBackgroundTaskIdentifier = .invalid
        bgTask = UIApplication.shared.beginBackgroundTask(withName: "FlowyTouchOCR") {
            UIApplication.shared.endBackgroundTask(bgTask)
        }
        
        // 3. Process Vision
        // Capture strong ref to window for logging context
        let windowRef = self
        
        FlowyVisionEngine.shared.processTap(snapshot: snapshot, tapPoint: tapPoint) { recognizedText in
            if let text = recognizedText {
                // Log it with window context
                FlowyLogger.shared.logVisionInteraction(text: text, coordinates: tapPoint, window: windowRef)
                
                // 4. Auto-Scan for Dynamic Changes (Toasts etc)
                // Schedule a scan 1.0s later to see if the UI changed to an Error/Success state
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    FlowyLogger.shared.performAfterActionScan()
                }
            } else {
                 // Even if no text, we might want to log "Tap" at coordinates?
                 // For now, let's skip silent taps to reduce noise, OR log generic "Tap"
                 FlowyLogger.shared.logVisionInteraction(text: "Tap", coordinates: tapPoint, window: windowRef)
            }
            
            UIApplication.shared.endBackgroundTask(bgTask)
        }
    }
}
#endif
