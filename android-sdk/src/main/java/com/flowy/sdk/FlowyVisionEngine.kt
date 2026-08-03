package com.flowy.sdk

import android.graphics.Bitmap
import android.graphics.Rect
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlin.math.sqrt

internal object FlowyVisionEngine {
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    /**
     * Processes a screenshot with ML Kit and correlates it to the tap coordinate.
     */
    fun processTap(
        bitmap: Bitmap,
        tapX: Float,
        tapY: Float,
        completion: (String?, List<Rect>) -> Unit
    ) {
        val image = InputImage.fromBitmap(bitmap, 0)
        
        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                var bestCandidate: String? = null
                var minDistance = Float.MAX_VALUE
                val allRects = mutableListOf<Rect>()

                for (block in visionText.textBlocks) {
                    for (line in block.lines) {
                        for (element in line.elements) {
                            val rect = element.boundingBox ?: continue
                            allRects.add(rect)

                            // Calculate distance from tap to center of this text element
                            val centerX = rect.exactCenterX()
                            val centerY = rect.exactCenterY()
                            val dx = centerX - tapX
                            val dy = centerY - tapY
                            val distance = sqrt(dx * dx + dy * dy)

                            var finalDistance = distance
                            // Bonus if tap is inside the element bounding box
                            if (rect.contains(tapX.toInt(), tapY.toInt())) {
                                finalDistance = distance / 100f
                            }

                            if (finalDistance < minDistance) {
                                minDistance = finalDistance
                                bestCandidate = element.text
                            }
                        }
                    }
                }
                completion(bestCandidate, allRects)
            }
            .addOnFailureListener { e ->
                Log.e(Flowy.TAG, "Vision Engine failed", e)
                completion(null, emptyList())
            }
    }
}
