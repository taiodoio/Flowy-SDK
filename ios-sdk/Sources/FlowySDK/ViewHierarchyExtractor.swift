#if canImport(UIKit)
import UIKit

/// Extracts the current screen's view tree as a `ViewNode` hierarchy for server-side
/// wireframe reconstruction. Handles both UIKit and SwiftUI (via the accessibility tree).
@MainActor
final class ViewHierarchyExtractor {

    // MARK: - Public API

    /// Captures the full view hierarchy starting from the key window.
    /// Must be called on the MainActor — all UIKit property access happens here.
    /// - Returns: The root `ViewNode`, or `nil` if no key window is available.
    func extract() -> ViewNode? {
        guard let window = keyWindow() else {
            print("[Flowy] ❌ ViewHierarchyExtractor: No key window found. Connected scenes: \(UIApplication.shared.connectedScenes.count)")
            return nil
        }
        print("[Flowy] ✓ Key window found: \(window)")
        let node = buildNode(from: window, relativeTo: window)
        print("[Flowy] ✓ Built node: \(node != nil ? "SUCCESS" : "FAILED - node is nil")")
        return node
    }

    // MARK: - Key Window Resolution

    private func keyWindow() -> UIWindow? {
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
        print("[Flowy] 🔍 keyWindow search - found: \(window != nil)")
        return window
    }

    // MARK: - Recursive Tree Builder

    private func buildNode(from view: UIView, relativeTo window: UIWindow) -> ViewNode? {
        // --- Visibility filters ---
        guard !view.isHidden, view.alpha >= 0.05 else { return nil }

        // Convert to absolute window coordinates
        let windowFrame = view.convert(view.bounds, to: window)

        // Filter negative origins and zero/negative dimensions
        guard windowFrame.origin.x >= 0,
              windowFrame.origin.y >= 0,
              windowFrame.width > 0,
              windowFrame.height > 0 else { return nil }

        // --- Class name resolution ---
        let rawClassName = String(describing: type(of: view))
        let resolvedName: String

        if isSwiftUIHostingView(rawClassName) {
            // Use heuristic parser for SwiftUI hosting containers
            resolvedName = SwiftUIHeuristicParser.shared.resolveSemanticName(
                for: view,
                rawClassName: rawClassName
            )
        } else {
            resolvedName = rawClassName
        }

        // --- Text extraction ---
        let text = extractText(from: view)

        // --- Children ---
        // SwiftUI hosting views: walk accessibilityElements (the semantic SwiftUI tree).
        // UIKit views: walk subviews normally.
        let children: [ViewNode]
        if isSwiftUIHostingView(rawClassName) {
            children = buildChildrenFromAccessibility(view: view, window: window)
        } else {
            children = view.subviews.compactMap { buildNode(from: $0, relativeTo: window) }
        }

        return ViewNode(
            className: resolvedName,
            frame: ViewNodeFrame(windowFrame),
            text: text,
            children: children.isEmpty ? nil : children
        )
    }

    // MARK: - SwiftUI Detection

    /// Returns true for views that host SwiftUI content.
    /// At runtime, SwiftUI hosting views have class names like `_UIHostingView<RootView>`.
    private func isSwiftUIHostingView(_ className: String) -> Bool {
        return className.contains("UIHostingView")
    }

    // MARK: - Accessibility Tree Walk (SwiftUI path)

    /// Walks `accessibilityElements` to extract individual SwiftUI-rendered components.
    /// Each element can be a `UIView` (recursed normally) or a `UIAccessibilityElement`
    /// (a virtual node with frame + label, not backed by a UIView).
    private func buildChildrenFromAccessibility(view: UIView, window: UIWindow) -> [ViewNode] {
        guard let elements = view.accessibilityElements, !elements.isEmpty else {
            // No accessibility elements declared — fall back to subview walk
            return view.subviews.compactMap { buildNode(from: $0, relativeTo: window) }
        }

        var result: [ViewNode] = []

        for element in elements {
            if let subview = element as? UIView {
                // Element is a real UIView — recurse normally
                if let node = buildNode(from: subview, relativeTo: window) {
                    result.append(node)
                }
            } else if let axElement = element as? UIAccessibilityElement {
                // Virtual accessibility element (no backing UIView)
                // accessibilityFrameInContainerSpace is in the container's coordinate space
                let containerFrame = axElement.accessibilityFrameInContainerSpace
                let windowFrame = view.convert(containerFrame, to: window)

                guard windowFrame.width > 0, windowFrame.height > 0,
                      windowFrame.origin.x >= 0, windowFrame.origin.y >= 0 else { continue }

                let className = classNameFromTraits(axElement.accessibilityTraits)
                let label = axElement.accessibilityLabel

                result.append(ViewNode(
                    className: className,
                    frame: ViewNodeFrame(windowFrame),
                    text: label,
                    children: nil
                ))
            }
        }

        return result
    }

    /// Maps UIAccessibilityTraits to a human-readable class name for wireframe labels.
    private func classNameFromTraits(_ traits: UIAccessibilityTraits) -> String {
        if traits.contains(.button)      { return "Button" }
        if traits.contains(.image)       { return "Image" }
        if traits.contains(.header)      { return "Header" }
        if traits.contains(.searchField) { return "SearchBar" }
        if traits.contains(.link)        { return "Link" }
        if traits.contains(.tabBar)      { return "TabBar" }
        if traits.contains(.staticText)  { return "Label" }
        return "AccessibilityElement"
    }

    // MARK: - Text Extraction

    /// Extracts visible text from a UIKit view.
    /// Typed text sources (UILabel, UIButton, etc.) take priority over accessibilityLabel,
    /// which is used as a fallback to capture SwiftUI `Text` and image alt text.
    private func extractText(from view: UIView) -> String? {
        let typed: String?
        if let label = view as? UILabel {
            typed = label.text
        } else if let button = view as? UIButton {
            typed = button.title(for: .normal)
        } else if let textField = view as? UITextField {
            typed = textField.text?.isEmpty == false ? textField.text : textField.placeholder
        } else if let textView = view as? UITextView {
            typed = textView.text
        } else {
            typed = nil
        }

        if let t = typed, !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return t
        }

        // Fallback: accessibilityLabel captures SwiftUI Text views and image descriptions
        let axLabel = view.accessibilityLabel
        if let t = axLabel, !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return t
        }

        return nil
    }
}
#endif
