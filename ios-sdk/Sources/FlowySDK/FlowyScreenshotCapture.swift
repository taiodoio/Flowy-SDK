import Foundation
#if canImport(UIKit)
import UIKit

/// Captures a low-resolution JPEG screenshot of the key window for use as
/// visual evidence in replay and heatmap views.
struct FlowyScreenshotCapture {

    enum QualityProfile {
        case normal
        case safe

        var scaleFactor: CGFloat {
            switch self {
            case .normal: return 0.40
            case .safe: return 0.30
            }
        }

        var jpegQuality: CGFloat {
            switch self {
            case .normal: return 0.40
            case .safe: return 0.35
            }
        }
    }

    struct CaptureResult {
        let base64: String
        let byteCount: Int
    }

    /// Active quality profile for replay screenshot captures.
    /// `normal` is the default for quality, `safe` lowers cost during bursty activity.
    @MainActor
    private static var qualityProfile: QualityProfile = .normal

    @MainActor
    static func setQualityProfile(_ profile: QualityProfile) {
        qualityProfile = profile
    }

    /// Captures and returns a base64-encoded JPEG string from `window`.
    /// Must be called on the main thread.
    @MainActor
    static func capture(from window: UIWindow) -> CaptureResult? {
        let profile = qualityProfile
        let scaleFactor = profile.scaleFactor
        let jpegQuality = profile.jpegQuality
        let bounds = window.bounds
        let targetSize = CGSize(
            width: max(1, bounds.width * scaleFactor),
            height: max(1, bounds.height * scaleFactor)
        )

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1   // prevent retina multiplication — we want the small size

        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        let image = renderer.image { ctx in
            ctx.cgContext.scaleBy(x: scaleFactor, y: scaleFactor)
            window.drawHierarchy(in: bounds, afterScreenUpdates: false)
        }

        guard let jpegData = image.jpegData(compressionQuality: jpegQuality) else {
            print("[Flowy] ⚠️ Screenshot: JPEG encoding failed")
            return nil
        }

        let base64 = jpegData.base64EncodedString()
        print("[Flowy] 📷 Screenshot captured [\(profile == .safe ? "safe" : "normal")]: \(Int(targetSize.width))×\(Int(targetSize.height))px, \(jpegData.count) bytes")
        return CaptureResult(base64: base64, byteCount: jpegData.count)
    }
}
#endif
