import SwiftUI
import FlowySDK

// Simple Toast Model
struct ToastItem: Equatable {
    let title: String
    let message: String
    let type: ToastType
    
    enum ToastType {
        case success
        case error
        case warning // for timeout
        
        var color: Color {
            switch self {
            case .success: return .green
            case .error: return .red
            case .warning: return .orange
            }
        }
        
        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .error: return "xmark.octagon.fill"
            case .warning: return "clock.fill"
            }
        }
    }
}

struct ContentView: View {
    @State private var showingErrorAlert = false
    @State private var showingSuccessAlert = false
    @State private var textInput: String = ""
    @State private var secureInput: String = ""
    
    // Toast State
    @State private var toast: ToastItem? = nil
    
    var body: some View {
        NavigationView {
            List {
                Section(header: Text("Alert Actions")) {
                    Button(action: {
                        showingSuccessAlert = true
                    }) {
                        Label("Trigger Success Alert", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    }
                    .accessibilityLabel("Success Alert Button")
                    .alert("Success!", isPresented: $showingSuccessAlert) {
                        Button("OK", role: .cancel) { }
                    } message: {
                        Text("Operation completed successfully.")
                    }
                    
                    Button(action: {
                        showingErrorAlert = true
                        // Manually track manual alerts for now, until heuristics catch them
                        Flowy.shared.trackError(description: "User triggered Manual Error")
                    }) {
                        Label("Trigger Error Alert", systemImage: "xmark.circle.fill")
                            .foregroundColor(.red)
                    }
                    .accessibilityLabel("Error Alert Button")
                    .alert("Error Occurred", isPresented: $showingErrorAlert) {
                        Button("Retry", role: .cancel) { }
                    } message: {
                        Text("Something went wrong. Please try again.")
                    }
                }
                
                Section(header: Text("Toast Tests (Heuristics)")) {
                    Button(action: {
                        showToast(title: "Success", message: "Data saved successfully!", type: .success)
                    }) {
                        Label("Show Success Toast", systemImage: "message.fill")
                            .foregroundColor(.green)
                    }
                    .accessibilityLabel("Success Toast Button")
                    
                    Button(action: {
                        showToast(title: "Failed", message: "Connection failed.", type: .error)
                    }) {
                        Label("Show Failed Toast", systemImage: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)
                    }
                    .accessibilityLabel("Failed Toast Button")
                    
                    Button(action: {
                        showToast(title: "Timeout", message: "Request timed out.", type: .warning)
                    }) {
                        Label("Show Timeout Toast", systemImage: "clock")
                            .foregroundColor(.orange)
                    }
                    .accessibilityLabel("Timeout Toast Button")
                }
                
                Section(header: Text("Inputs (Privacy Test)")) {
                    TextField("Enter Username", text: $textInput)
                        .accessibilityLabel("Username Input")
                    
                    SecureField("Enter Password", text: $secureInput)
                        .accessibilityLabel("Password Input")
                }
                
                Section(header: Text("Scroll Test (Content)")) {
                    NavigationLink(destination: ScrollTestView()) {
                        Text("Open Long Scroll View")
                    }
                }
            }
            .navigationTitle("Flowy Tester")
            .overlay(alignment: .top) {
                if let toast = toast {
                    ToastView(item: toast)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .padding()
                        .onAppear {
                            // Dismiss automatically after 3 seconds
                            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                                withAnimation {
                                    if self.toast == toast {
                                        self.toast = nil
                                    }
                                }
                            }
                        }
                }
            }
        }
    }
    
    func showToast(title: String, message: String, type: ToastItem.ToastType) {
        withAnimation {
            self.toast = ToastItem(title: title, message: message, type: type)
        }
    }
}

// Custom Toast View
struct ToastView: View {
    let item: ToastItem
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.type.icon)
                .font(.title2)
                .foregroundColor(item.type.color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                Text(item.message)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.15), radius: 10, x: 0, y: 5)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
        )
    }
}

struct ScrollTestView: View {
    var body: some View {
        List {
            ForEach(0..<20) { i in
                Text("Item \(i)")
                    .padding()
            }
            
            Button("Bottom Action") {
                print("Tapped Bottom")
            }
            .foregroundColor(.blue)
            .accessibilityLabel("Bottom Scroll Action")
        }
        .navigationTitle("Scroll List")
    }
}
