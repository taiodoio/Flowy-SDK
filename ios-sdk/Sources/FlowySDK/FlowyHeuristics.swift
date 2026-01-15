import Foundation

struct FlowyHeuristics {
    static func isErrorText(_ text: String?) -> Bool {
        guard let text = text?.lowercased() else { return false }
        // Added Italian keywords for "A Tavola" app
        let keywords = [
            "error", "failed", "failure", "wrong", "denied", "forbidden", "fatal", "exception",
            "errore", "fallito", "non trovato", "invalido", "riprova", "attenzione", "vietato"
        ]
        return keywords.contains(where: { text.contains($0) })
    }
    
    static func cleanScreenName(_ rawName: String) -> String {
        // Remove generic generic wrappers like "UIHostingController<"
        var name = rawName
        
        // Handle "UIHostingController<ANY>" -> "ANY"
        if name.contains("UIHostingController") {
             if let start = name.firstIndex(of: "<"), let end = name.lastIndex(of: ">") {
                 let inner = name[name.index(after: start)..<end]
                 name = String(inner)
             }
        }
        
        // Clean SwiftUI types (e.g. "Scroll List (NoStyle...)" -> "Scroll List")
        if name.contains("(") {
             if let parenIndex = name.firstIndex(of: "(") {
                 name = String(name.prefix(upTo: parenIndex)).trimmingCharacters(in: .whitespaces)
             }
        }
        
        // Remove module prefixes if present (e.g. "MyApp.MyView" -> "MyView")
        if let dotIndex = name.lastIndex(of: ".") {
            name = String(name.suffix(from: name.index(after: dotIndex)))
        }
        
        // Filter out strict internal SwiftUI/UIKit junk
        // Expanded ignore list based on user feedback (SystemKeyboard, Sidebar, etc)
        let ignoredPrefixes = ["_", "UI", "Input", "Keyboard", "Sidebar", "Split", "Notifying"]
        
        if ignoredPrefixes.contains(where: { name.hasPrefix($0) || name.contains($0) }) {
             // Try to rescue "useful" names if they are buried? 
             // for now, just filtering out likely noise.
             if name.contains("SplitView") { return "Split View" }
             // If it's pure noise, we might want to return "" so the logger can ignore it entirely?
             // But valid screens might have weird names. Let's keep specific filters.
             
             // Special case for our "Scroll List" friend from the screenshot
             if name.contains("Scroll") && name.contains("List") {
                 return "Scroll List"
             }
        }
        
        return name
    }
    
    static func cleanElementText(_ text: String) -> String {
        // If it looks like a memory address or internal ID, sanitize it
        if text.starts(with: "_") || text.contains("Layout") {
            return "Element"
        }
        return text
    }
}
