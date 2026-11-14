/**
 * Convert a local wall-clock datetime in a given IANA timezone to a UTC epoch
 * in milliseconds (§11.2). Uses Intl, so DST shifts follow the zone's real
 * rules rather than a fixed offset. Returns null for a non-existent local time
 * (e.g. the spring-forward gap), which callers must surface rather than accept
 * silently.
 */
export function localToUtcMs(localIso: string, timeZone: string): number | null {
  const m = localIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const target = {
    year: +y,
    month: +mo,
    day: +d,
    hour: +h,
    minute: +mi,
    second: s ? +s : 0,
  };

  // Start from the naive UTC guess, then correct by the zone's offset at that
  // instant. One refinement pass is enough because offsets change by fixed
  // amounts far from the target resolution.
  const asUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second);
  const offset = zoneOffsetMs(asUtc, timeZone);
  const candidate = asUtc - offset;

  // Verify the candidate maps back to the requested wall-clock time; if not,
  // the local time does not exist (DST gap).
  if (!wallClockMatches(candidate, timeZone, target)) {
    const offset2 = zoneOffsetMs(candidate, timeZone);
    const candidate2 = asUtc - offset2;
    if (!wallClockMatches(candidate2, timeZone, target)) return null;
    return candidate2;
  }
  return candidate;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInZone(epochMs: number, timeZone: string): WallClock {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(epochMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  return { year: get("year"), month: get("month"), day: get("day"), hour, minute: get("minute"), second: get("second") };
}

/** Offset (ms) such that localEpoch = utcEpoch + offset at the given instant. */
function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const wc = partsInZone(epochMs, timeZone);
  const asIfUtc = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  return asIfUtc - epochMs;
}

function wallClockMatches(epochMs: number, timeZone: string, target: WallClock): boolean {
  const wc = partsInZone(epochMs, timeZone);
  return (
    wc.year === target.year &&
    wc.month === target.month &&
    wc.day === target.day &&
    wc.hour === target.hour &&
    wc.minute === target.minute
  );
}
