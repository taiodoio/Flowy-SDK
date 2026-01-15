import Foundation

public struct FlowyEvent: Codable {
    public let timestamp: Double // Changed to TimeInterval (Unix) as per request usually, but Date is fine if encoded as double. User requested timestamp: 123456789.
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
    }
}
