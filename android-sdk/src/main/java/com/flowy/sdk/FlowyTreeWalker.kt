package com.flowy.sdk

import android.content.res.Resources
import android.view.View
import android.view.ViewGroup

internal object FlowyTreeWalker {

    fun captureHierarchy(rootView: View): List<FlowyDomNode> {
        return listOfNotNull(capture(rootView))
    }

    private fun capture(view: View): FlowyDomNode? {
        if (view.visibility != View.VISIBLE || view.alpha < 0.01f || view.width == 0 || view.height == 0) {
            return null
        }

        val location = IntArray(2)
        view.getLocationOnScreen(location)
        val rect = FlowyDomNode.Rect(
            x = location[0],
            y = location[1],
            width = view.width,
            height = view.height
        )

        var idName: String? = null
        try {
            if (view.id != View.NO_ID) {
                idName = view.resources.getResourceEntryName(view.id)
            }
        } catch (e: Resources.NotFoundException) {
            // Ignore
        }

        val childNodes = mutableListOf<FlowyDomNode>()
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                val child = view.getChildAt(i)
                capture(child)?.let { childNodes.add(it) }
            }
        }

        return FlowyDomNode(
            className = view.javaClass.name,
            frame = rect,
            accessibilityIdentifier = view.contentDescription?.toString() ?: idName,
            isUserInteractionEnabled = view.isClickable || view.isEnabled,
            subviews = if (childNodes.isEmpty()) null else childNodes
        )
    }
}
