'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, Monitor, MousePointer, Lock, ArrowUpDown, AlertCircle, CheckCircle, MessageSquare, RotateCcw } from 'lucide-react';
import type { SessionData, FlowyEvent } from '@/lib/types';
import { findWireframeForEvent } from '@/lib/wireframe-matcher';
import { WireframeRenderer } from './wireframe-renderer';
import { PhoneFrame } from './phone-frame';

interface SessionReplayProps {
  session: SessionData;
}

const ACTION_STYLES: Record<string, { dot: string; tone: string }> = {
  SCREEN:        { dot: 'bg-[var(--text-tertiary)]', tone: 'text-[var(--text-secondary)]' },
  TAP:           { dot: 'bg-[var(--info)]',          tone: 'text-[var(--info)]' },
  SECURE_TAP:    { dot: 'bg-[var(--text-tertiary)]', tone: 'text-[var(--text-secondary)]' },
  SCROLL:        { dot: 'bg-[var(--accent)]',        tone: 'text-[var(--accent)]' },
  ERROR:         { dot: 'bg-[var(--danger)]',        tone: 'text-[var(--danger)]' },
  SUCCESS:       { dot: 'bg-[var(--success)]',       tone: 'text-[var(--success)]' },
  USER_FEEDBACK: { dot: 'bg-[var(--accent)]',        tone: 'text-[var(--accent)]' },
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  SCREEN:        <Monitor className="w-3 h-3" />,
  TAP:           <MousePointer className="w-3 h-3" />,
  SECURE_TAP:    <Lock className="w-3 h-3" />,
  SCROLL:        <ArrowUpDown className="w-3 h-3" />,
  ERROR:         <AlertCircle className="w-3 h-3" />,
  SUCCESS:       <CheckCircle className="w-3 h-3" />,
  USER_FEEDBACK: <MessageSquare className="w-3 h-3" />,
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
  const activeRowRef = useRef<HTMLDivElement>(null);

  const currentEvent = events[currentIndex] as FlowyEvent | undefined;
  const currentAction = ((currentEvent?.action ?? currentEvent?.type ?? '') as string).toUpperCase();
  const currentScreenName = useMemo(() => getCurrentScreenName(events, currentIndex), [events, currentIndex]);

  const currentWireframe = useMemo(() => {
    if (!currentEvent) return null;
    return findWireframeForEvent(currentEvent, session.wireframes);
  }, [currentEvent, session.wireframes]);

  const tapCoords = currentAction === 'TAP' ? currentEvent?.coordinates : null;

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const delay = 800 / speed;
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= events.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, delay);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, events.length]);

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
    return <div className="text-[var(--text-tertiary)] text-sm p-6">No events in this session.</div>;
  }

  const progressPct = events.length > 1 ? (currentIndex / (events.length - 1)) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header / controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setIsPlaying(false); setCurrentIndex(0); }}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-sm text-[var(--text-primary)] transition-colors"
          aria-label="Restart"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => step(-1)}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-sm text-[var(--text-primary)] disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsPlaying(p => !p)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-sm font-medium transition-colors"
        >
          {isPlaying ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Play</>}
        </button>
        <button
          onClick={() => step(1)}
          disabled={currentIndex >= events.length - 1}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-sm text-[var(--text-primary)] disabled:opacity-40 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div className="ml-2 inline-flex items-center bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-0.5">
          {([1, 2, 4] as const).map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2.5 h-8 text-xs font-medium rounded-md transition-colors ${
                speed === s
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs font-mono text-[var(--text-tertiary)]">
          {currentIndex + 1} / {events.length}
        </span>
      </div>

      {/* Scrubber */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={currentIndex}
          onChange={handleScrub}
          className="w-full accent-[var(--accent)] h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${progressPct}%, var(--border) ${progressPct}%, var(--border) 100%)`
          }}
        />
      </div>

      {/* Main area: phone frame + event detail/list */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Phone frame */}
        <div className="mx-auto lg:mx-0">
          <PhoneFrame width={260} label={currentScreenName}>
            {currentWireframe ? (
              <WireframeRenderer
                rootNode={currentWireframe.rootNode}
                containerWidth={260}
                containerHeight={Math.round(260 * (19.5 / 9))}
                tapOverlay={tapCoords ?? null}
                screenshotBase64={currentWireframe.screenshotBase64 ?? (currentWireframe as any).screenshot_base64}
              />
            ) : (
              <div className="w-full h-full bg-[var(--surface)] flex flex-col items-center justify-center gap-2 text-[var(--text-tertiary)]">
                <Monitor className="w-8 h-8 text-[var(--text-muted)]" />
                <span className="text-xs text-center px-4">No wireframe<br />for &ldquo;{currentScreenName}&rdquo;</span>
              </div>
            )}
          </PhoneFrame>
        </div>

        {/* Right pane */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 w-full">
          {/* Current event detail */}
          {currentEvent && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] ${ACTION_STYLES[currentAction]?.tone ?? 'text-[var(--text-secondary)]'}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${ACTION_STYLES[currentAction]?.dot ?? 'bg-[var(--text-tertiary)]'}`} />
                  {ACTION_ICONS[currentAction] ?? null}
                  {currentAction || 'EVENT'}
                </span>
                <span className="text-xs font-mono text-[var(--text-tertiary)] ml-auto">
                  {formatTimestamp(currentEvent.timestamp)}
                </span>
              </div>
              {(currentEvent.ocr_text ?? currentEvent.elementText) && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">OCR / Text</p>
                  <p className="text-[var(--text-primary)] text-sm mt-0.5">{currentEvent.ocr_text ?? currentEvent.elementText}</p>
                </div>
              )}
              {currentEvent.comment && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Comment</p>
                  <p className="text-[var(--accent)] text-sm mt-0.5">{currentEvent.comment}</p>
                </div>
              )}
              {currentEvent.coordinates && (
                <div className="text-xs text-[var(--text-tertiary)] font-mono">
                  Tap @ ({Math.round(currentEvent.coordinates.x)}, {Math.round(currentEvent.coordinates.y)})
                </div>
              )}
            </div>
          )}

          {/* Event timeline */}
          <div className="flex-1 overflow-y-auto max-h-[460px] rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {events.map((event, idx) => {
              const action = ((event.action ?? (event as any).type ?? '') as string).toUpperCase();
              const isActive = idx === currentIndex;
              const label = event.ocr_text ?? (event as any).elementText ?? event.screen_name ?? (event as any).screenName ?? action;
              const styles = ACTION_STYLES[action] ?? { dot: 'bg-[var(--text-tertiary)]', tone: 'text-[var(--text-secondary)]' };
              return (
                <div
                  key={idx}
                  ref={isActive ? activeRowRef : undefined}
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs transition-colors ${
                    isActive
                      ? 'bg-[var(--accent-soft)] border-l-2 border-[var(--accent)]'
                      : 'hover:bg-[var(--surface-hover)] border-l-2 border-transparent'
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                  <span className={`font-mono font-medium w-20 shrink-0 ${styles.tone}`}>{action}</span>
                  <span className="text-[var(--text-primary)] truncate flex-1">{label}</span>
                  <span className="text-[var(--text-muted)] font-mono shrink-0">{formatTimestamp(event.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
