/**
 * Deterministic date/budget overlap for Travel Together (§5 of the product
 * spec). Mirrors the core matching philosophy: no AI, no invented availability
 * — just honest set intersection the user can verify.
 *
 * The canonical example: traveller A is free Dec 10–15, traveller B Dec 12–18
 * → the overlap is Dec 12–15. We never invent flight prices or hotel bookings.
 */

export const MS_DAY = 86_400_000;

export interface DateOverlap {
  start: string; // inclusive, YYYY-MM-DD
  end: string; // inclusive
  days: number;
}

function dayMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}
function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Intersection of two inclusive date ranges. Returns the overlapping range and
 * its length in days, or null if the ranges do not meet.
 */
export function dateOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): DateOverlap | null {
  const start = Math.max(dayMs(aStart), dayMs(bStart));
  const end = Math.min(dayMs(aEnd), dayMs(bEnd));
  if (end < start) return null;
  const days = Math.round((end - start) / MS_DAY) + 1;
  return { start: toIso(start), end: toIso(end), days };
}

/** True if two budget bands (in cents) share any common amount. */
export function budgetOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return Math.max(aMin, bMin) <= Math.min(aMax, bMax);
}

/** Human label for an overlap, e.g. "Dec 12 – Dec 15 · 4 days". */
export function formatOverlap(o: DateOverlap): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(o.start)} – ${fmt(o.end)} · ${o.days} day${o.days === 1 ? "" : "s"}`;
}
