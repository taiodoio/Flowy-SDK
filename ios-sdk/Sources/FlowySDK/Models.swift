
import Foundation
#if canImport(UIKit)
import UIKit
#endif
import CoreGraphics

public struct FlowyEvent: Codable {
    public let timestamp: TimeInterval
    public let deviceInfo: DeviceInfo
    // Let's stick to standard Codable which encodes Date as number if configured, or we can use Double explicitly.
    // The user example had "timestamp": 123456789.
    
    public let action: String // Was 'type'
    public let ocr_text: String? // Vision Result
    public let coordinates: Coordinate?
    public let screen_name: String? // Keeping generic location context
    public let comment: String? // USER FEEDBACK
    
    // Legacy fields being deprecated/mapped
    // public let elementId: String? // Dropping ID as we move to Vision? Or keeping as fallback? User didn't specify keeping IDs. The prompt overrides architecture.
    
    public struct Coordinate: Codable {
        public let x: Double
        public let y: Double
    }
    
    public init(action: String, ocr_text: String?, coordinates: Coordinate?, screen_name: String?, comment: String? = nil) {
        self.timestamp = Date().timeIntervalSince1970
        self.action = action
        self.ocr_text = ocr_text
        self.coordinates = coordinates
        self.screen_name = screen_name
        self.comment = comment
        
        #if canImport(UIKit)
        let device = UIDevice.current
        self.deviceInfo = DeviceInfo(model: device.model, osVersion: device.systemVersion)
        #else
        self.deviceInfo = DeviceInfo(model: "Unknown", osVersion: "0.0")
        #endif
    }
}

public struct DeviceInfo: Codable {
    public let model: String
    public let osVersion: String
    // Add other fields as needed
}

public struct FlowyDomNode: Codable {
    public let className: String
    public let frame: CGRect // In Window Coordinates
    public let accessibilityIdentifier: String?
    public let isUserInteractionEnabled: Bool
    public let subviews: [FlowyDomNode]?
}

public struct FlowyHybridElement: Codable {
    public let type: String
    public let ocrText: String?
    public let domId: String? // accessibilityIdentifier
    public let frame: CGRect
}

// MARK: - Wireframe Models

/// Flat frame representation that encodes to {x, y, width, height} JSON.
/// CGRect's default Codable encoding uses nested origin/size — this avoids that.
public struct ViewNodeFrame: Codable {
    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double

    public init(_ rect: CGRect) {
        self.x = Double(rect.origin.x)
        self.y = Double(rect.origin.y)
        self.width = Double(rect.size.width)
        self.height = Double(rect.size.height)
    }
}

// MARK: - Session Export Bundle

/// On-disk wrapper saved as individual wireframe JSON files in Documents/Wireframes/.
/// Bundles both the view tree and an optional low-res screenshot.
public struct FlowyWireframeFileData: Codable {
    public let tree: ViewNode
    public let screenshotBase64: String?

    enum CodingKeys: String, CodingKey {
        case tree
        case screenshotBase64 = "screenshot_base64"
    }
}

/// A captured wireframe for a single screen, used inside the export bundle.
public struct FlowyWireframeEntry: Codable {
    public let screenName: String
    public let capturedAt: TimeInterval
    public let tree: ViewNode
    public let screenshotBase64: String?

    enum CodingKeys: String, CodingKey {
        case screenName = "screen_name"
        case capturedAt = "captured_at"
        case tree
        case screenshotBase64 = "screenshot_base64"
    }
}

/// The consolidated export file produced by `Flowy.shared.exportSession()`.
/// Contains all events and all wireframes captured during the session.
public struct FlowySessionBundle: Codable {
    public let version: Int
    public let exportedAt: TimeInterval
    public let events: [FlowyEvent]
    public let wireframes: [FlowyWireframeEntry]

    enum CodingKeys: String, CodingKey {
        case version
        case exportedAt = "exported_at"
        case events
        case wireframes
    }
}

/// A node in the extracted view hierarchy tree, ready for wireframe reconstruction.
public struct ViewNode: Codable {
    public let className: String
    public let frame: ViewNodeFrame
    public let text: String?
    public let children: [ViewNode]?

    enum CodingKeys: String, CodingKey {
        case className = "class_name"
        case frame
        case text
        case children
    }
}
