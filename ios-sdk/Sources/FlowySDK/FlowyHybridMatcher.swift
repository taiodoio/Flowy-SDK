#if canImport(UIKit)
import UIKit
import Vision

class FlowyHybridMatcher {
    
    /// Merges DOM snapshot with OCR results using geometric matching
    /// - Parameters:
    ///   - dom: The view hierarchy snapshot
    ///   - ocrResults: Text observations from Vision
    ///   - windowSize: The size of the screen/window for coordinate conversion
    /// - Returns: A list of hybrid elements with matched text
    static func merge(dom: [FlowyDomNode], ocrResults: [VNRecognizedTextObservation], windowSize: CGSize) -> [FlowyHybridElement] {
        
        var hybridElements: [FlowyHybridElement] = []
        
        for observation in ocrResults {
            guard let candidate = observation.topCandidates(1).first else { continue }
            let text = candidate.string
            
            // 1. Convert Vision Rect (0..1, Bottom-Left origin) to UIKit Rect (Pixels, Top-Left origin)
            let visionRect = observation.boundingBox
            let x = visionRect.origin.x * windowSize.width
            // Vision Y is from bottom, UIKit is from top
            let y = (1 - visionRect.origin.y - visionRect.height) * windowSize.height
            let w = visionRect.width * windowSize.width
            let h = visionRect.height * windowSize.height
            let textFrame = CGRect(x: x, y: y, width: w, height: h)
            
            // 2. Find best DOM match
            // We search for the smallest, interactive view that contains the text center
            let textCenter = CGPoint(x: textFrame.midX, y: textFrame.midY)
            
            if let bestMatch = findBestMatch(in: dom, for: textCenter) {
                let element = FlowyHybridElement(
                    type: bestMatch.className,
                    ocrText: text,
                    domId: bestMatch.accessibilityIdentifier,
                    frame: bestMatch.frame
                )
                hybridElements.append(element)
            } else {
                // Fallback: Text detected but no interactive view found under it (maybe static label)
                // We can log it as a generic element
                 let element = FlowyHybridElement(
                    type: "OCR_Text",
                    ocrText: text,
                    domId: nil,
                    frame: textFrame
                )
                hybridElements.append(element)
            }
        }
        
        return hybridElements
    }
    
    public static func findBestMatch(in nodes: [FlowyDomNode], for point: CGPoint) -> FlowyDomNode? {
        var candidates: [FlowyDomNode] = []
        
        // Flatten the tree for search or traverse? Traverse is better.
        // But we want the DEEPEST view.
        
        func traverse(_ nodes: [FlowyDomNode]) {
            for node in nodes {
                if node.frame.contains(point) {
                    // It's a candidate
                    candidates.append(node)
                    // Continue deeper
                    if let children = node.subviews {
                        traverse(children)
                    }
                }
            }
        }
        
        traverse(nodes)
        
        // Filter for interactive enabled preferred?
        // The prompt says: "choose the view smallest (the leaf) that is interactive (isUserInteractionEnabled)"
        
        let interactiveCandidates = candidates.filter { $0.isUserInteractionEnabled }
        let lookupList = interactiveCandidates.isEmpty ? candidates : interactiveCandidates
        
        // Sort by area (smallest first)
        return lookupList.sorted { ($0.frame.width * $0.frame.height) < ($1.frame.width * $1.frame.height) }.first
    }
}
#endif
