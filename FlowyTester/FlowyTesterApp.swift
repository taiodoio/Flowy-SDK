import SwiftUI
import FlowySDK

@main
struct FlowyTesterApp: App {
    init() {
        // Initialize Flowy SDK on App Startup
        Flowy.configure(apiKey: "TEST_API_KEY")
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
