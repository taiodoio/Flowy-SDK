'use client';

import React, { useState, useMemo } from 'react';
import type { WireframeFile, FlowyEvent } from '@/lib/types';
import { findWireframeForEvent } from '@/lib/wireframe-matcher';
import { WireframeRenderer } from './wireframe-renderer';

interface WireframeHeatmapProps {
  wireframes: WireframeFile[];
  tapEvents: FlowyEvent[];
}

const CELL_SIZE = 24; // logical device pixels per grid cell

/**
 * Absolute severity scale — intensity reflects real tap count, not relative rank.
 * Caps at INTENSITY_CAP taps = 1.0 so colours have consistent meaning across all sessions:
 *   1–3 taps  → green   (low)
 *   4–6 taps  → yellow  (medium)
 *   7–8 taps  → orange  (high)
 *   9+ taps   → red     (critical)
 */
const INTENSITY_CAP = 10;

/** Converts internal screen labels (e.g. "UIPredictionViewController_3") into readable names. */
function friendlyScreenLabel(screenName: string, index: number): string {
  let name = screenName;
  // Remove trailing sequence number (_3, _12, etc.)
  name = name.replace(/_\d+$/, '');
  // Strip UIKit boilerplate
  name = name
    .replace(/UIHostingController/gi, '')
    .replace(/UIViewController/gi, '')
    .replace(/ViewController/gi, '')
    .replace(/Controller/gi, '')
    .replace(/^UI/, '');
  // Replace non-alphanumeric with spaces, collapse runs
  name = name.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  // Split camelCase: "DashboardHome" → "Dashboard Home"
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  if (!name || name.length < 2) return `Screen ${index + 1}`;
  // Capitalise each word
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

function buildHeatmapPoints(
  tapEvents: FlowyEvent[],
  deviceW: number,
  deviceH: number
): Array<{ x: number; y: number; intensity: number }> {
  const cols = Math.ceil(deviceW / CELL_SIZE);
  const rows = Math.ceil(deviceH / CELL_SIZE);
  const grid = new Array(cols * rows).fill(0);

  for (const e of tapEvents) {
    if (!e.coordinates) continue;
    const col = Math.floor(e.coordinates.x / CELL_SIZE);
    const row = Math.floor(e.coordinates.y / CELL_SIZE);
    const idx = row * cols + col;
    if (idx >= 0 && idx < grid.length) grid[idx]++;
  }

  const maxCount = Math.max(...grid, 1);
  const result: Array<{ x: number; y: number; intensity: number }> = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const count = grid[row * cols + col];
      if (count === 0) continue;
      result.push({
        x: (col + 0.5) * CELL_SIZE,
        y: (row + 0.5) * CELL_SIZE,
        // Absolute scale: capped at INTENSITY_CAP so 2 taps ≠ red
        intensity: Math.min(count / INTENSITY_CAP, 1),
      });
    }
  }

  return result;
}

export function WireframeHeatmap({ wireframes, tapEvents }: WireframeHeatmapProps) {
  // Count taps per wireframe (timestamp-based)
  const tapCountByScreen = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of tapEvents) {
      const matched = findWireframeForEvent(e, wireframes);
      if (matched) counts[matched.screenName] = (counts[matched.screenName] ?? 0) + 1;
    }
    return counts;
  }, [tapEvents, wireframes]);

  // Sort wireframes by tap count descending (most active screen first)
  const sortedWireframes = useMemo(
    () => [...wireframes].sort((a, b) =>
      (tapCountByScreen[b.screenName] ?? 0) - (tapCountByScreen[a.screenName] ?? 0)
    ),
    [wireframes, tapCountByScreen]
  );

  const [selectedScreen, setSelectedScreen] = useState<string>(
    () => sortedWireframes[0]?.screenName ?? ''
  );

  const currentWireframe = useMemo(
    () => sortedWireframes.find(w => w.screenName === selectedScreen) ?? sortedWireframes[0],
    [sortedWireframes, selectedScreen]
  );

  // Filter taps for the selected screen (timestamp-based matching)
  const filteredTaps = useMemo(() => {
    if (!currentWireframe) return [];
    return tapEvents.filter(e => {
      const matched = findWireframeForEvent(e, wireframes);
      return matched?.screenName === currentWireframe.screenName;
    });
  }, [tapEvents, currentWireframe, wireframes]);

  const deviceW = currentWireframe?.rootNode.frame.width ?? 390;
  const deviceH = currentWireframe?.rootNode.frame.height ?? 844;

  const heatmapPoints = useMemo(
    () => buildHeatmapPoints(filteredTaps, deviceW, deviceH),
    [filteredTaps, deviceW, deviceH]
  );

  if (wireframes.length === 0) {
    return (
      <div className="text-slate-400 text-sm p-6 text-center">
        No wireframes available. Upload wireframe JSON files to enable heatmap.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Screen selector pills — ordered by tap count, with badge */}
      <div className="flex flex-wrap gap-2">
        {sortedWireframes.map((w, idx) => {
          const count = tapCountByScreen[w.screenName] ?? 0;
          const label = friendlyScreenLabel(w.screenName, idx);
          const isActive = selectedScreen === w.screenName;
          return (
            <button
              key={w.screenName}
              onClick={() => setSelectedScreen(w.screenName)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                isActive
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-200'
                  : 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0 text-[10px] font-semibold min-w-[18px] ${
                  isActive ? 'bg-orange-500/40 text-orange-100' : 'bg-slate-700 text-slate-300'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>
          <span className="text-white font-medium">{filteredTaps.length}</span> taps on{' '}
          <span className="text-slate-200">
            {currentWireframe ? friendlyScreenLabel(currentWireframe.screenName, 0) : '—'}
          </span>
        </span>
        {heatmapPoints.length > 0 && (
          <>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" /> 1–3
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-300 ml-1" /> 4–6
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400 ml-1" /> 7–8
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 ml-1" /> 9+ taps
            </span>
          </>
        )}
      </div>

      {/* Wireframe with heatmap overlay */}
      <div className="flex justify-start">
        {currentWireframe ? (
          <WireframeRenderer
            rootNode={currentWireframe.rootNode}
            containerWidth={280}
            containerHeight={600}
            heatmapPoints={heatmapPoints}
            screenshotBase64={currentWireframe.screenshotBase64}
          />
        ) : (
          <div className="w-[280px] h-[600px] rounded-xl border border-white/10 bg-slate-950 flex items-center justify-center text-slate-500 text-sm">
            No wireframe selected
          </div>
        )}
      </div>
    </div>
  );
}
