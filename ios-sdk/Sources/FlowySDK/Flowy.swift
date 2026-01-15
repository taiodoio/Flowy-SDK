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
        FlowyLogger.shared.logInteration(type: "ERROR", element: UIView(), text: description)
        #endif
    }
    
    // Public API for tracking screens manually if needed
    public func trackScreen(name: String) {
        #if canImport(UIKit)
        FlowyLogger.shared.logScreenView(name: name)
        #endif
    }
}
