#if canImport(UIKit)
import UIKit

class FlowyTreeWalker {
    
    /// Captures the complete view hierarchy snapshot from the given window
    /// - Parameter window: The UIWindow to traverse
    /// - Returns: An array of FlowyDomNode representing the root views and their children
    static func captureHierarchy(in window: UIWindow) -> [FlowyDomNode] {
        return capture(view: window, relativeTo: window)
    }
    
    private static func capture(view: UIView, relativeTo window: UIWindow) -> [FlowyDomNode] {
        // Filter out irrelevant views
        if view.isHidden || view.alpha < 0.01 || view.frame.isEmpty {
            return []
        }
        
        // Convert frame to window coordinates
        let windowFrame = view.convert(view.bounds, to: window)
        
        // Recursively capture subviews
        var childNodes: [FlowyDomNode] = []
        for subview in view.subviews {
            childNodes.append(contentsOf: capture(view: subview, relativeTo: window))
        }
        
        let node = FlowyDomNode(
            className: String(describing: type(of: view)),
            frame: windowFrame,
            accessibilityIdentifier: view.accessibilityIdentifier,
            isUserInteractionEnabled: view.isUserInteractionEnabled,
            subviews: childNodes.isEmpty ? nil : childNodes
        )
        
        // Return as an array because the recursive call expects a list of nodes (though this level produces one)
        // Wait, the structure is recursive. A node has [subviews]. 
        // But the return type of captureHierarchy is [FlowyDomNode].
        // Let's adjust helper.
        return [node]
    }
}
#endif
