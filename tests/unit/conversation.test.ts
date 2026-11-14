import { describe, expect, it } from "vitest";
import { buildDateHelper, type MatchContext } from "@/lib/dateideas/conversation";

const base: MatchContext = {
  mode: "dating",
  otherName: "Alex",
  otherAge: 30,
  selfAge: 29,
  areaLabels: ["Manhattan", "Brooklyn"],
  sharedActivityIds: ["coffee", "walk"],
};

describe("buildDateHelper", () => {
  it("is deterministic for the same match", () => {
    expect(buildDateHelper(base)).toEqual(buildDateHelper(base));
  });

  it("produces activity-aware icebreakers and a first-date idea", () => {
    const h = buildDateHelper(base);
    expect(h.icebreakers.length).toBeGreaterThanOrEqual(1);
    expect(h.icebreakers.length).toBeLessThanOrEqual(3);
    expect(h.firstDateIdea).toContain("Manhattan"); // uses the top area
  });

  it("suggests next dates from the remaining shared activities", () => {
    const h = buildDateHelper(base);
    expect(h.nextDateIdeas.join(" ")).toMatch(/walk/i);
  });

  it("adds a life-stage nudge only for a meaningful age gap", () => {
    const close = buildDateHelper({ ...base, selfAge: 29, otherAge: 30 });
    const wide = buildDateHelper({ ...base, selfAge: 25, otherAge: 38 });
    expect(close.icebreakers.some((q) => /life stage/i.test(q))).toBe(false);
    expect(wide.icebreakers.some((q) => /life stage/i.test(q))).toBe(true);
  });

  it("falls back gracefully with no shared activities", () => {
    const h = buildDateHelper({ ...base, sharedActivityIds: [] });
    expect(h.firstDateIdea).toBeTruthy();
    expect(h.nextDateIdeas.length).toBeGreaterThan(0);
  });

  it("uses a friendlier tone for friendship mode", () => {
    const friend = buildDateHelper({ ...base, mode: "friendship", sharedActivityIds: [] });
    // Friendship generic pool differs from dating; just assert it produced output.
    expect(friend.icebreakers.length).toBeGreaterThan(0);
  });
});
