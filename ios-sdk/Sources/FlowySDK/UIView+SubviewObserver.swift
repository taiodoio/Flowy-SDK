import Foundation
#if canImport(UIKit)
import UIKit

extension UIView {
    static let swizzleDidAddSubview: Void = {
        let originalSelector = #selector(didAddSubview(_:))
        let swizzledSelector = #selector(flowy_didAddSubview(_:))
        guard
            let original = class_getInstanceMethod(UIView.self, originalSelector),
            let swizzled = class_getInstanceMethod(UIView.self, swizzledSelector)
        else { return }
        method_exchangeImplementations(original, swizzled)
    }()

    @objc func flowy_didAddSubview(_ subview: UIView) {
        // Call original
        flowy_didAddSubview(subview)

        // Capture additions on UIWindow and common key-window containers
        // (some frameworks present banners/toasts inside overlay containers).
        let parentClassName = NSStringFromClass(type(of: self))
        let containerHints = ["window", "container", "overlay", "toast", "banner", "alert", "hud", "snack", "notification"]
        let parentLooksContainer = containerHints.contains { hint in
            parentClassName.range(of: hint, options: .caseInsensitive) != nil
        }
        let isTrackedParent = (self is UIWindow) || ((self.window?.isKeyWindow == true) && parentLooksContainer)
        guard isTrackedParent else { return }

        // Skip internal UIKit system views (_UIxxx, UITransitionView, etc.)
        let className = NSStringFromClass(type(of: subview))
        let systemPrefixes = ["_UI", "UITransitionView", "UIDropShadow", "UIInputSetContainer",
                              "UIRemote", "UITextEffect", "UIEditingOverlay"]
        if systemPrefixes.contains(where: { className.hasPrefix($0) }) { return }

        // Ignore purely structural inserts; only trigger passive OCR for views likely
        // to carry user-visible text/state (toast, banner, alert, labels, etc.).
        let labelText = (subview as? UILabel)?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let textViewText = (subview as? UITextView)?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let buttonText = (subview as? UIButton)?.currentTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let accessibilityText = subview.accessibilityLabel?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let messageLikeHints = ["label", "text", "toast", "banner", "alert", "hud", "snack"]
        let classLooksMessageLike = messageLikeHints.contains { hint in
            className.range(of: hint, options: .caseInsensitive) != nil
        }

        let isLikelyInformative = !labelText.isEmpty
            || !textViewText.isEmpty
            || !buttonText.isEmpty
            || !accessibilityText.isEmpty
            || classLooksMessageLike
        guard isLikelyInformative else { return }

        // Debounce: cancel any pending scan and schedule a new one
        FlowyPassiveScanner.shared.schedulePassiveScan()
    }
}

/// Debounces passive scans triggered by subview additions and delegates to FlowyLogger.
final class FlowyPassiveScanner: @unchecked Sendable {
    static let shared = FlowyPassiveScanner()
    private init() {}

    private var pendingWork: DispatchWorkItem?
    private var lastScanAt: Date = .distantPast
    private let debounce: TimeInterval = 0.9  // wait for view to finish rendering
    private let minimumScanInterval: TimeInterval = 1.8

    func schedulePassiveScan() {
        pendingWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.performScan()
        }
        pendingWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + debounce, execute: work)
    }

    private func performScan() {
        let now = Date()
        guard now.timeIntervalSince(lastScanAt) >= minimumScanInterval else {
            print("[Flowy] ⏭️ Passive scan skipped — minimum interval not reached")
            return
        }
        lastScanAt = now

        // Reuse the existing full-screen Vision scan in FlowyLogger
        Task { @MainActor in
            FlowyLogger.shared.performImmediateScan()
        }
    }
}
#endif
