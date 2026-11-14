import { describe, expect, it } from "vitest";
import {
  intersectWindows,
  mergeWindows,
  slotStarts,
  subtractWindows,
  hasFittingSlot,
  MINUTE_MS,
} from "@/lib/matching/time";

const H = 60 * MINUTE_MS;

describe("mergeWindows", () => {
  it("coalesces overlapping and touching windows and drops empties", () => {
    const merged = mergeWindows([
      { start: 0, end: 2 * H },
      { start: 2 * H, end: 3 * H }, // touching → coalesced
      { start: 1 * H, end: 1.5 * H }, // contained
      { start: 5 * H, end: 5 * H }, // empty → dropped
    ]);
    expect(merged).toEqual([{ start: 0, end: 3 * H }]);
  });
});

describe("intersectWindows", () => {
  it("returns only overlapping sub-windows", () => {
    const a = [{ start: 0, end: 4 * H }, { start: 6 * H, end: 8 * H }];
    const b = [{ start: 2 * H, end: 7 * H }];
    expect(intersectWindows(a, b)).toEqual([
      { start: 2 * H, end: 4 * H },
      { start: 6 * H, end: 7 * H },
    ]);
  });

  it("treats a shared edge as no overlap (half-open)", () => {
    const a = [{ start: 0, end: 2 * H }];
    const b = [{ start: 2 * H, end: 4 * H }];
    expect(intersectWindows(a, b)).toEqual([]);
  });
});

describe("subtractWindows", () => {
  it("removes busy ranges, splitting windows as needed", () => {
    const free = [{ start: 0, end: 6 * H }];
    const busy = [{ start: 2 * H, end: 3 * H }];
    expect(subtractWindows(free, busy)).toEqual([
      { start: 0, end: 2 * H },
      { start: 3 * H, end: 6 * H },
    ]);
  });
});

describe("slotStarts", () => {
  it("enumerates 30-minute-aligned starts that fully fit the duration", () => {
    // 90-minute window, 60-minute duration → starts at 0 and 30m only.
    const starts = slotStarts({ start: 0, end: 90 * MINUTE_MS }, 60);
    expect(starts).toEqual([0, 30 * MINUTE_MS]);
  });

  it("returns nothing when the duration does not fit", () => {
    expect(slotStarts({ start: 0, end: 30 * MINUTE_MS }, 60)).toEqual([]);
  });
});

describe("hasFittingSlot", () => {
  it("is true only when some window is long enough", () => {
    expect(hasFittingSlot([{ start: 0, end: 59 * MINUTE_MS }], 60)).toBe(false);
    expect(hasFittingSlot([{ start: 0, end: 60 * MINUTE_MS }], 60)).toBe(true);
  });
});
