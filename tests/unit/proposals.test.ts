import { describe, expect, it } from "vitest";
import { buildProposals } from "@/lib/matching/proposals";
import type { RequestInput } from "@/lib/matching/types";
import { MINUTE_MS } from "@/lib/matching/time";

const H = 60 * MINUTE_MS;

// Two overlapping NYC-ish rectangles so the bbox pre-filter passes.
const areaA: RequestInput["area"] = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
const areaB: RequestInput["area"] = [[[5, 5], [15, 5], [15, 15], [5, 15], [5, 5]]];

function base(overrides: Partial<RequestInput>): RequestInput {
  return {
    userId: "u",
    mode: "dating",
    windows: [{ start: 0, end: 4 * H }],
    durationMinutes: 60,
    bufferMinutes: 15,
    activityIds: ["coffee"],
    area: areaA,
    maxBudgetCents: 4000,
    minBudgetCents: 0,
    billPreference: "each_pays_own",
    ...overrides,
  };
}

describe("buildProposals", () => {
  it("produces up to three ordered proposals from shared time", () => {
    const a = base({ windows: [{ start: 0, end: 4 * H }] });
    const b = base({ windows: [{ start: 1 * H, end: 4 * H }], area: areaB });
    const result = buildProposals(a, b);
    expect(result.proposals.length).toBe(3);
    // Earliest first, 30-minute aligned to the shared window start (1h).
    expect(result.proposals[0].startsAt).toBe(1 * H);
    expect(result.proposals[1].startsAt).toBe(1 * H + 30 * MINUTE_MS);
    expect(result.proposals[0].endsAt).toBe(2 * H);
    expect(result.proposals[0].activityId).toBe("coffee");
  });

  it("is deterministic across repeated runs", () => {
    const a = base({});
    const b = base({ area: areaB });
    expect(buildProposals(a, b)).toEqual(buildProposals(a, b));
  });

  it("reports no_shared_activities first", () => {
    const a = base({ activityIds: ["coffee"] });
    const b = base({ activityIds: ["music"], area: areaB });
    expect(buildProposals(a, b).reason).toBe("no_shared_activities");
  });

  it("reports no_shared_area when bounding boxes are disjoint", () => {
    const far: RequestInput["area"] = [[[100, 100], [101, 100], [101, 101], [100, 101], [100, 100]]];
    const a = base({});
    const b = base({ area: far });
    expect(buildProposals(a, b).reason).toBe("no_shared_area");
  });

  it("reports no_option_within_budget for an empty budget band", () => {
    const a = base({ maxBudgetCents: 1000 });
    const b = base({ minBudgetCents: 2000, maxBudgetCents: 5000, area: areaB });
    expect(buildProposals(a, b).reason).toBe("no_option_within_budget");
  });

  it("reports no_shared_time when windows do not overlap enough", () => {
    const a = base({ windows: [{ start: 0, end: 1 * H }] });
    const b = base({ windows: [{ start: 2 * H, end: 3 * H }], area: areaB });
    expect(buildProposals(a, b).reason).toBe("no_shared_time");
  });

  it("does not silently shorten: uses the larger requested duration", () => {
    // Shared window is exactly 90m; a wants 60, b wants 120 → must not fit.
    const a = base({ windows: [{ start: 0, end: 90 * MINUTE_MS }], durationMinutes: 60 });
    const b = base({
      windows: [{ start: 0, end: 90 * MINUTE_MS }],
      durationMinutes: 120,
      area: areaB,
    });
    expect(buildProposals(a, b).reason).toBe("no_shared_time");
  });
});
