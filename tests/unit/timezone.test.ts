import { describe, expect, it } from "vitest";
import { localToUtcMs } from "@/lib/validation/timezone";

describe("localToUtcMs", () => {
  it("converts EST winter time (UTC-5) correctly", () => {
    // 2026-01-15 09:00 America/New_York = 14:00 UTC.
    const ms = localToUtcMs("2026-01-15T09:00", "America/New_York");
    expect(new Date(ms!).toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("converts EDT summer time (UTC-4) correctly", () => {
    // 2026-07-15 09:00 America/New_York = 13:00 UTC.
    const ms = localToUtcMs("2026-07-15T09:00", "America/New_York");
    expect(new Date(ms!).toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });

  it("handles UTC itself", () => {
    const ms = localToUtcMs("2026-03-01T00:00", "UTC");
    expect(new Date(ms!).toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("rejects a malformed local string", () => {
    expect(localToUtcMs("not-a-date", "UTC")).toBeNull();
  });
});
