import type { Window } from "./types";

export const MINUTE_MS = 60_000;
export const SLOT_STEP_MS = 30 * MINUTE_MS;

/**
 * Merge a set of half-open windows [start, end) into a minimal, sorted,
 * non-overlapping set. Touching windows (a.end === b.start) are coalesced.
 * Zero/negative-length inputs are dropped.
 */
export function mergeWindows(windows: Window[]): Window[] {
  const valid = windows.filter((w) => w.end > w.start).sort((a, b) => a.start - b.start);
  const out: Window[] = [];
  for (const w of valid) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) {
      last.end = Math.max(last.end, w.end);
    } else {
      out.push({ start: w.start, end: w.end });
    }
  }
  return out;
}

/**
 * Subtract a set of busy windows (e.g. confirmed bookings, past time) from a
 * set of free windows. Inputs need not be pre-merged.
 */
export function subtractWindows(free: Window[], busy: Window[]): Window[] {
  const mergedBusy = mergeWindows(busy);
  let result = mergeWindows(free);
  for (const b of mergedBusy) {
    const next: Window[] = [];
    for (const f of result) {
      if (b.end <= f.start || b.start >= f.end) {
        next.push(f); // no overlap
        continue;
      }
      if (b.start > f.start) next.push({ start: f.start, end: b.start });
      if (b.end < f.end) next.push({ start: b.end, end: f.end });
    }
    result = next;
  }
  return result;
}

/**
 * Intersect two merged window sets. Returns the overlapping sub-windows,
 * sorted and non-overlapping. Each input is merged defensively first.
 */
export function intersectWindows(a: Window[], b: Window[]): Window[] {
  const left = mergeWindows(a);
  const right = mergeWindows(b);
  const out: Window[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const start = Math.max(left[i].start, right[j].start);
    const end = Math.min(left[i].end, right[j].end);
    if (end > start) out.push({ start, end });
    // Advance the window that ends first.
    if (left[i].end <= right[j].end) i++;
    else j++;
  }
  return out;
}

/**
 * From a shared window, enumerate every start time on a 30-minute grid aligned
 * to the window start such that a full `durationMinutes` block fits inside
 * [window.start, window.end). Returns candidate start epoch-ms values.
 */
export function slotStarts(window: Window, durationMinutes: number): number[] {
  const duration = durationMinutes * MINUTE_MS;
  if (duration <= 0) return [];
  const starts: number[] = [];
  for (let t = window.start; t + duration <= window.end; t += SLOT_STEP_MS) {
    starts.push(t);
  }
  return starts;
}

/** True if a full duration block fits anywhere in any shared window. */
export function hasFittingSlot(shared: Window[], durationMinutes: number): boolean {
  const duration = durationMinutes * MINUTE_MS;
  return shared.some((w) => w.end - w.start >= duration);
}
