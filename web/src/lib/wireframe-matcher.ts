import type { WireframeFile } from './types';

export function normalizeScreenName(raw: string): string {
  let s = raw;
  // Strip generic type params: Foo<Bar, Baz> → Foo
  s = s.replace(/<[^>]*>/g, '');
  // Strip common UIKit wrappers
  s = s.replace(/UIHostingController/gi, '');
  s = s.replace(/ViewController/gi, '');
  s = s.replace(/Controller/gi, '');
  // Remove everything non-alphanumeric
  s = s.replace(/[^a-zA-Z0-9]/g, '');
  return s.toLowerCase();
}

function longestCommonSubsequenceLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function findWireframe(
  screenName: string | undefined | null,
  wireframes: WireframeFile[] | undefined | null
): WireframeFile | null {
  if (!screenName || !wireframes?.length) return null;
  const key = normalizeScreenName(screenName);
  if (!key) return null;

  // 1. Exact match after normalization
  const exact = wireframes.find(w => w.screenName === key);
  if (exact) return exact;

  // 2. Substring match (one name is contained within the other)
  const sub = wireframes.find(
    w => w.screenName.includes(key) || key.includes(w.screenName)
  );
  if (sub) return sub;

  // 3. Longest common subsequence fallback
  let best: WireframeFile | null = null;
  let bestScore = 0;
  for (const w of wireframes) {
    const score = longestCommonSubsequenceLength(key, w.screenName);
    const threshold = Math.min(key.length, w.screenName.length) * 0.6;
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      best = w;
    }
  }
  return best;
}

/**
 * Find the most relevant wireframe for a given event by timestamp proximity.
 * Prefers wireframes captured within 10 seconds before the event,
 * then within 10 seconds after, then falls back to screen name matching.
 */
export function findWireframeForEvent(
  event: { timestamp?: number; captured_at?: number; screen_name?: string; screenName?: string } | undefined,
  wireframes: WireframeFile[] | undefined | null
): WireframeFile | null {
  if (!event || !wireframes?.length) return null;

  const eventTime = event.timestamp || event.captured_at;
  if (!eventTime) {
    // Fallback to screen name matching if no timestamp
    return findWireframe(event.screen_name || (event as any).screenName, wireframes);
  }

  // Wireframes with a valid capturedAt (camelCase — the WireframeFile field name)
  const withTime = wireframes.filter(w => w.capturedAt && w.capturedAt > 0);

  // Collect candidates: wireframes within 10 seconds before the event (prefer most recent)
  const beforeWindow = withTime.filter(
    w => w.capturedAt <= eventTime && eventTime - w.capturedAt <= 10
  );

  // Wireframes captured within 10 seconds after the event
  const afterWindow = withTime.filter(
    w => w.capturedAt > eventTime && w.capturedAt - eventTime <= 10
  );

  // TAP, SECURE_TAP, and SCROLL prefer the wireframe captured AFTER the event:
  //   - Post-tap screenshots are taken ~0.8s after the tap, showing the destination screen
  //   - Post-scroll screenshots are taken ~0.5s after scroll end, showing shifted content
  // SCREEN, ERROR, SUCCESS prefer the wireframe captured BEFORE (OCR already ran on it).
  const action = ((event as any).action ?? (event as any).type ?? '').toUpperCase();
  const prefersAfter = action === 'TAP' || action === 'SECURE_TAP' || action === 'SCROLL';

  if (prefersAfter) {
    // Prefer closest wireframe captured within 5s AFTER the event.
    // Use a tighter window so we don't accidentally pick up a screenshot from
    // a later unrelated interaction when the user taps rapidly.
    const tightAfter = withTime.filter(
      w => w.capturedAt > eventTime && w.capturedAt - eventTime <= 5
    );
    if (tightAfter.length > 0) {
      return tightAfter.reduce((best, current) =>
        current.capturedAt < best.capturedAt ? current : best
      );
    }
    // Widen to full 10s after window
    if (afterWindow.length > 0) {
      return afterWindow.reduce((best, current) =>
        current.capturedAt < best.capturedAt ? current : best
      );
    }
    // Fallback: most recent before
    if (beforeWindow.length > 0) {
      return beforeWindow.reduce((best, current) =>
        current.capturedAt > best.capturedAt ? current : best
      );
    }
  } else {
    // SCREEN / ERROR / SUCCESS: prefer most recent wireframe before the event
    if (beforeWindow.length > 0) {
      return beforeWindow.reduce((best, current) =>
        current.capturedAt > best.capturedAt ? current : best
      );
    }
    if (afterWindow.length > 0) {
      return afterWindow.reduce((best, current) =>
        current.capturedAt < best.capturedAt ? current : best
      );
    }
  }

  // Final fallback: find the globally closest wireframe by time
  if (withTime.length > 0) {
    return withTime.reduce((best, current) =>
      Math.abs(current.capturedAt - eventTime) < Math.abs(best.capturedAt - eventTime) ? current : best
    );
  }

  // Last resort: screen name matching
  return findWireframe(event.screen_name || (event as any).screenName, wireframes);
}
