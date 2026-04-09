
import Foundation
#if canImport(UIKit)
import UIKit

@MainActor
class FlowyLogger {
    static let shared = FlowyLogger()
    
    private let storage: FlowyStorage
    private let uploader: FlowyUploader
    
    // Cache the current screen name for context (updated by logScreenView)
    private var currentScreenName: String = "Unknown"
    
    // Pause state for Feedback Modal
    private var isPaused: Bool = false

    // Visual-diff dedup: use screenshot byte-size changes instead of screen names,
    // because SwiftUI often stays inside one hosting controller.
    private var lastCaptureTime: Date = .distantPast
    private var lastCaptureSize: Int = 0
    private var captureSequence: Int = 0
    private var isScanInFlight: Bool = false
    private var lastScanStartAt: Date = .distantPast
    private let minimumScanInterval: TimeInterval = 1.2
    private var lastTapInteractionAt: Date = .distantPast
    private var pendingTapCaptureWork: DispatchWorkItem?
    private var pendingPostActionScanWork: DispatchWorkItem?
    private var pendingScreenCaptureWork: DispatchWorkItem?
    private var pendingScrollCaptureWork: DispatchWorkItem?
    private let tapCaptureDelay: TimeInterval = 0.8
    private let scrollCaptureDelay: TimeInterval = 0.5
    private let postActionScanDelay: TimeInterval = 1.5
    private let passiveScreenCaptureDelay: TimeInterval = 0.3
    private let suppressPassiveCaptureAfterTapWindow: TimeInterval = 1.0
    private var burstCaptureCount: Int = 0
    private var safeCaptureModeUntil: Date = .distantPast
    private let burstCaptureWindow: TimeInterval = 1.2
    private let burstCaptureThreshold: Int = 3
    private let safeCaptureModeDuration: TimeInterval = 8.0
    private var lastExportedAt: Date = .distantPast
    
    private init() {
        self.storage = FlowyStorage()
        self.uploader = FlowyUploader(storage: self.storage)
        
        setupLifecycleObservations()
    }
    
    private func setupLifecycleObservations() {
        NotificationCenter.default.addObserver(self, selector: #selector(didEnterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(willTerminate), name: UIApplication.willTerminateNotification, object: nil)
    }
    
    @objc private func didEnterBackground() {
        print("[Flowy] App entered background. Saving export bundle...")
        lastExportedAt = Date()
        let sema = DispatchSemaphore(value: 0)
        storage.buildExportFile(deleteWireframeParts: false) { _ in sema.signal() }
        _ = sema.wait(timeout: .now() + 5)
    }

    @objc private func willTerminate() {
        // Skip if didEnterBackground already exported within the last 30 seconds
        // to avoid overwriting a good export with an empty one (session already cleared).
        if Date().timeIntervalSince(lastExportedAt) < 30 {
            print("[Flowy] App will terminate — skipping export (already exported on background transition).")
            return
        }
        print("[Flowy] App will terminate. Saving export bundle...")
        lastExportedAt = Date()
        let sema = DispatchSemaphore(value: 0)
        storage.buildExportFile(deleteWireframeParts: false) { _ in sema.signal() }
        _ = sema.wait(timeout: .now() + 3)
    }
    
    func startMonitoring() {
        isPaused = false
        // UIWindow.sendEvent already gives us global tap interception. Avoid
        // UIApplication.sendAction as well because it duplicates OCR snapshots
        // for many controls and hurts frame rate.
        _ = UIViewController.swizzleViewDidAppear
        _ = UIWindow.swizzleSendEvent
        _ = UIView.swizzleDidAddSubview
        print("[Flowy] Vision-based Auto-Capture started.")
        
        if let path = storage.sessionFileURL?.path {
            print("[Flowy] Log Path: \(path)")
        }
        
        // Disable System Undo Alert to allow custom Shake Feedback
        UIApplication.shared.applicationSupportsShakeToEdit = false
    }
    
    func pauseMonitoring() {
        isPaused = true
        print("[Flowy] Monitoring paused.")
    }
    
    func resumeMonitoring() {
        isPaused = false
        print("[Flowy] Monitoring resumed.")
    }
    
    // MARK: - Vision Logging (New Core)
    
    /// Called by the Vision/OCR engine when a tap is processed
    /// Called by the Vision/OCR engine when a tap is processed
    func logVisionInteraction(text: String?, coordinates: CGPoint?, window _: UIWindow?) {
        if isPaused { return }
        lastTapInteractionAt = Date()
        
        // Map CGPoint to FlowyEvent.Coordinate
        var coord: FlowyEvent.Coordinate? = nil

        if let p = coordinates {
            coord = FlowyEvent.Coordinate(x: Double(p.x), y: Double(p.y))
        }
        
        var textToLog = text ?? "NIL"
        
        // Determine Action Type
        // If it's a secure field, keep SECURE_TAP. 
        // Keep TAP as default action for OCR-identified interactions.
        let action = textToLog == "[SECURE_FIELD]" ? "SECURE_TAP" : "TAP"
        
        let event = FlowyEvent(
            action: action,
            ocr_text: textToLog,
            coordinates: coord,
            screen_name: self.currentScreenName
        )
        
        storage.appendEvent(event)
        print("[Flowy] Hybrid TAP: [\(textToLog)] at (\(Int(coord?.x ?? 0)), \(Int(coord?.y ?? 0))) on \(self.currentScreenName)")
        
        // Trigger post-action scan to detect Toasts/Success messages
        // Delay to allow UI to settle/animate. Coalesce rapid taps so we don't
        // stack multiple scans/captures for the same interaction burst.
        pendingPostActionScanWork?.cancel()
        let scanWork = DispatchWorkItem { [weak self] in
            self?.performAfterActionScan()
        }
        pendingPostActionScanWork = scanWork
        DispatchQueue.main.asyncAfter(deadline: .now() + postActionScanDelay, execute: scanWork)

        // Capture screenshot+DOM after tap — 0.8s gives SwiftUI navigation time to settle.
        // Use forceFullExtraction: true so this capture always bypasses the rate-limit,
        // even when a post-scroll screenshot was taken moments before the tap.
        // The passive viewDidAppear capture is suppressed (suppressPassiveCaptureAfterTapWindow)
        // when this fires, so this is the ONLY capture that records the destination screen.
        pendingTapCaptureWork?.cancel()
        let tapWork = DispatchWorkItem { [weak self] in
            self?.captureScreenshot(forceFullExtraction: true, delay: 0.0, label: "tap")
        }
        pendingTapCaptureWork = tapWork
        DispatchQueue.main.asyncAfter(deadline: .now() + tapCaptureDelay, execute: tapWork)
    }
    
    // MARK: - Scroll Logging

    /// Called by UIWindow+Swizzle when a touch displacement exceeds the tap threshold.
    /// Logs a SCROLL event and schedules a post-scroll screenshot so the replay
    /// can show the content that became visible after scrolling.
    func logScrollInteraction(startPoint: CGPoint, endPoint: CGPoint) {
        if isPaused { return }

        let coord = FlowyEvent.Coordinate(x: Double(startPoint.x), y: Double(startPoint.y))
        let event = FlowyEvent(
            action: "SCROLL",
            ocr_text: nil,
            coordinates: coord,
            screen_name: self.currentScreenName
        )
        storage.appendEvent(event)
        print("[Flowy] ↕️ SCROLL at (\(Int(startPoint.x)), \(Int(startPoint.y))) on \(currentScreenName)")

        // Capture post-scroll screenshot after scroll physics settle.
        // Force extraction so even small visual changes (content shift) are recorded.
        pendingScrollCaptureWork?.cancel()
        let scrollWork = DispatchWorkItem { [weak self] in
            self?.captureScreenshot(forceFullExtraction: true, delay: 0.0, label: "scroll")
        }
        pendingScrollCaptureWork = scrollWork
        DispatchQueue.main.asyncAfter(deadline: .now() + scrollCaptureDelay, execute: scrollWork)
    }

    // MARK: - Screen Lifecycle
    
    // Improved version called by Swizzler
    func logScreenView(vc: UIViewController) {
        if isPaused { return }
        
        // Log screen event quickly (0.1s) so the event timestamp is accurate
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self, weak vc] in
            guard let self = self, let vc = vc else { return }
            
            let deducedName = FlowyScreenReader.deduceScreenName(viewController: vc)
            let finalScreenName = FlowyHeuristics.cleanScreenName(deducedName)
            
            self.currentScreenName = finalScreenName
            self.logScreenViewEvent(name: finalScreenName)
            self.scanVisibleStatus(in: vc.view)
        }

        // Capture screenshot separately for passive screen transition. If this
        // screen appeared immediately after a tap, the delayed tap capture will
        // already record the settled destination screen, so skip the duplicate.
        pendingScreenCaptureWork?.cancel()
        let screenWork = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            let sinceTap = Date().timeIntervalSince(self.lastTapInteractionAt)
            guard sinceTap >= self.suppressPassiveCaptureAfterTapWindow else {
                print("[Flowy] ⏭️ Screen capture skipped — recent tap capture will cover this transition")
                return
            }
            self.captureScreenshot(forceFullExtraction: false, delay: 0.0, label: "screen")
        }
        pendingScreenCaptureWork = screenWork
        DispatchQueue.main.asyncAfter(deadline: .now() + passiveScreenCaptureDelay, execute: screenWork)
    }

    private func logScreenViewEvent(name: String) {
        let event = FlowyEvent(
            action: "SCREEN",
            ocr_text: nil,
            coordinates: nil,
            screen_name: name
        )
        storage.appendEvent(event)
        print("[Flowy] Screen: \(name)")
    }
    
    // MARK: - Heuristic Scans (Legacy/Hybrid)
    
    // Scan method to find "Success", "Error" labels on screen
    // This is still useful for auto-detecting state changes that aren't taps.
    // MARK: - Post-Action Scanning
    
    /// Triggered 1.0s after an action to check for dynamic updates (Toasts, Error Messages)
    func performAfterActionScan() {
        performImmediateScan()
    }
    
    /// Public API to trigger a scan immediately (e.g. on Shake before Modal appears)
    func performImmediateScan() {
        let now = Date()
        guard !isScanInFlight else {
            print("[Flowy] ⏭️ Scan skipped — previous scan still in flight")
            return
        }
        guard now.timeIntervalSince(lastScanStartAt) >= minimumScanInterval else {
            print("[Flowy] ⏭️ Scan skipped — minimum interval not reached")
            return
        }
        guard let window = getKeyWindow() else { return }
        isScanInFlight = true
        lastScanStartAt = now
        
        // Capture Snapshot at 1x scale — OCR does not need retina quality and
        // rendering at device scale (3x) blocks the main thread unnecessarily.
        let bounds = window.bounds
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(bounds: bounds, format: format)
        let snapshot = renderer.image { ctx in
            window.drawHierarchy(in: bounds, afterScreenUpdates: false)
        }
        
        // Scan via Vision
        FlowyVisionEngine.shared.scanScreen(snapshot: snapshot) { strings in
            var detectedEvent: String? = nil

            for text in strings {
                if FlowyHeuristics.isErrorText(text) {
                    DispatchQueue.main.async { self.logManualEvent(type: "ERROR", text: text) }
                    detectedEvent = "ERROR:\(text)"
                    break
                }
                if FlowyHeuristics.isSuccessText(text) {
                    DispatchQueue.main.async { self.logManualEvent(type: "SUCCESS", text: text) }
                    detectedEvent = "SUCCESS:\(text)"
                    break
                }
            }

            // If an error/success was detected passively (no tap triggered this),
            // capture screenshot+full DOM immediately so the transient message is preserved.
            if detectedEvent != nil {
                DispatchQueue.main.async {
                    // Force full extraction on SUCCESS/ERROR events (important state changes)
                    self.captureScreenshot(forceFullExtraction: true, delay: 0.0, label: "event")
                }
            }

            DispatchQueue.main.async {
                self.isScanInFlight = false
            }
        }
    }
    
    private func getKeyWindow() -> UIWindow? {
        // iOS 13+ compatible helper
        return UIApplication.shared.windows.first { $0.isKeyWindow }
    }
    
    // MARK: - Heuristic Scans (Legacy/Hybrid)
    
    // Scan method to find "Success", "Error" labels on screen
    // This is still useful for auto-detecting state changes that aren't taps.
    private func scanVisibleStatus(in view: UIView) {
        // Keeping legacy logic as fallback or auxiliary
        var queue = [view]
        var scannedCount = 0
        
        while !queue.isEmpty && scannedCount < 50 { 
            let current = queue.removeFirst()
            scannedCount += 1
            
            if let label = current as? UILabel, let text = label.text, !text.isEmpty {
                if FlowyHeuristics.isErrorText(text) {
                     logManualEvent(type: "ERROR", text: text)
                     return 
                }
            }
            queue.append(contentsOf: current.subviews)
        }
    }
    
    /// Hybrid capture strategy: screenshot always captured, DOM extraction conditional.
    /// - If forceFullExtraction: always extract full view hierarchy (for key events: TAP, ERROR, SUCCESS)
    /// - If !forceFullExtraction: extract only if visual change detected (passive screen transitions)
    private func captureScreenshot(forceFullExtraction: Bool, delay: TimeInterval, label: String) {
        let now = Date()
        updateAdaptiveCaptureQuality(now: now)
        if !forceFullExtraction && now.timeIntervalSince(lastCaptureTime) < 1.0 {
            print("[Flowy] ⏱️  Throttled \(label) capture (last capture: \(Int(now.timeIntervalSince(lastCaptureTime)))s ago)")
            return
        }
        
          guard let window = getKeyWindow() else { return }
          guard let screenshot = FlowyScreenshotCapture.capture(from: window) else { return }
        
          let newSize = screenshot.byteCount
        
        if !forceFullExtraction {
            // Passive capture: check visual change before deciding to extract
            let sizeDiff = lastCaptureSize == 0
                ? 1.0
                : abs(Double(newSize) - Double(lastCaptureSize)) / Double(lastCaptureSize)
            
            guard sizeDiff >= 0.08 else {
                print("[Flowy] 🔁 \(label) skipped — screen unchanged (diff: \(Int(sizeDiff * 100))%)")
                return
            }
            print("[Flowy] 📸 Visual change detected (\(label), diff: \(Int(sizeDiff * 100))%) — capturing with placeholder")
        } else {
            print("[Flowy] 📸 Capturing \(label) with full extraction (key event)")
        }
        
        lastCaptureTime = now
        lastCaptureSize = newSize
        captureSequence += 1
        
        let sanitized = currentScreenName
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-")).inverted)
            .filter { !$0.isEmpty }
            .prefix(3)
            .joined(separator: "_")
        let screenLabel = sanitized.isEmpty ? "screen" : sanitized
        let wireframeName = "\(screenLabel)_\(captureSequence)"
        
        // Schedule actual capture after optional delay
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            Flowy.shared.captureWireframe(
                screenName: wireframeName,
                screenshotBase64: screenshot.base64,
                forceFullExtraction: forceFullExtraction
            )
        }
    }

    private func updateAdaptiveCaptureQuality(now: Date) {
        let sinceLastCapture = now.timeIntervalSince(lastCaptureTime)
        if sinceLastCapture <= burstCaptureWindow {
            burstCaptureCount += 1
        } else {
            burstCaptureCount = 1
        }

        if burstCaptureCount >= burstCaptureThreshold {
            safeCaptureModeUntil = now.addingTimeInterval(safeCaptureModeDuration)
            FlowyScreenshotCapture.setQualityProfile(.safe)
            print("[Flowy] ⚙️ Adaptive screenshot mode: SAFE (burst detected)")
            return
        }

        if now >= safeCaptureModeUntil {
            FlowyScreenshotCapture.setQualityProfile(.normal)
        }
    }
    
    // Helper to log non-vision events (Errors, etc)
    func logManualEvent(type: String, text: String?) {
        let event = FlowyEvent(
            action: type,
            ocr_text: text,
            coordinates: nil,
            screen_name: self.currentScreenName
        )
        storage.appendEvent(event)
        print("[Flowy] Event: \(type) - \(text ?? "nil")")
    }
    
    // Internal API for modules (FeedbackManager)
    func logEvent(_ event: FlowyEvent) {
        storage.appendEvent(event)
    }
    
    // MARK: - Compatibility / Public API Support
    
    func logScreenView(name: String) {
        self.currentScreenName = name
        logScreenViewEvent(name: name)
    }

    func buildExport(deleteWireframeParts: Bool) {
        storage.buildExportFile(deleteWireframeParts: deleteWireframeParts) { result in
            switch result {
            case .success(let url):
                print("[Flowy] 📦 Export ready: \(url.lastPathComponent)")
            case .failure(let error):
                print("[Flowy] ❌ Export failed: \(error)")
            }
        }
    }
    
    // Used by Flowy.trackError and Swizzler (legacy) -> Now redirected to logAction if needed or kept for compatibility
    func logAction(type: String, view: UIView?, touchPoint: CGPoint?, window: UIWindow?) {
        let timestamp = Date().timeIntervalSince1970
        
        // 1. Capture DOM (Main Thread - keeping it fast)
        var domSnapshot: [FlowyDomNode] = []
        if let win = window {
             domSnapshot = FlowyTreeWalker.captureHierarchy(in: win)
        } else if let win = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) {
             domSnapshot = FlowyTreeWalker.captureHierarchy(in: win)
        }
        
        // 2. Hybrid Placeholder
        // The OCR part is triggered via `logVisionInteraction` usually.
        // If this comes from Swizzling, we have the DOM.
        
        let event = FlowyEvent(
            action: type,
            ocr_text: nil, // Hybrid matcher would populate this if we had the image here
            coordinates: touchPoint.map { FlowyEvent.Coordinate(x: Double($0.x), y: Double($0.y)) },
            screen_name: self.currentScreenName
        )
        
        // Save to storage
        storage.appendEvent(event)
    }
    
    // Deprecated: interceptAction was related to hierarchy traversal. 
    // The new approach handles taps via UIApplication swizzling -> Vision.
    // We removed the call in Swizzle, so we can remove the method here or keep empty.
    func interceptAction(_ action: Selector, to target: Any?, from sender: Any?, for event: UIEvent?) {
        // No-op in Vision architecture
    }
}
#endif
