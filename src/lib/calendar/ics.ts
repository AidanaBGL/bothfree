/**
 * Minimal RFC 5545 .ics generation for a confirmed plan (§12.3).
 *
 * Exports a single VEVENT with a stable UID, UTC DTSTART/DTEND, SEQUENCE,
 * SUMMARY, public meeting place, and the plan URL. It MUST NOT contain phone
 * numbers, emails, or any hidden preferences. Text values are escaped per spec
 * (backslash, comma, semicolon, newline).
 */

export interface IcsEvent {
  /** Stable unique id for the event; same plan keeps the same UID across edits. */
  uid: string;
  /** Monotonically increasing on every change to the event. */
  sequence: number;
  startUtc: Date;
  endUtc: Date;
  summary: string;
  /** Public meeting place / area label only — never a private address. */
  location?: string;
  /** Public plan page URL. */
  url?: string;
  /** Generation timestamp; defaults to now. */
  dtstamp?: Date;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a Date as an RFC 5545 UTC timestamp: YYYYMMDDTHHMMSSZ. */
export function formatUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Escape a text value for an .ics property (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(event: IcsEvent): string {
  const dtstamp = event.dtstamp ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BothFree//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${formatUtc(dtstamp)}`,
    `DTSTART:${formatUtc(event.startUtc)}`,
    `DTEND:${formatUtc(event.endUtc)}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${escapeText(event.url)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  // RFC 5545 requires CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}
