import { describe, expect, it } from "vitest";
import { billStatus, commonBudget } from "@/lib/matching/budget";

describe("commonBudget", () => {
  it("uses the min ceiling and max floor", () => {
    const r = commonBudget([
      { maxBudgetCents: 4000, minBudgetCents: 0 },
      { maxBudgetCents: 2000, minBudgetCents: 500 },
    ]);
    expect(r).toEqual({ compatible: true, ceilingCents: 2000, floorCents: 500 });
  });

  it("treats a ceiling of 0 (free) as a valid, compatible budget", () => {
    const r = commonBudget([{ maxBudgetCents: 0 }, { maxBudgetCents: 0 }]);
    expect(r.compatible).toBe(true);
    expect(r.ceilingCents).toBe(0);
  });

  it("is incompatible when the band is empty", () => {
    const r = commonBudget([
      { maxBudgetCents: 1000, minBudgetCents: 0 },
      { maxBudgetCents: 4000, minBudgetCents: 2000 },
    ]);
    expect(r.compatible).toBe(false);
  });
});

describe("billStatus", () => {
  it("is compatible only when all preferences match", () => {
    expect(billStatus(["each_pays_own", "each_pays_own"])).toBe("compatible");
    expect(billStatus(["each_pays_own", "i_treat"])).toBe("needs_discussion");
    expect(billStatus(["split_evenly", "needs_discussion"])).toBe("needs_discussion");
  });
});
