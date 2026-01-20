
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
    
    // Legacy fields being deprecated/mapped
    // public let elementId: String? // Dropping ID as we move to Vision? Or keeping as fallback? User didn't specify keeping IDs. The prompt overrides architecture.
    
    public struct Coordinate: Codable {
        public let x: Double
        public let y: Double
    }
    
    public init(action: String, ocr_text: String?, coordinates: Coordinate?, screen_name: String?) {
        self.timestamp = Date().timeIntervalSince1970
        self.action = action
        self.ocr_text = ocr_text
        self.coordinates = coordinates
        self.screen_name = screen_name
        
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
