#if canImport(UIKit) && canImport(Vision)
import UIKit
import Vision

class FlowyVisionEngine: @unchecked Sendable {
    static let shared = FlowyVisionEngine()
    
    // Serial queue to process OCR requests one by one without blocking Main
    private let processingQueue = DispatchQueue(label: "com.flowy.visionQueue", qos: .userInitiated)
    
    private init() {}
    
    /// Processes a tap by analyzing the screenshot to find text at the tap location.
    /// - Parameters:
    ///   - snapshot: The screenshot of the screen at the moment of the tap.
    ///   - tapPoint: The coordinate of the tap in the Window's coordinate system (UIKit).
    ///   - completion: Callback with the detected text (if any).
    func processTap(snapshot: UIImage, tapPoint: CGPoint, completion: @escaping (String?) -> Void) {
        
        guard let cgImage = snapshot.cgImage else {
            completion(nil)
            return
        }
        
        processingQueue.async {
            let request = VNRecognizeTextRequest { (request, error) in
                guard let observations = request.results as? [VNRecognizedTextObservation], error == nil else {
                    completion(nil)
                    return
                }
                
                // Find the observation that contains the tap point OR is closest to it
                let imageWidth = CGFloat(cgImage.width)
                let imageHeight = CGFloat(cgImage.height)
                
                // Scale Tap Point to Image Pixels
                let scale = snapshot.scale
                let scaledTapPoint = CGPoint(x: tapPoint.x * scale, y: tapPoint.y * scale)
                
                var bestCandidate: String? = nil
                var minDistance: CGFloat = 100.0 * scale // Increased to 100pt radius for larger buttons (Text below Icon)
                
                for observation in observations {
                    guard let candidate = observation.topCandidates(1).first else { continue }
                    
                    // Convert Vision Rect to UI Rect (Pixels)
                    let visionRect = observation.boundingBox
                    let x = visionRect.origin.x * imageWidth
                    let y = (1 - visionRect.origin.y - visionRect.height) * imageHeight
                    let width = visionRect.width * imageWidth
                    let height = visionRect.height * imageHeight
                    let uiRect = CGRect(x: x, y: y, width: width, height: height)
                    
                    // Calculate Distance to Center
                    // We prioritize items where the tap is physically closest to the center of the text label
                    let center = CGPoint(x: uiRect.midX, y: uiRect.midY)
                    let dx = center.x - scaledTapPoint.x
                    let dy = center.y - scaledTapPoint.y
                    let distance = sqrt(dx*dx + dy*dy)
                    
                    // Logic:
                    // 1. If tap is INSIDE the rect, distance is heavily discounted (priority)
                    //    But we still compare "inside" candidates by distance to center to handle overlaps
                    // 2. If tap is OUTSIDE, we use raw distance but only if < minDistance
                    
                    let looseHitRect = uiRect.insetBy(dx: -10, dy: -10)
                    var finalDistance = distance
                    
                    if looseHitRect.contains(scaledTapPoint) {
                        // "Inside" bonus: artificially reduce distance to prioritize hits over near-misses
                        // We divide by 100 to ensure any "Inside" hit beats any "Outside" hit
                        finalDistance = distance / 100.0
                    }
                    
                    if finalDistance < minDistance {
                        minDistance = finalDistance
                        bestCandidate = candidate.string
                    }
                }
                
                completion(bestCandidate)
            }
            
            request.recognitionLevel = .fast
            request.usesLanguageCorrection = true
            
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try? handler.perform([request])
        }
    }

    /// Scans the entire screen for text, useful for detecting errors/toasts
    func scanScreen(snapshot: UIImage, completion: @escaping ([String]) -> Void) {
        guard let cgImage = snapshot.cgImage else {
            completion([])
            return
        }
        
        processingQueue.async {
            let request = VNRecognizeTextRequest { (request, error) in
                guard let observations = request.results as? [VNRecognizedTextObservation], error == nil else {
                    completion([])
                    return
                }
                let strings = observations.compactMap { $0.topCandidates(1).first?.string }
                completion(strings)
            }
            request.recognitionLevel = .fast
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try? handler.perform([request])
        }
    }
}
#endif
