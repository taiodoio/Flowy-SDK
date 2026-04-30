'use client';

import React, { useMemo } from 'react';
import type { ViewNode } from '@/lib/types';

const CLASS_COLOR_MAP: Record<string, string> = {
  // UIKit names
  UIWindow:       'border-slate-600/40 bg-slate-900/10',
  UILabel:        'border-slate-400/50 bg-slate-700/20',
  UIButton:       'border-blue-500/70 bg-blue-500/15',
  UITextField:    'border-amber-500/60 bg-amber-500/15',
  UITextView:     'border-amber-500/50 bg-amber-500/10',
  UIImageView:    'border-emerald-500/50 bg-emerald-500/12',
  // SwiftUI semantic names (from SwiftUIHeuristicParser)
  'Button':              'border-blue-500/70 bg-blue-500/15',
  'Label':               'border-slate-400/50 bg-slate-700/20',
  'Header/Title':        'border-purple-500/60 bg-purple-500/15',
  'Header':              'border-purple-500/60 bg-purple-500/15',
  'Search Bar':          'border-cyan-500/60 bg-cyan-500/15',
  'SearchBar':           'border-cyan-500/60 bg-cyan-500/15',
  'Tab Bar':             'border-orange-500/50 bg-orange-500/12',
  'TabBar':              'border-orange-500/50 bg-orange-500/12',
  'Navigation Bar':      'border-indigo-500/50 bg-indigo-500/12',
  'NavigationBar':       'border-indigo-500/50 bg-indigo-500/12',
  'Image':               'border-emerald-500/50 bg-emerald-500/12',
  'Link':                'border-sky-500/60 bg-sky-500/15',
  'Text':                'border-slate-400/50 bg-slate-700/20',
  'Divider':             'border-slate-500/60 bg-slate-500/20',
  'Toggle':              'border-teal-500/60 bg-teal-500/15',
  'Slider':              'border-violet-500/60 bg-violet-500/15',
  'List':                'border-slate-500/40 bg-slate-800/20',
  'List Tile':           'border-slate-400/40 bg-slate-700/15',
  'Scroll View':         'border-slate-500/30 bg-slate-800/10',
  'VStack':              'border-slate-600/30 bg-slate-900/5',
  'HStack':              'border-slate-600/30 bg-slate-900/5',
  'ZStack':              'border-slate-600/30 bg-slate-900/5',
  'Generic View':        'border-slate-400/35 bg-slate-600/15',
  _default:              'border-slate-400/35 bg-slate-600/15',
};

function getColorClass(className: string): string {
  return CLASS_COLOR_MAP[className] ?? CLASS_COLOR_MAP._default;
}

function renderNode(node: ViewNode, scale: number, depth: number): React.ReactNode {
  const colorClass = getColorClass(node.class_name);
  const w = node.frame.width * scale;
  const h = node.frame.height * scale;
  if (w < 1 || h < 1) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.frame.x * scale,
    top: node.frame.y * scale,
    width: w,
    height: h,
  };

  return (
    <div
      key={`node-${depth}-${node.frame.x}-${node.frame.y}`}
      className={`border rounded-sm overflow-hidden ${colorClass}`}
      style={style}
    >
      {node.text && h > 10 && (
        <span
          className="absolute inset-0 flex items-center justify-center text-white/50 px-0.5 truncate pointer-events-none"
          style={{ fontSize: Math.max(6, Math.min(10, h * 0.4)) }}
        >
          {node.text}
        </span>
      )}
      {node.children?.map((child, i) => renderNode(child, scale, depth + 1))}
    </div>
  );
}

interface WireframeRendererProps {
  rootNode: ViewNode;
  containerWidth?: number;
  containerHeight?: number;
  tapOverlay?: { x: number; y: number } | null;
  heatmapPoints?: Array<{ x: number; y: number; intensity: number }>;
  screenshotBase64?: string;
  className?: string;
}

export function WireframeRenderer({
  rootNode,
  containerWidth = 280,
  containerHeight = 600,
  tapOverlay,
  heatmapPoints,
  screenshotBase64,
  className = '',
}: WireframeRendererProps) {
  const deviceW = rootNode.frame.width || 390;
  const deviceH = rootNode.frame.height || 844;

  const scale = useMemo(
    () => Math.min(containerWidth / deviceW, containerHeight / deviceH),
    [containerWidth, containerHeight, deviceW, deviceH]
  );

  const renderedW = deviceW * scale;
  const renderedH = deviceH * scale;
  const normalizedScreenshotBase64 = (screenshotBase64 ?? '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  const hasScreenshot = normalizedScreenshotBase64.length > 0;

  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface-2)] ${className}`}
      style={{ width: renderedW, height: renderedH, flexShrink: 0 }}
    >
      {/* Screenshot layer — shown at high opacity when available; wireframe nodes are skipped */}
      {hasScreenshot && (
        <img
          src={`data:image/jpeg;base64,${normalizedScreenshotBase64}`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.92 }}
          alt="screen capture"
        />
      )}

      {/* Wireframe nodes — only rendered when no screenshot is available */}
      <div className="absolute inset-0">
        {!hasScreenshot && renderNode(rootNode, scale, 0)}
      </div>

      {/* Heatmap SVG overlay */}
      {heatmapPoints && heatmapPoints.length > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={renderedW}
          height={renderedH}
        >
          <defs>
            <filter id="heatblur" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>
          {/* Blurred glow layer */}
          {heatmapPoints.map((pt, i) => {
            const cx = pt.x * scale;
            const cy = pt.y * scale;
            const r = 32 * scale;
            let color: string;
            if (pt.intensity < 0.33) {
              color = `rgba(50,220,100,${0.55 + pt.intensity * 0.5})`;
            } else if (pt.intensity < 0.66) {
              color = `rgba(255,210,0,${0.65 + pt.intensity * 0.3})`;
            } else if (pt.intensity < 0.85) {
              color = `rgba(255,100,0,${0.72 + pt.intensity * 0.2})`;
            } else {
              color = `rgba(255,30,30,${0.82 + pt.intensity * 0.15})`;
            }
            return (
              <circle key={`blur-${i}`} cx={cx} cy={cy} r={r} fill={color} filter="url(#heatblur)" />
            );
          })}
          {/* Crisp center-dot layer — makes each hotspot readable */}
          {heatmapPoints.map((pt, i) => {
            const cx = pt.x * scale;
            const cy = pt.y * scale;
            const dotR = Math.max(3, 5 * scale);
            let centerColor: string;
            if (pt.intensity < 0.33) {
              centerColor = 'rgba(140,255,160,0.95)';
            } else if (pt.intensity < 0.66) {
              centerColor = 'rgba(255,240,80,0.95)';
            } else if (pt.intensity < 0.85) {
              centerColor = 'rgba(255,160,40,0.95)';
            } else {
              centerColor = 'rgba(255,90,70,0.95)';
            }
            return (
              <circle key={`dot-${i}`} cx={cx} cy={cy} r={dotR} fill={centerColor} />
            );
          })}
        </svg>
      )}

      {/* Tap cursor overlay */}
      {tapOverlay && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: tapOverlay.x * scale - 14,
            top: tapOverlay.y * scale - 14,
            width: 28,
            height: 28,
          }}
        >
          <div className="absolute inset-0 rounded-full bg-red-500/40 border-2 border-red-400 animate-ping" />
          <div className="absolute inset-0 rounded-full bg-red-500/80 border-2 border-white shadow-lg shadow-red-500/50" />
        </div>
      )}
    </div>
  );
}
