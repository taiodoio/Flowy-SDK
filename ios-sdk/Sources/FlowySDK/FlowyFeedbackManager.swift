import Foundation
#if canImport(UIKit)
import UIKit
import SwiftUI

@available(iOS 13.0, macOS 10.15, *)
@MainActor
public class FlowyFeedbackManager: NSObject {
    public static let shared = FlowyFeedbackManager()
    
    private var lastShakeTime: Date?
    private var isPresenting = false
    
    private override init() {
        super.init()
    }
    
    public func showFeedbackModal() {
        // Debounce: 2 seconds
        if let last = lastShakeTime, Date().timeIntervalSince(last) < 2.0 {
            return
        }
        // Also check if we are already presenting (though debounce usually covers it)
        if isPresenting { return }
        
        lastShakeTime = Date()
        
        // CRITICAL: Capture screen context (success/error messages) BEFORE covering it with the modal
        FlowyLogger.shared.performImmediateScan()
        
        guard let validWindow = findKeyWindow() else {
            print("[FlowySDK] Could not find key window to present feedback.")
            return
        }
        
        // Find top controller
        guard let topController = getTopViewController(from: validWindow.rootViewController) else {
            return
        }
        
        let feedbackView = FlowyFeedbackView(onSend: { [weak self] tag, comment in
            self?.submitFeedback(tag: tag, details: comment)
            self?.isPresenting = false
            FlowyLogger.shared.resumeMonitoring()
        }, onCancel: { [weak self] in
            self?.isPresenting = false
            FlowyLogger.shared.resumeMonitoring()
        })
        
        let hostingController = UIHostingController(rootView: feedbackView)
        hostingController.modalPresentationStyle = .formSheet
        hostingController.presentationController?.delegate = self
        topController.present(hostingController, animated: true)
        
        self.isPresenting = true
        FlowyLogger.shared.pauseMonitoring()
    }
    
    private func submitFeedback(tag: String, details: String?) {
        // Construct a structured comment
        var fullMessage = tag
        if let details = details {
            fullMessage += ": \(details)"
        }
        
        // Log to Flowy
        FlowyLogger.shared.logEvent(
            FlowyEvent(
                action: "USER_FEEDBACK",
                ocr_text: nil,
                coordinates: nil,
                screen_name: "FeedbackModal",
                comment: fullMessage
            )
        )
        print("[FlowySDK] Feedback sent: \(fullMessage)")
    }
    
    // MARK: - Helper Methods
    
    private func findKeyWindow() -> UIWindow? {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }
    
    private func getTopViewController(from controller: UIViewController?) -> UIViewController? {
        if let nav = controller as? UINavigationController {
            return getTopViewController(from: nav.visibleViewController)
        }
        if let tab = controller as? UITabBarController {
            return getTopViewController(from: tab.selectedViewController)
        }
        if let presented = controller?.presentedViewController {
            return getTopViewController(from: presented)
        }
        return controller
    }
}

// MARK: - Dismissal Delegate
@available(iOS 13.0, macOS 10.15, *)
extension FlowyFeedbackManager: UIAdaptivePresentationControllerDelegate {
    public nonisolated func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        Task { @MainActor in
            print("[FlowySDK] Feedback modal dismissed via gesture.")
            self.isPresenting = false
            FlowyLogger.shared.resumeMonitoring()
        }
    }
}
#endif
