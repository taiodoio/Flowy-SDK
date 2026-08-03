package com.flowy.sdk

import kotlinx.serialization.Serializable

@Serializable
data class FlowyEvent(
    val action: String,
    val ocr_text: String? = null,
    val coordinates: Coordinate? = null,
    val screen_name: String
) {
    @Serializable
    data class Coordinate(
        val x: Double,
        val y: Double
    )
}

data class FlowyDomNode(
    val className: String,
    val frame: Rect,
    val accessibilityIdentifier: String?,
    val isUserInteractionEnabled: Boolean,
    val subviews: List<FlowyDomNode>? = null
) {
    data class Rect(
        val x: Int,
        val y: Int,
        val width: Int,
        val height: Int
    ) {
        fun contains(px: Int, py: Int): Boolean {
            return px >= x && px <= (x + width) && py >= y && py <= (y + height)
        }
    }
}

data class FlowyHybridElement(
    val type: String,
    val ocrText: String,
    val domId: String?,
    val frame: FlowyDomNode.Rect
)

data class FlowyOptions(
    val uploadUrl: String = "https://api.flowy.com/v1/events"
)
