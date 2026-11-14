import { describe, expect, it } from "vitest";
import { budgetOverlap, dateOverlap, formatOverlap } from "@/lib/travel/overlap";

describe("dateOverlap", () => {
  it("matches the Vegas example (Dec 10–15 ∩ Dec 12–18 = Dec 12–15)", () => {
    const o = dateOverlap("2026-12-10", "2026-12-15", "2026-12-12", "2026-12-18");
    expect(o).toEqual({ start: "2026-12-12", end: "2026-12-15", days: 4 });
  });

  it("returns null for non-overlapping ranges", () => {
    expect(dateOverlap("2026-12-01", "2026-12-05", "2026-12-10", "2026-12-15")).toBeNull();
  });

  it("counts a single shared day as 1 day", () => {
    expect(dateOverlap("2026-12-05", "2026-12-10", "2026-12-10", "2026-12-20")?.days).toBe(1);
  });

  it("formats an overlap label", () => {
    const o = dateOverlap("2026-12-12", "2026-12-15", "2026-12-12", "2026-12-18")!;
    expect(formatOverlap(o)).toBe("Dec 12 – Dec 15 · 4 days");
  });
});

describe("budgetOverlap", () => {
  it("is true when bands intersect", () => {
    expect(budgetOverlap(150000, 200000, 100000, 180000)).toBe(true);
  });
  it("is false when bands are disjoint", () => {
    expect(budgetOverlap(0, 50000, 80000, 120000)).toBe(false);
  });
});
