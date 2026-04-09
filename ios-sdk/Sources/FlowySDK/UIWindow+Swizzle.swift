
import Foundation
#if canImport(UIKit)
import UIKit

/// Tracks touch start positions per touch identity to detect scroll vs tap.
/// Keyed by `UITouch` pointer so multi-touch is handled correctly.
/// MainActor-isolated: UIWindow events always arrive on the main thread.
@MainActor
private var touchStartLocations = NSMapTable<UITouch, NSValue>.weakToStrongObjects()

/// Maximum displacement (points) between touch-began and touch-ended
/// that still qualifies as a tap. Above this threshold = scroll/swipe, ignored.
private let tapMaxDisplacement: CGFloat = 12

extension UIWindow {
    static let swizzleSendEvent: Void = {
        let originalSelector = #selector(sendEvent(_:))
        let swizzledSelector = #selector(swizzled_sendEvent(_:))
        
        if let originalMethod = class_getInstanceMethod(UIWindow.self, originalSelector),
           let swizzledMethod = class_getInstanceMethod(UIWindow.self, swizzledSelector) {
            method_exchangeImplementations(originalMethod, swizzledMethod)
        }
    }()
    
    @objc func swizzled_sendEvent(_ event: UIEvent) {
        // 1. Shake Detection
        if event.type == .motion && event.subtype == .motionShake {
            FlowyFeedbackManager.shared.showFeedbackModal()
        }
        
        // 2. Touch Processing
        if event.type == .touches, let touches = event.allTouches {
            for touch in touches {
                switch touch.phase {
                case .began:
                    // Record start position for displacement calculation later
                    let point = touch.location(in: self)
                    touchStartLocations.setObject(NSValue(cgPoint: point), forKey: touch)
                case .ended:
                    let endPoint = touch.location(in: self)
                    let startValue = touchStartLocations.object(forKey: touch)
                    let startPoint = startValue?.cgPointValue ?? endPoint
                    touchStartLocations.removeObject(forKey: touch)

                    let dx = endPoint.x - startPoint.x
                    let dy = endPoint.y - startPoint.y
                    let displacement = sqrt(dx * dx + dy * dy)

                    guard displacement <= tapMaxDisplacement else {
                        // Large movement = scroll or swipe — log event + post-scroll screenshot
                        FlowyLogger.shared.logScrollInteraction(startPoint: startPoint, endPoint: endPoint)
                        break
                    }
                    handleTouchEnd(touch)
                case .cancelled:
                    touchStartLocations.removeObject(forKey: touch)
                default:
                    break
                }
            }
        }
        
        // 3. Call original
        swizzled_sendEvent(event)
    }
    
    private func handleTouchEnd(_ touch: UITouch) {
        // 1. Capture Snapshot IMMEDIATELY at 1x scale — OCR does not need retina quality.
        let bounds = self.bounds
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(bounds: bounds, format: format)
        let snapshot = renderer.image { ctx in
            self.drawHierarchy(in: bounds, afterScreenUpdates: false)
        }
        
        let tapPoint = touch.location(in: self)
        
        // 2. Background Task — ensure we have time to process even if app backgrounds
        var bgTask: UIBackgroundTaskIdentifier = .invalid
        bgTask = UIApplication.shared.beginBackgroundTask(withName: "FlowyTouchOCR") {
            UIApplication.shared.endBackgroundTask(bgTask)
        }
        
        // 3. Process Vision on background queue, deliver result on main thread
        let windowRef = self
        FlowyVisionEngine.shared.processTap(snapshot: snapshot, tapPoint: tapPoint) { recognizedText in
            DispatchQueue.main.async {
                let text = recognizedText ?? "Tap"
                FlowyLogger.shared.logVisionInteraction(text: text, coordinates: tapPoint, window: windowRef)
                UIApplication.shared.endBackgroundTask(bgTask)
            }
        }
    }
}
#endif
