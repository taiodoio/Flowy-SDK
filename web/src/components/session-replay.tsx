'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { SessionData, FlowyEvent } from '@/lib/types';
import { findWireframe, findWireframeForEvent } from '@/lib/wireframe-matcher';
import { WireframeRenderer } from './wireframe-renderer';

interface SessionReplayProps {
  session: SessionData;
}

const ACTION_COLORS: Record<string, string> = {
  SCREEN:       'text-slate-300 bg-slate-700/40',
  TAP:          'text-blue-300 bg-blue-900/40',
  SECURE_TAP:   'text-slate-400 bg-slate-700/40',
  SCROLL:       'text-cyan-300 bg-cyan-900/40',
  ERROR:        'text-red-300 bg-red-900/40',
  SUCCESS:      'text-emerald-300 bg-emerald-900/40',
  USER_FEEDBACK:'text-indigo-300 bg-indigo-900/40',
};

const ACTION_ICONS: Record<string, string> = {
  SCREEN:       '📺',
  TAP:          '👆',
  SECURE_TAP:   '🔒',
  SCROLL:       '↕️',
  ERROR:        '❗',
  SUCCESS:      '✅',
  USER_FEEDBACK:'💬',
};

function getCurrentScreenName(events: FlowyEvent[], upToIndex: number): string {
  for (let i = upToIndex; i >= 0; i--) {
    const e = events[i];
    const action = (e.action ?? e.type ?? '').toUpperCase();
    if (action === 'SCREEN' || action === 'SCREENVIEW') {
      return e.screen_name ?? e.screenName ?? e.name ?? 'Unknown';
    }
  }
  return events[0]?.screen_name ?? events[0]?.screenName ?? 'Unknown';
}

function formatTimestamp(ts: number | string): string {
  const n = typeof ts === 'string' ? parseFloat(ts) : ts;
  if (isNaN(n)) return String(ts);
  const d = new Date(n > 1e10 ? n : n * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function SessionReplay({ session }: SessionReplayProps) {
  const events = session.events ?? [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);

  const currentEvent = events[currentIndex] as FlowyEvent | undefined;
  const currentAction = ((currentEvent?.action ?? currentEvent?.type ?? '') as string).toUpperCase();

  const currentScreenName = useMemo(
    () => getCurrentScreenName(events, currentIndex),
    [events, currentIndex]
  );

  const currentWireframe = useMemo(() => {
    if (!currentEvent) return null;
    // Always use timestamp-based matching — name matching fails with sequential labels (screen_1, screen_2...)
    return findWireframeForEvent(currentEvent, session.wireframes);
  }, [currentEvent, session.wireframes]);

  const tapCoords = currentAction === 'TAP' ? currentEvent?.coordinates : null;

  // Auto-play
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const delay = 800 / speed;
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delay);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, events.length]);

  // Scroll active event into view
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(parseInt(e.target.value, 10));
  }, []);

  const step = useCallback((delta: number) => {
    setCurrentIndex(prev => Math.max(0, Math.min(events.length - 1, prev + delta)));
  }, [events.length]);

  if (events.length === 0) {
    return <div className="text-slate-400 text-sm p-6">No events in this session.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setIsPlaying(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-sm text-white transition-colors"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={() => step(-1)}
          disabled={currentIndex === 0}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-sm text-white disabled:opacity-40 transition-colors"
        >
          ← Prev
        </button>
        <button
          onClick={() => step(1)}
          disabled={currentIndex >= events.length - 1}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-sm text-white disabled:opacity-40 transition-colors"
        >
          Next →
        </button>

        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-slate-400">Speed:</span>
          {([1, 2, 4] as const).map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded text-xs border transition-colors ${
                speed === s
                  ? 'bg-blue-600/50 border-blue-500/60 text-blue-200'
                  : 'bg-slate-800 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-slate-400">
          {currentIndex + 1} / {events.length}
        </span>
      </div>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={events.length - 1}
        value={currentIndex}
        onChange={handleScrub}
        className="w-full accent-blue-500 h-1.5 rounded-full"
      />

      {/* Main area */}
      <div className="flex gap-4 items-start">
        {/* Left: wireframe */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <span className="text-xs text-slate-400 truncate max-w-[200px]">{currentScreenName}</span>
          {currentWireframe ? (
            <WireframeRenderer
              rootNode={currentWireframe.rootNode}
              containerWidth={220}
              containerHeight={480}
              tapOverlay={tapCoords ?? null}
              screenshotBase64={currentWireframe.screenshotBase64}
            />
          ) : (
            <div className="w-[220px] h-[480px] rounded-xl border border-white/10 bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-500">
              <span className="text-3xl">📱</span>
              <span className="text-xs text-center px-4">No wireframe for<br />"{currentScreenName}"</span>
            </div>
          )}
        </div>

        {/* Right: event detail + list */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Current event detail card */}
          {currentEvent && (
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${ACTION_COLORS[currentAction] ?? 'text-slate-300 bg-slate-700/40'}`}>
                  {ACTION_ICONS[currentAction] ?? '•'} {currentAction}
                </span>
                <span className="text-slate-400 text-xs ml-auto">{formatTimestamp(currentEvent.timestamp)}</span>
              </div>
              {(currentEvent.ocr_text ?? currentEvent.elementText) && (
                <div>
                  <span className="text-slate-500 text-xs">OCR Text</span>
                  <p className="text-slate-200 text-sm mt-0.5">{currentEvent.ocr_text ?? currentEvent.elementText}</p>
                </div>
              )}
              {currentEvent.comment && (
                <div>
                  <span className="text-slate-500 text-xs">Comment</span>
                  <p className="text-indigo-300 text-sm mt-0.5">{currentEvent.comment}</p>
                </div>
              )}
              {currentEvent.coordinates && (
                <div className="text-xs text-slate-500">
                  Tap @ ({Math.round(currentEvent.coordinates.x)}, {Math.round(currentEvent.coordinates.y)})
                </div>
              )}
            </div>
          )}

          {/* Scrollable event list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto max-h-80 rounded-xl border border-white/10 bg-slate-950/60 divide-y divide-white/5"
          >
            {events.map((event, idx) => {
              const action = ((event.action ?? (event as any).type ?? '') as string).toUpperCase();
              const isActive = idx === currentIndex;
              const label = event.ocr_text ?? (event as any).elementText ?? event.screen_name ?? (event as any).screenName ?? action;
              return (
                <div
                  key={idx}
                  ref={isActive ? activeRowRef : undefined}
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs transition-colors ${
                    isActive
                      ? 'bg-blue-600/20 border-l-2 border-blue-500'
                      : 'hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <span className="text-base leading-none w-4 flex-shrink-0">{ACTION_ICONS[action] ?? '•'}</span>
                  <span className={`font-mono flex-shrink-0 ${ACTION_COLORS[action]?.split(' ')[0] ?? 'text-slate-400'}`}>
                    {action}
                  </span>
                  <span className="text-slate-300 truncate flex-1">{label}</span>
                  <span className="text-slate-600 flex-shrink-0">{formatTimestamp(event.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
