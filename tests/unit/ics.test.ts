import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, formatUtc } from "@/lib/calendar/ics";

describe("ics", () => {
  it("formats UTC timestamps per RFC 5545", () => {
    expect(formatUtc(new Date("2026-11-20T18:30:00.000Z"))).toBe("20261120T183000Z");
  });

  it("escapes commas, semicolons, backslashes, and newlines", () => {
    expect(escapeText("Coffee, drinks; then a walk\noutside")).toBe(
      "Coffee\\, drinks\\; then a walk\\noutside",
    );
  });

  it("builds a VEVENT with CRLF lines and no private fields", () => {
    const ics = buildIcs({
      uid: "plan-123@bothfree",
      sequence: 2,
      startUtc: new Date("2026-11-20T18:00:00Z"),
      endUtc: new Date("2026-11-20T19:00:00Z"),
      summary: "Coffee with Alex",
      location: "Manhattan",
      url: "https://bothfree.app/plans/123",
      dtstamp: new Date("2026-11-14T12:00:00Z"),
    });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:plan-123@bothfree");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("DTSTART:20261120T180000Z");
    expect(ics).toContain("SUMMARY:Coffee with Alex");
    expect(ics).toContain("\r\n");
    // No phone/email/preferences leaked.
    expect(ics).not.toMatch(/@.*\.(com|net)\b(?!ree)/i);
  });
});
