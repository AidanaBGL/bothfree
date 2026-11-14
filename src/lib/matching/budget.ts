import type { BillPreference, RequestInput } from "./types";

export interface BudgetResult {
  compatible: boolean;
  /** Shared ceiling = min of per-person ceilings. Defined only when compatible. */
  ceilingCents?: number;
  /** Lower bound = max of per-person floors. */
  floorCents?: number;
}

/**
 * Compute the common budget band for a set of requests (§11.4).
 *
 * Shared ceiling is the minimum of personal ceilings; shared floor is the
 * maximum of personal floors (default 0). The band is [floor, ceiling]; an
 * empty band (floor > ceiling) is incompatible. A ceiling of 0 means "free",
 * which is a valid, compatible budget — not "unset".
 */
export function commonBudget(requests: Pick<RequestInput, "maxBudgetCents" | "minBudgetCents">[]): BudgetResult {
  if (requests.length === 0) return { compatible: false };
  const ceiling = Math.min(...requests.map((r) => r.maxBudgetCents));
  const floor = Math.max(...requests.map((r) => r.minBudgetCents ?? 0));
  if (floor > ceiling) return { compatible: false };
  return { compatible: true, ceilingCents: ceiling, floorCents: floor };
}

/**
 * Resolve the collective bill status. Identical explicit preferences are
 * compatible; anything mixed (or anyone selecting needs_discussion) surfaces as
 * "needs_discussion". Bill preference never affects gender filtering and never
 * authorizes spending another person's budget.
 */
export function billStatus(preferences: BillPreference[]): "compatible" | "needs_discussion" {
  if (preferences.length === 0) return "needs_discussion";
  if (preferences.includes("needs_discussion")) return "needs_discussion";
  const first = preferences[0];
  return preferences.every((p) => p === first) ? "compatible" : "needs_discussion";
}
