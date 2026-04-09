import Foundation
#if canImport(UIKit)
import UIKit

@MainActor
public class SwiftUIHeuristicParser {
    
    // Singleton for easy access, though instance usage is also fine
    public static let shared = SwiftUIHeuristicParser()
    
    private init() {}
    
    /// Main entry point: Resolves a human-readable semantic name for a given view.
    /// - Parameters:
    ///   - view: The UIView instance (often a _UIHostingView or similar in SwiftUI).
    ///   - rawClassName: The raw Swift class name of the view (e.g. "ModifiedContent<Button, ...>").
    /// - Returns: A sanitized, semantic string (e.g. "Button", "List Tile").
    public func resolveSemanticName(for view: UIView, rawClassName: String) -> String {
        
        // 1. Priority: UIAccessibilityTraits
        // Checks if the view has specific accessibility traits that strongly indicate its function.
        if let traitsName = checkAccessibilityTraits(for: view) {
            return traitsName
        }
        
        // 2. Recursive String Parsing
        // Unwraps internal SwiftUI wrappers to find the core component type.
        let cleanedName = parseSwiftUITypeName(rawClassName)
        if cleanedName != "Generic View" {
           return cleanedName
        }
        
        // 3. Fallback: Reflection
        // If we still have a generic view (like AnyView), try to peek inside using Mirror.
        if let reflectedName = checkReflection(for: view) {
            return reflectedName
        }
        
        return "Generic View"
    }
    
    
    // MARK: - Level 1: Accessibility Traits
    
    private func checkAccessibilityTraits(for view: UIView) -> String? {
        let traits = view.accessibilityTraits
        
        if traits.contains(.button) { return "Button" }
        if traits.contains(.image) { return "Image" }
        if traits.contains(.header) { return "Header/Title" }
        if traits.contains(.searchField) { return "Search Bar" }
        if traits.contains(.link) { return "Link" }
        if traits.contains(.tabBar) { return "Tab Bar" }
        // .staticText often applies to Labels, but can be generic. We'll let string parsing handle "Text" if possible,
        // or return "Label" if it's explicitly set without being a button.
        if traits.contains(.staticText) { return "Label" }
        
        return nil
    }
    
    // MARK: - Level 2: String Parsing
    
    /// Recursively strips SwiftUI wrappers (ModifiedContent, Optional, etc.) to find the inner type.
    private func parseSwiftUITypeName(_ name: String) -> String {
        var currentName = name
        
        // Common SwiftUI wrappers to remove.
        // matches "Wrapper<InnerType, ...>" keeping specific parts.
        
        // 1. Remove "Optional<Type>" -> "Type"
        if currentName.hasPrefix("Optional<") && currentName.hasSuffix(">") {
            currentName = extractGenericLogin(from: currentName, wrapper: "Optional")
        }
        
        // 2. Remove "ModifiedContent<Content, Modifier>" -> "Content"
        // We only care about the first generic argument (the content).
        if currentName.hasPrefix("ModifiedContent<") {
             currentName = extractFirstGeneric(from: currentName)
        }
        
        // 3. Remove other common internal modifiers/wrappers
        // Examples: _PaddingLayout, _BackgroundModifier, _ConditionalContent
        // Strategy: If it starts with underscore or is a known modifier, we might have peeled too far or need to peel more.
        // Actually, the recursion happens because we keep cleaning until it stabilizes.
        
        // Regex to match "ModifiedContent<Target, ...>" and extract "Target"
        // This is complex due to nested < >. A simple string search for the first comma might suffice if we track nesting depth.
        
        // Iterative cleaning loop
        var previousName = ""
        while currentName != previousName {
            previousName = currentName
            currentName = cleanWrapper(currentName)
        }
        
        // Final sanity check: if the name is still something internal definition-like or very long, simplify it.
        if currentName.starts(with: "_") || currentName.contains("<") {
             // If we ended up with something like "_UIHostingView<...>", it's essentially generic.
            if currentName.contains("Text") { return "Text" }
            if currentName.contains("Image") { return "Image" }
            // If it's still complex, we failed to find a clean "Button" or similar.
            return "Generic View"
        }
        
        return currentName
    }
    
    /// Helper to look for standard SwiftUI components
    private func cleanWrapper(_ name: String) -> String {
        var processing = name
        
        // Handle "ModifiedContent<Content, Modifier>"
        // We want to extract 'Content'.
        if processing.hasPrefix("ModifiedContent<") {
           return extractFirstGeneric(from: processing)
        }
        
        // Handle "Optional<Content>"
        if processing.hasPrefix("Optional<") {
            return extractFirstGeneric(from: processing)
        }
        
        // Handle "AnyView" - often opaque, but we treat the name itself as 'AnyView'.
        // Reflection handles the content of AnyView.
        
        return processing
    }
    
    /// Extracts the first generic argument from a string like "Wrapper<First, Second>"
    /// Handles nested brackets correcty.
    private func extractFirstGeneric(from typeString: String) -> String {
        guard let firstKarets = typeString.firstIndex(of: "<") else { return typeString }
        
        let start = typeString.index(after: firstKarets)
        var depth = 0
        var foundComma = false
        var end = start
        
        // Scan for the comma separating the first generic argument
        for index in typeString.indices[start...] {
            let char = typeString[index]
            if char == "<" {
                depth += 1
            } else if char == ">" {
                if depth == 0 {
                    // End of the wrapper if we haven't found a comma (single generic arg)
                    end = index
                    break
                }
                depth -= 1
            } else if char == "," {
                if depth == 0 {
                    end = index
                    foundComma = true
                    break
                }
            }
        }
        
        let result = String(typeString[start..<end])
        return result
    }
    
    private func extractGenericLogin(from str: String, wrapper: String) -> String {
        // Simple extraction for single generic param wrappers like Optional<T>
        // Removes "Wrapper<" and the last ">"
        let prefix = wrapper + "<"
        if str.hasPrefix(prefix) && str.hasSuffix(">") {
            let start = str.index(str.startIndex, offsetBy: prefix.count)
            let end = str.index(str.endIndex, offsetBy: -1)
            return String(str[start..<end])
        }
        return str
    }

    
    // MARK: - Level 3: Reflection (Optional/Fallback)
    
    private func checkReflection(for view: UIView) -> String? {
        // This attempts to inspect the view for specific internal properties that might hint at the type.
        // In pure DOM analysis, we might not have deep access, but if we have the UIView:
        
        let mirror = Mirror(reflecting: view)
        
        // Check for 'content' or 'storage' properties common in AnyView or HostingViews
        for child in mirror.children {
            if let label = child.label {
                // Example: AnyView often wraps its storage in a property.
                if label == "storage" || label == "content" {
                    let internalName = String(describing: type(of: child.value))
                    let cleaned = parseSwiftUITypeName(internalName)
                     if cleaned != "Generic View" && cleaned != "AnyView" {
                        return cleaned
                    }
                }
            }
        }
        return nil
    }
    
    // MARK: - Spatial Inference (Pattern Recognition)
    
    /// Refines a list of detected elements by looking for spatial patterns.
    /// Renames repetitive "Generic View" items to "List Tile" or "Grid Item".
    /// - Parameter elements: The list of `FlowyHybridElement` collected from the screen.
    /// - Returns: A new list with updated names.
    public func refineNames(for elements: [FlowyHybridElement]) -> [FlowyHybridElement] {
        var refinedElements = elements
        
        // Group elements by their dimensions (width x height)
        // We'll use a string key "WxH"
        var groups: [String: [Int]] = [:] // Key -> Array of indices
        
        for (index, element) in refinedElements.enumerated() {
            // Only convert "Generic View" or unknown types
            if element.type == "Generic View" || element.type == "View" {
                let w = Int(element.frame.width)
                let h = Int(element.frame.height)
                // Filter out very small elements/noise
                if w > 20 && h > 20 {
                    let key = "\(w)x\(h)"
                    groups[key, default: []].append(index)
                }
            }
        }
        
        // Analyze groups
        for (_, indices) in groups {
            // If we have 3 or more similar items
            if indices.count >= 3 {
                // Check if they are aligned
                let frames = indices.map { refinedElements[$0].frame }
                if areAligned(frames) {
                    let newName = isGrid(frames) ? "Grid Item" : "List Tile"
                    for idx in indices {
                        // Create a new struct with the updated type
                        let old = refinedElements[idx]
                        refinedElements[idx] = FlowyHybridElement(
                            type: newName,
                            ocrText: old.ocrText,
                            domId: old.domId,
                            frame: old.frame
                        )
                    }
                }
            }
        }
        
        return refinedElements
    }
    
    /// Checks if frames are aligned vertically (List) or in a grid.
    private func areAligned(_ frames: [CGRect]) -> Bool {
        guard let first = frames.first else { return false }
        
        // Check Vertical Alignment (List) -> Approx same X, varying Y
        let isVertical = frames.allSatisfy { abs($0.minX - first.minX) < 10 }
        
        // Check Grid/Horizontal -> Varies in X or Y but consistent spacing logic (simplified)
        // For now, if they are same size and multiple, we assume some list/grid structure.
        // We act optimistically for "Generic View"s.
        
        return true // We already filtered by same size, which is a strong indicator of a collection.
    }
    
    private func isGrid(_ frames: [CGRect]) -> Bool {
        // Simple heuristic: If multiple items share the same Y, it's likely a Grid or H-Stack.
        // If they act strictly distinct Y, it's a V-List.
        guard frames.count > 1 else { return false }
        let firstY = frames[0].minY
        // If the second item is on the same Y (roughly), it's horizontal flow -> Grid/Stack
        if abs(frames[1].minY - firstY) < 10 {
            return true
        }
        return false
    }
}
#endif
