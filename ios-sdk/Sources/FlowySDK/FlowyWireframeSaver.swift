import Foundation

/// Encodes a `ViewNode` tree to JSON and persists it to the app's Documents/Wireframes directory.
/// This folder is visible in the Files app when the host app sets:
///   - UIFileSharingEnabled = YES
///   - LSSupportsOpeningDocumentsInPlace = YES   (recommended — allows opening in-place)
final class FlowyWireframeSaver {

    private let fileManager = FileManager.default
    private let queue = DispatchQueue(label: "com.flowy.wireframe", qos: .utility)

    // MARK: - Save

    /// Encodes `node` to pretty-printed JSON and writes it to Documents/Wireframes/.
    /// Encoding and I/O run on a background queue; the completion is called there too.
    ///
    /// - Parameters:
    ///   - node: Root `ViewNode` from `ViewHierarchyExtractor`.
    ///   - screenName: Used as the filename prefix (sanitized to alphanumerics + `_-`).
    ///   - completion: Called with the written `URL` on success, or an `Error` on failure.
    func save(
        node: ViewNode,
        screenName: String,
        screenshotBase64: String? = nil,
        completion: ((Result<URL, Error>) -> Void)? = nil
    ) {
        print("[Flowy] 🔸 save() ENTRY - dispatching to background queue")
        queue.async { [self] in
            print("[Flowy] 🔹 Background queue RUNNING - beginning save process")
            do {
                let url = try self.destinationURL(for: screenName)
                let encoder = JSONEncoder()
                encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
                let fileData = FlowyWireframeFileData(tree: node, screenshotBase64: screenshotBase64)
                let data = try encoder.encode(fileData)
                // .atomic ensures either a complete file or nothing — never corrupt partial JSON
                try data.write(to: url, options: .atomic)
                let hasScreenshot = screenshotBase64 != nil
                print("[Flowy] ✅ Wireframe SAVED: \(url.path) (screenshot: \(hasScreenshot ? "yes" : "no"))")
                print("[Flowy] 📊 Wireframe size: \(data.count) bytes")
                completion?(.success(url))
            } catch {
                print("[Flowy] ❌ Wireframe save ERROR: \(error)")
                print("[Flowy] Destination directory: \(fileManager.urls(for: .documentDirectory, in: .userDomainMask).first?.path ?? "UNKNOWN")")
                completion?(.failure(error))
            }
        }
    }

    // MARK: - URL Construction

    private func destinationURL(for screenName: String) throws -> URL {
        print("[Flowy] 📂 destinationURL: Processing screen name: \(screenName.prefix(50))...")
        guard let documents = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
            print("[Flowy] ❌ destinationURL: Cannot access Documents directory")
            throw CocoaError(.fileNoSuchFile)
        }
        print("[Flowy] 📂 Documents path: \(documents.path)")

        let wireframesDir = documents.appendingPathComponent("Wireframes", isDirectory: true)
        print("[Flowy] 📂 Wireframes dir: \(wireframesDir.path)")

        if !fileManager.fileExists(atPath: wireframesDir.path) {
            print("[Flowy] 📂 Creating Wireframes directory...")
            try fileManager.createDirectory(at: wireframesDir, withIntermediateDirectories: true)
            print("[Flowy] 📂 Wireframes directory created ✓")
        } else {
            print("[Flowy] 📂 Wireframes directory already exists")
        }

        let sanitized = screenName
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-")).inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "_")
        
        print("[Flowy] 📂 Sanitized name: \(sanitized.isEmpty ? "[EMPTY - all chars filtered]" : sanitized)")
        
        let timestamp = Int(Date().timeIntervalSince1970)
        let filename = "flowy_\(sanitized.isEmpty ? "screen" : sanitized)_\(timestamp).json"
        let finalURL = wireframesDir.appendingPathComponent(filename)
        
        print("[Flowy] 📂 Final filename: \(filename)")
        print("[Flowy] 📂 Final URL: \(finalURL.path)")

        return finalURL
    }
}
