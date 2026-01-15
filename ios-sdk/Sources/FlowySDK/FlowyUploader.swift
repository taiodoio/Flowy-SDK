import Foundation
#if canImport(UIKit)
import UIKit
#endif

@MainActor
class FlowyUploader {
    private let storage: FlowyStorage
    
    // Helper class to safely handle the identifier reference across threads
    private class TaskToken {
        #if canImport(UIKit)
        var id: UIBackgroundTaskIdentifier = .invalid
        #else
        var id: Int = 0 
        #endif
    }
    
    init(storage: FlowyStorage) {
        self.storage = storage
    }
    
    func triggerUpload() {
        #if canImport(UIKit)
        let token = TaskToken()
        
        token.id = UIApplication.shared.beginBackgroundTask {
            // Expiration handler: End the task using the token
            UIApplication.shared.endBackgroundTask(token.id)
            token.id = .invalid
        }
        
        // Capture value for the background thread usage
        let taskID = token.id
        
        DispatchQueue.global(qos: .background).async { [weak self] in
            // Capture taskID (Int) by value, safe for background thread
            self?.performUpload {
                // Return to main thread to end the task safely? 
                // endBackgroundTask is thread-safe, so calling from background is OK.
                UIApplication.shared.endBackgroundTask(taskID)
            }
        }
        #endif
    }
    
    private func performUpload(completion: @escaping () -> Void) {
        // ... (rest of the logic remains valid, but ensure 'storage' is thread safe if accessed here)
        // Storage is using its own queue, so it's safe.
        
        // 1. Read locally
        guard let events = storage.retrieveAndClearLog(), !events.isEmpty else {
            print("[Flowy] No events to upload.")
            completion()
            return
        }
        
        print("[Flowy] Background task running. Found \(events.count) events.")
        
        // Simulate network delay
        Thread.sleep(forTimeInterval: 2.0)
        
        completion()
    }
}
