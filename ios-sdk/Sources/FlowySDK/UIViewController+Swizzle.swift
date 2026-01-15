import Foundation
#if canImport(UIKit)
import UIKit

extension UIViewController {
    static let swizzleViewDidAppear: Void = {
        let originalSelector = #selector(viewDidAppear(_:))
        let swizzledSelector = #selector(swizzled_viewDidAppear(_:))
        
        guard let originalMethod = class_getInstanceMethod(UIViewController.self, originalSelector),
              let swizzledMethod = class_getInstanceMethod(UIViewController.self, swizzledSelector) else {
            return
        }
        
        method_exchangeImplementations(originalMethod, swizzledMethod)
    }()
    
    @objc func swizzled_viewDidAppear(_ animated: Bool) {
        // 1. Call original implementation
        swizzled_viewDidAppear(animated)
        
        // 2. Filter out system containers (Navigation, TabBar, Input, etc) to avoid noise
        // We only want "content" screens.
        let ignoredClasses = [
            "UIInputWindowController",
            "UICompatibilityInputViewController",
            "UINavigationController",
            "UITabBarController",
            // "UIHostingController", // REMOVED: We NEED this for SwiftUI screens!
            "_UIContextMenuActionsOnlyViewController",
            "UIWindow",
            "UIApplicationRotationFollowingController",
            "UISystemKeyboard",
            "Keyboard",
            "Input",
            "Sidebar",
            "VisualEffect"
        ]
        
        let className = String(describing: type(of: self))
        
        // Check for internal/system checks
        guard !ignoredClasses.contains(where: { className.contains($0) }) else { return }
        
        // Log it passing the VC instance for deeper inspection
        FlowyLogger.shared.logScreenView(vc: self)
    }
}
#endif
