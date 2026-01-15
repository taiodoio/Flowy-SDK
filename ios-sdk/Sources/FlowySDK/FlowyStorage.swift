import Foundation

class FlowyStorage {
    private let fileManager = FileManager.default
    private let queue = DispatchQueue(label: "com.flowy.storage", qos: .background)
    
    // Made internal for logging purposes
    var sessionFileURL: URL? {
        guard let documents = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else { return nil }
        // We use a fixed file for the "current" buffer. 
        // When we upload, we will rename/move it or just read and delete.
        // For append-only safety, we'll store as line-delimited JSON (NDJSON) or a comma-separated list manually managed?
        // Requirement said "append... valid JSON". 
        // Simply appending to a JSON array file is hard (need to seek back to remove closing brace).
        // Safest is NDJSON (one JSON object per line) or just appending structs and wrapping them later.
        // LET'S USE NDJSON for robustness, then wrap in [ ] before upload if needed.
        return documents.appendingPathComponent("flowy_current_session.log")
    }
    
    func appendEvent(_ event: FlowyEvent) {
        queue.async {
            guard let url = self.sessionFileURL else { return }
            
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            encoder.dateEncodingStrategy = .iso8601
            
            do {
                let data = try encoder.encode(event)
                if let stringData = String(data: data, encoding: .utf8) {
                    let line = stringData + "\n"
                    if let lineData = line.data(using: .utf8) {
                        if !self.fileManager.fileExists(atPath: url.path) {
                            try lineData.write(to: url)
                        } else {
                            if let fileHandle = try? FileHandle(forWritingTo: url) {
                                fileHandle.seekToEndOfFile()
                                fileHandle.write(lineData)
                                fileHandle.closeFile()
                            }
                        }
                    }
                }
            } catch {
                print("[Flowy] Storage Error: \(error)")
            }
        }
    }
    
    func retrieveAndClearLog() -> [FlowyEvent]? {
        // Synchronous read for the uploader
        guard let url = sessionFileURL, fileManager.fileExists(atPath: url.path) else { return nil }
        
        do {
            let data = try Data(contentsOf: url)
            let stringContent = String(data: data, encoding: .utf8) ?? ""
            let lines = stringContent.components(separatedBy: .newlines)
            
            var events: [FlowyEvent] = []
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            
            for line in lines where !line.isEmpty {
                if let lineData = line.data(using: .utf8) {
                    if let event = try? decoder.decode(FlowyEvent.self, from: lineData) {
                        events.append(event)
                    }
                }
            }
            
            // Note: We don't clear here immediately. The Uploader should tell us when to clear on success.
            return events
        } catch {
            return nil
        }
    }
    
    func clearLog() {
        guard let url = sessionFileURL else { return }
        try? fileManager.removeItem(at: url)
    }
}
