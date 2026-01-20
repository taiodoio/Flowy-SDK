"use client"

import { useMemo } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    MarkerType,
    useNodesState,
    useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from "@/components/ui/card"

interface FlowyEvent {
    id: String
    // Supports both Legacy (type) and Vision (action)
    type?: String
    action?: String

    // Legacy fields
    name?: String
    screenName?: String
    elementId?: String
    elementText?: String

    // New Vision fields
    ocr_text?: String
    screen_name?: String
    coordinates?: { x: number, y: number }

    timestamp: String | number
    parameters?: Record<string, string>
}

interface Session {
    id: string
    events: FlowyEvent[]
}

interface FlowGraphProps {
    session: Session
}

export function FlowGraph({ session }: FlowGraphProps) {
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        let lastScreenId: string | null = null;
        let yOffset = 0;
        const xOffset = 250;

        session.events.forEach((event, index) => {
            // Normalize Types
            // Vision sends 'action', Legacy sends 'type'
            const rawType = event.action || event.type || "unknown";
            const type = rawType.toString().toLowerCase();

            // Detect Screen View
            if (type === 'screen' || type === 'screenview') {
                const nodeId = `screen-${index}`;

                // Priority: screen_name (Vision) > screenName (Legacy) > name
                let rawLabel = event.screen_name || event.screenName || event.name || "Unknown Screen";

                // Helper to clean up display names
                const sanitizeLabel = (name: String) => {
                    let s = name.toString();
                    // Remove technical controller suffixes
                    s = s.replace(/UIHostingController<(.+)>/, "$1");
                    s = s.replace(/ViewController/i, "");
                    // Fix common SwiftUI generic names
                    if (s.includes(".")) s = s.split(".").pop() || s;
                    // Capitalize space split
                    return s.replace(/([A-Z])/g, ' $1').trim();
                };

                let label = sanitizeLabel(rawLabel);
                if (label.length > 25) label = label.substring(0, 23) + "...";

                nodes.push({
                    id: nodeId,
                    type: 'default',
                    data: { label: label },
                    position: { x: xOffset, y: yOffset },
                    style: {
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        color: '#f8fafc',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '12px',
                        padding: '12px',
                        width: 200,
                        fontWeight: '600',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                    }
                });

                if (lastScreenId) {
                    edges.push({
                        id: `edge-${lastScreenId}-${nodeId}`,
                        source: lastScreenId,
                        target: nodeId,
                        animated: true,
                        style: { stroke: '#64748b' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
                    });
                }

                lastScreenId = nodeId;
                yOffset += 150;
            }
            // Detect Action / Tap
            else if (type === 'action' || type === 'tap' || type === 'secure_tap') {
                // Determine label: ocr_text (Vision) > elementText (Legacy) > elementId
                let labelText = event.ocr_text || event.elementText || event.elementId || "Tap";

                // Handle Privacy Masking explicitly
                if (type === 'secure_tap' || labelText === '[SECURE_FIELD]') {
                    labelText = "🔒 Secure Input";
                }

                if (labelText.toString().includes("_UIButtonBarButton")) {
                    labelText = "Action";
                }

                // Clean up technical IDs if that's all we have
                if (labelText.toString().startsWith("static_")) {
                    labelText = labelText.toString().replace("static_", "").replace(/_/g, " ");
                }

                const nodeId = `action-${index}`;
                const parentId = lastScreenId;

                nodes.push({
                    id: nodeId,
                    type: 'output',
                    data: { label: labelText },
                    position: { x: xOffset + 250, y: yOffset - 100 },
                    style: {
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '13px',
                        borderRadius: '20px',
                        width: 'auto',
                        minWidth: '120px',
                        padding: '8px 16px',
                        fontWeight: '500',
                        boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)'
                    }
                });

                if (parentId) {
                    edges.push({
                        id: `edge-action-${parentId}-${nodeId}`,
                        source: parentId,
                        target: nodeId,
                        style: { stroke: '#94a3b8', strokeDasharray: '5,5' },
                    });
                }
            }
            // Detect Error
            else if (type === 'error') {
                const nodeId = `error-${index}`;
                // Fallback priorities for error message
                const label = event.ocr_text || event.name || event.elementText || "Error";

                nodes.push({
                    id: nodeId,
                    type: 'default',
                    data: { label: `⚠️ ${label}` },
                    position: { x: xOffset - 250, y: yOffset - 100 },
                    style: {
                        background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
                        color: '#fef2f2',
                        border: '1px solid rgba(248, 113, 113, 0.3)',
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        boxShadow: '0 0 20px rgba(220, 38, 38, 0.4)'
                    }
                });

                if (lastScreenId) {
                    edges.push({
                        id: `edge-error-${lastScreenId}-${nodeId}`,
                        source: lastScreenId,
                        target: nodeId,
                        animated: true,
                        style: { stroke: '#ef4444' },
                    });
                }
            }
        });

        return { nodes, edges };
    }, [session]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    return (
        <Card className="w-full h-[600px] bg-slate-950/50 backdrop-blur-md border-white/10 shadow-2xl overflow-hidden rounded-xl">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
            >
                <Background color="#475569" gap={24} size={1} />
                <Controls className="bg-slate-800 border-slate-700 fill-slate-200" />
            </ReactFlow>
        </Card>
    );
}
