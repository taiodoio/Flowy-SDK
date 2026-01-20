
import Foundation
#if canImport(UIKit)
import UIKit

@MainActor
class FlowyScreenReader {
    
    // Limits
    private static let MAX_DEPTH = 15
    private static let MAX_CANDIDATES = 30 // Avoid processing too many texts
    
    struct TextCandidate {
        let text: String
        let yPosition: CGFloat
        let isHeader: Bool
        let score: Int // Priority score
    }
    
    /// Deduces a meaningful screen name following the 4 rules.
    static func deduceScreenName(viewController: UIViewController) -> String {
        let className = String(describing: type(of: viewController))
        
        // RULE 0: Container Handling (Recursive)
        // Check if we are inside a container and should ask the child
        if let split = viewController as? UISplitViewController {
            // Prefer detail, then primary
            if let detail = split.viewControllers.last {
                return deduceScreenName(viewController: detail)
            }
        }
        if let nav = viewController as? UINavigationController {
            if let top = nav.topViewController {
                return deduceScreenName(viewController: top)
            }
        }
        if let tab = viewController as? UITabBarController {
             if let selected = tab.selectedViewController {
                 return deduceScreenName(viewController: selected)
             }
        }
        
        // RULE 1: Navigation Bar Title (Highest Priority)
        // Check standard title
        if let title = viewController.title, !title.isEmpty, title != "Back" {
             return title
        }
        // Check navigation item title
        if let title = viewController.navigationItem.title, !title.isEmpty {
            return title
        }
        // Check navigation bar directly (rare but possible)
        if let title = viewController.navigationController?.navigationBar.topItem?.title, !title.isEmpty {
            return title
        }
        
        // If we have a titleView that is a label, try that
        if let titleLabel = viewController.navigationItem.titleView as? UILabel, let text = titleLabel.text, !text.isEmpty {
            return text
        }
        
        // RULE 1.5: Content Analysis (Heuristics)
        let candidates = extractVisibleText(from: viewController.view)
        
        // 1. Timers
        let minCount = candidates.filter { $0.text.contains("min") }.count
        if minCount > 2 {
            return "Timers List"
        }
        
        let headerCandidates = candidates.filter { $0.isHeader }
        if let bestHeader = headerCandidates.sorted(by: { $0.yPosition < $1.yPosition }).first {
            return bestHeader.text
        }
        
        // RULE 3: Dominant Content (Keywords)
        let keywords = ["Login", "Accedi", "Sign In", "Registrati", "Sign Up", "Home", "Dashboard", "Profilo", "Profile", "Impostazioni", "Settings", "Carrello", "Cart", "Checkout", "Ordine", "Order"]
        
        // Look for exact keyword matches in any visible text
        for candidate in candidates {
            if keywords.contains(where: { candidate.text.caseInsensitiveCompare($0) == .orderedSame }) {
                return candidate.text
            }
        }
        
        // Look for partial matches if no exact match
        for candidate in candidates {
             if keywords.contains(where: { candidate.text.localizedCaseInsensitiveContains($0) }) {
                 // Return the Keyword, not the whole text, to keep it clean? Or the text?
                 // User said "Use those", implying the keyword or the text containing it.
                 // Let's return the candidate text if it's short (likely a button title or header)
                 if candidate.text.count < 30 {
                     return candidate.text
                 }
             }
        }
        
        // RULE 4: Fallback (Class Name)
        return className
    }
    
    /// Recursively extracts meaningful text from the view hierarchy.
    static func extractVisibleText(from view: UIView) -> [TextCandidate] {
        var results: [TextCandidate] = []
        traverse(view: view, depth: 0, results: &results)
        return results
    }
    
    private static func traverse(view: UIView, depth: Int, results: inout [TextCandidate]) {
        if depth > MAX_DEPTH { return }
        if results.count >= MAX_CANDIDATES { return }
        
        // Skip hidden views
        if view.isHidden || view.alpha < 0.1 { return }
        
        // Check for text content
        if let text = getText(from: view) {
            let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if isValidText(clean) {
                // Heuristic for "Header"
                var isHeader = false
                if let label = view as? UILabel {
                    // Check for bold or large font
                    if label.font.fontDescriptor.symbolicTraits.contains(.traitBold) {
                        isHeader = true
                    }
                    if label.font.pointSize > 17 { // Standard body is usually 17
                        isHeader = true
                    }
                }
                
                // Calculate absolute position (visual y)
                let frame = view.convert(view.bounds, to: nil)
                
                results.append(TextCandidate(
                    text: clean,
                    yPosition: frame.minY,
                    isHeader: isHeader,
                    score: 0
                ))
            }
        }
        
        // Recurse
        for subview in view.subviews {
            traverse(view: subview, depth: depth + 1, results: &results)
        }
    }
    
    private static func getText(from view: UIView) -> String? {
        if let label = view as? UILabel { return label.text }
        if let button = view as? UIButton { return button.title(for: .normal) }
        if let textField = view as? UITextField { return textField.text ?? textField.placeholder }
        if let textView = view as? UITextView { return textView.text }
        return nil
    }
    
    private static func isValidText(_ text: String) -> Bool {
        if text.isEmpty { return false }
        // Ignore purely numeric or symbol-only strings
        let alphanumeric = CharacterSet.alphanumerics
        if text.rangeOfCharacter(from: alphanumeric) == nil { return false }
        
        // Ignore single characters (noise)
        if text.count < 2 { return false }
        
        return true
    }
    /// Finds the nearest "Header" label visually above the given view to provide context (e.g. "Section Name").
    static func findSectionHeader(for view: UIView, in root: UIView) -> String? {
        let viewFrame = view.convert(view.bounds, to: nil)
        
        // 1. Extract all candidates from the root (screen)
        // Optimization: We could limit traversal to the siblings/cousins of the view's superview chain,
        // but for now, global extraction with limit is safer to find "Section Headers" which might be siblings of container
        let candidates = extractVisibleText(from: root)
        
        // 2. Filter for potential headers
        // - Must be above (yPosition < viewFrame.minY)
        // - Must not be too far above (e.g. within 300pts) to avoid picking the Screen Title
        // - Must be "Header-like" (isHeader == true) OR just assume labels above are context if clear
        
        let validHeaders = candidates.filter { candidate in
            let isAbove = candidate.yPosition < viewFrame.minY - 5 // strict above with buffer
            let isNotTooFar = (viewFrame.minY - candidate.yPosition) < 400
            
            // It should ideally be a header style, OR if it's the closest label above a group of controls, take it.
            // If isHeader is false, we might still accept it if it's very close and left-aligned? 
            // Let's rely on isHeader for quality signal first.
            return isAbove && isNotTooFar && candidate.isHeader
        }
        
        // 3. Sort by Y position (descending) -> Closest to the element
        let sorted = validHeaders.sorted { $0.yPosition > $1.yPosition }
        
        return sorted.first?.text
    }
}
#endif
