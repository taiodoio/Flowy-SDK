'use client';

import React, { useState, useMemo } from 'react';
import type { WireframeFile, FlowyEvent } from '@/lib/types';
import { findWireframeForEvent } from '@/lib/wireframe-matcher';
import { WireframeRenderer } from './wireframe-renderer';
import { PhoneFrame } from './phone-frame';

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
      <div className="rounded-xl border border-dashed border-[var(--border)] py-16 px-6 text-center text-[var(--text-tertiary)] text-sm">
        No wireframes available. Upload wireframe JSON files to enable the heatmap.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-tertiary)]">
        <span>
          <span className="text-[var(--text-primary)] font-medium">{filteredTaps.length}</span> taps on{" "}
          <span className="text-[var(--text-secondary)]">
            {currentWireframe ? friendlyScreenLabel(currentWireframe.screenName, 0) : "—"}
          </span>
        </span>
        {heatmapPoints.length > 0 && (
          <span className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" /> 1–3</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-300" /> 4–6</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400" /> 7–8</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> 9+</span>
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
          <div className="flex justify-center lg:justify-start">
            {currentWireframe ? (
              <PhoneFrame width={300}>
                <WireframeRenderer
                  rootNode={currentWireframe.rootNode}
                  containerWidth={300}
                  containerHeight={640}
                  heatmapPoints={heatmapPoints}
                  screenshotBase64={currentWireframe.screenshotBase64 ?? (currentWireframe as any).screenshot_base64}
                />
              </PhoneFrame>
            ) : (
              <div className="w-[300px] h-[640px] rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-tertiary)] text-sm">
                No wireframe selected
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Screens</p>
            <div className="max-h-[640px] overflow-auto pr-1 space-y-2">
              {sortedWireframes.map((w, idx) => {
                const count = tapCountByScreen[w.screenName] ?? 0;
                const label = friendlyScreenLabel(w.screenName, idx);
                const isActive = selectedScreen === w.screenName;
                return (
                  <button
                    key={w.screenName}
                    onClick={() => setSelectedScreen(w.screenName)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs border transition-colors ${
                      isActive
                        ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium"
                        : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <span className="truncate text-left">{label}</span>
                    <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0 text-[10px] font-semibold min-w-[18px] ${
                      isActive ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--surface-2)] text-[var(--text-secondary)]"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
