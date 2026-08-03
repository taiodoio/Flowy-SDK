package com.flowy.sdk

internal object FlowyHybridMatcher {

    fun findBestMatch(nodes: List<FlowyDomNode>, tapCenter: FlowyEvent.Coordinate): FlowyDomNode? {
        val candidates = mutableListOf<FlowyDomNode>()

        fun traverse(nodeList: List<FlowyDomNode>?) {
            if (nodeList == null) return
            for (node in nodeList) {
                if (node.frame.contains(tapCenter.x.toInt(), tapCenter.y.toInt())) {
                    candidates.add(node)
                    traverse(node.subviews)
                }
            }
        }

        traverse(nodes)

        val interactiveCandidates = candidates.filter { it.isUserInteractionEnabled }
        val lookupList = if (interactiveCandidates.isEmpty()) candidates else interactiveCandidates

        // Return the smallest element that contains the tap point
        return lookupList.minByOrNull { it.frame.width * it.frame.height }
    }
}
