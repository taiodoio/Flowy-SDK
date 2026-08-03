package com.flowy.sdk

import android.app.Activity
import android.graphics.Bitmap
import android.util.Log

internal object FlowyLogger {
    private var currentScreenName: String = "Unknown"
    private var isPaused = false

    fun init() {
        Log.d(Flowy.TAG, "FlowyLogger initialized")
    }

    fun logScreenView(activity: Activity) {
        if (isPaused) return
        currentScreenName = activity.javaClass.simpleName
        val event = FlowyEvent(
            action = "SCREEN",
            ocr_text = null,
            coordinates = null,
            screen_name = currentScreenName
        )
        FlowyStorage.appendEvent(event)
        Log.i(Flowy.TAG, "[Flowy] Screen: $currentScreenName")
    }

    fun logVisionInteraction(activity: Activity, tapX: Float, tapY: Float, bitmap: Bitmap) {
        if (isPaused) return

        // 1. Capture DOM Context immediately (Main Thread)
        val windowView = activity.window.decorView.rootView
        val domNodes = FlowyTreeWalker.captureHierarchy(windowView)

        // 2. Process Tap with Vision (Background)
        FlowyVisionEngine.processTap(bitmap, tapX, tapY) { recognizedText, visionRects ->
            
            // Map raw text and hybrid matching
            var actionType = "TAP"
            var textToLog = recognizedText ?: "NIL"
            var elementType: String? = null

            // Hybrid Match: Find closest exact element
            val tapCenter = FlowyEvent.Coordinate(tapX.toDouble(), tapY.toDouble())
            val bestMatch = FlowyHybridMatcher.findBestMatch(domNodes, tapCenter)
            
            if (bestMatch != null) {
                // E.g., android.widget.Button -> Button
                val simpleName = bestMatch.className.substringAfterLast('.')
                elementType = simpleName
                
                // Privacy check for secure fields (EditText with password type)
                if (simpleName.contains("EditText", ignoreCase = true) && bestMatch.accessibilityIdentifier?.contains("password", ignoreCase = true) == true) {
                    textToLog = "[SECURE_FIELD]"
                    actionType = "SECURE_TAP"
                }
            }
            
            if (elementType != null && textToLog != "[SECURE_FIELD]") {
                textToLog = "$textToLog [$elementType]"
            }

            val event = FlowyEvent(
                action = actionType,
                ocr_text = textToLog,
                coordinates = tapCenter,
                screen_name = currentScreenName
            )
            FlowyStorage.appendEvent(event)
            Log.i(Flowy.TAG, "[Flowy] Hybrid TAP: [$textToLog] at (${tapX.toInt()}, ${tapY.toInt()}) on $currentScreenName")
            
            // Post action scan (Toasts/Success/Errors) could be added here
        }
    }
}
