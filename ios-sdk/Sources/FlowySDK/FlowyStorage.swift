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
            guard let url = self.sessionFileURL else {
                print("[Flowy] ERROR: sessionFileURL is nil")
                return
            }
            
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            // FlowyEvent.timestamp is a plain TimeInterval (Double), not Date.
            // Do NOT set dateEncodingStrategy — it causes encoding to throw silently.
            
            do {
                let data = try encoder.encode(event)
                if let stringData = String(data: data, encoding: .utf8) {
                    let line = stringData + "\n"
                    if let lineData = line.data(using: .utf8) {
                        if !self.fileManager.fileExists(atPath: url.path) {
                            try lineData.write(to: url)
                            print("[Flowy] 📝 Session log CREATED: \(url.path)")
                        } else {
                            if let fileHandle = try? FileHandle(forWritingTo: url) {
                                fileHandle.seekToEndOfFile()
                                fileHandle.write(lineData)
                                fileHandle.closeFile()
                                print("[Flowy] 📝 Session log APPENDED: \(url.path)")
                            }
                        }
                        if let attrs = try? self.fileManager.attributesOfItem(atPath: url.path),
                           let size = attrs[.size] as? NSNumber {
                            print("[Flowy] 📊 File size: \(size.int64Value) bytes")
                        }
                    }
                }
            } catch {
                print("[Flowy] ❌ Storage Error: \(error)")
                print("[Flowy] Path attempted: \(url.path)")
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
            // FlowyEvent.timestamp is a plain TimeInterval (Double), not Date.
            // Do NOT set dateDecodingStrategy — it must match how the encoder wrote it.
            
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

    // MARK: - Export

    /// Reads all wireframe JSON files from Documents/Wireframes/, combines them with
    /// the current session events, and writes a single `flowy_session_<timestamp>.json`
    /// to Documents/. Optionally deletes the individual wireframe files on success.
    func buildExportFile(deleteWireframeParts: Bool, completion: @escaping (Result<URL, Error>) -> Void) {
        queue.async {
            do {
                guard let documents = self.fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
                    throw CocoaError(.fileNoSuchFile)
                }

                // --- Read events ---
                let events = self.retrieveAndClearLog() ?? []

                // --- Read wireframe files ---
                let wireframesDir = documents.appendingPathComponent("Wireframes", isDirectory: true)
                var wireframes: [FlowyWireframeEntry] = []

                if self.fileManager.fileExists(atPath: wireframesDir.path) {
                    let files = try self.fileManager.contentsOfDirectory(
                        at: wireframesDir,
                        includingPropertiesForKeys: [.creationDateKey],
                        options: .skipsHiddenFiles
                    ).filter { $0.pathExtension == "json" }
                      .sorted { $0.lastPathComponent < $1.lastPathComponent }

                    let decoder = JSONDecoder()
                    for file in files {
                        guard let data = try? Data(contentsOf: file) else { continue }

                        // Decode: new format = FlowyWireframeFileData, legacy fallback = ViewNode directly
                        let tree: ViewNode
                        let screenshotBase64: String?
                        if let fileData = try? decoder.decode(FlowyWireframeFileData.self, from: data) {
                            tree = fileData.tree
                            screenshotBase64 = fileData.screenshotBase64
                        } else if let legacyNode = try? decoder.decode(ViewNode.self, from: data) {
                            tree = legacyNode
                            screenshotBase64 = nil
                        } else {
                            continue
                        }

                        // Extract screen name and timestamp from filename: flowy_<name>_<ts>.json
                        let stem = file.deletingPathExtension().lastPathComponent
                        let parts = stem.components(separatedBy: "_")
                        let capturedAt = parts.last.flatMap(Double.init) ?? 0
                        let screenName = parts.dropFirst().dropLast().joined(separator: "_")

                        wireframes.append(FlowyWireframeEntry(
                            screenName: screenName,
                            capturedAt: capturedAt,
                            tree: tree,
                            screenshotBase64: screenshotBase64
                        ))
                    }
                }

                // --- Build bundle ---
                let bundle = FlowySessionBundle(
                    version: 1,
                    exportedAt: Date().timeIntervalSince1970,
                    events: events,
                    wireframes: wireframes
                )

                let encoder = JSONEncoder()
                encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
                let data = try encoder.encode(bundle)

                // Use millisecond precision to avoid same-second filename collision
                // when didEnterBackground and willTerminate both fire close together.
                let timestamp = Int(Date().timeIntervalSince1970 * 1000)
                let exportURL = documents.appendingPathComponent("flowy_session_\(timestamp).json")
                try data.write(to: exportURL, options: .atomic)

                print("[Flowy] ✅ Export bundle saved: \(exportURL.path)")
                print("[Flowy] 📦 \(events.count) events + \(wireframes.count) wireframes → \(data.count) bytes")

                // --- Always clean up runtime files after successful export ---
                // Delete session log
                if let logURL = self.sessionFileURL, self.fileManager.fileExists(atPath: logURL.path) {
                    try? self.fileManager.removeItem(at: logURL)
                    print("[Flowy] 🧹 Deleted session log")
                }
                // Delete individual wireframe files and folder
                if self.fileManager.fileExists(atPath: wireframesDir.path) {
                    let files = (try? self.fileManager.contentsOfDirectory(
                        at: wireframesDir,
                        includingPropertiesForKeys: nil,
                        options: .skipsHiddenFiles
                    ).filter { $0.pathExtension == "json" }) ?? []
                    for file in files { try? self.fileManager.removeItem(at: file) }
                    if files.isEmpty { try? self.fileManager.removeItem(at: wireframesDir) }
                    print("[Flowy] 🧹 Cleaned up \(files.count) wireframe files")
                }

                completion(.success(exportURL))
            } catch {
                print("[Flowy] ❌ Export bundle error: \(error)")
                completion(.failure(error))
            }
        }
    }
}
