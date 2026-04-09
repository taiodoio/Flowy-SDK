import SwiftUI
import Foundation

@available(iOS 13.0, macOS 10.15, *)
public struct FlowyFeedbackView: View {
    @Environment(\.presentationMode) var presentationMode
    
    @State private var comment: String = ""
    @State private var selectedTag: String? = nil
    
    // Callback to send the data back to the manager
    var onSend: ((String, String?) -> Void)?
    var onCancel: (() -> Void)?
    
    public init(onSend: ((String, String?) -> Void)? = nil, onCancel: (() -> Void)? = nil) {
        self.onSend = onSend
        self.onCancel = onCancel
    }
    
    private var isValid: Bool {
        return selectedTag != nil || !comment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    
    public var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                
                Text("Ohoh! What's happened?")
                    .font(.title)
                    .fontWeight(.bold)
                    .padding(.top)
                
                // Quick Feedback Buttons
                VStack(spacing: 12) {
                    FeedbackButton(title: "Feature Not Working", isSelected: selectedTag == "Feature Not Working") {
                        selectedTag = "Feature Not Working"
                    }
                    
                    FeedbackButton(title: "Information not Clear", isSelected: selectedTag == "Information not Clear") {
                        selectedTag = "Information not Clear"
                    }
                    
                    FeedbackButton(title: "That's Cool!", isSelected: selectedTag == "That's Cool!") {
                        selectedTag = "That's Cool!"
                    }
                }
                .padding(.horizontal)
                
                Divider()
                
                // Comment Area
                VStack(alignment: .leading) {
                    Text("Details (Optional)")
                        .font(.caption)
                        .foregroundColor(.gray)
                    
                    if #available(iOS 14.0, macOS 11.0, *) {
                        TextEditor(text: $comment)
                            .frame(height: 100)
                            .padding(4)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(8)
                    } else {
                        TextField("Enter details...", text: $comment)
                            .frame(height: 100)
                            .padding(4)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(8)
                    }
                }
                .padding(.horizontal)
                
                Spacer()
                
                // Action Buttons
                HStack(spacing: 16) {
                    Button(action: {
                        onCancel?()
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Text("Cancel")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.gray.opacity(0.2))
                            .foregroundColor(.primary)
                            .cornerRadius(10)
                    }
                    
                    Button(action: {
                        let finalComment = comment.trimmingCharacters(in: .whitespacesAndNewlines)
                        onSend?(selectedTag ?? "General", finalComment.isEmpty ? nil : finalComment)
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Text("Send")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isValid ? Color.blue : Color.gray)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                    .disabled(!isValid)
                }
                .padding()
            }
            #if os(iOS)
            .navigationBarHidden(true)
            #endif
        }
    }
}

@available(iOS 13.0, macOS 10.15, *)
struct FeedbackButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.body)
                .fontWeight(isSelected ? .semibold : .regular)
                .frame(maxWidth: .infinity)
                .padding()
                .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                .foregroundColor(isSelected ? .blue : .primary)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isSelected ? Color.blue : Color.gray.opacity(0.3), lineWidth: isSelected ? 2 : 1)
                )
                .cornerRadius(10)
        }
    }
}
