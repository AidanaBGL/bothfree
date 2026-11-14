import { billStatus, commonBudget } from "./budget";
import { areasMayOverlap } from "./geo";
import { hasFittingSlot, intersectWindows, slotStarts, MINUTE_MS } from "./time";
import type { MatchResult, Proposal, RequestInput } from "./types";

const MAX_PROPOSALS = 3;

/**
 * Build up to three concrete meeting proposals for a pair of requests, applying
 * the hard filters and tie-break rules from §11 of the spec. Pure and
 * deterministic: identical inputs always yield identical ordered output.
 *
 * Hard filters (in the order the user should be told about failures):
 *   1. shared activity    → no_shared_activities
 *   2. overlapping area    → no_shared_area   (bbox pre-filter; PostGIS confirms)
 *   3. compatible budget   → no_option_within_budget
 *   4. fitting shared time → no_shared_time
 *
 * This operates on two requests (the dating/friend pairing case). Group
 * matching intersects windows across all members the same way.
 */
export function buildProposals(a: RequestInput, b: RequestInput): MatchResult {
  // 1. Shared activities (stable order from `a`).
  const sharedActivities = a.activityIds.filter((id) => b.activityIds.includes(id));
  if (sharedActivities.length === 0) {
    return { proposals: [], reason: "no_shared_activities", sharedWindowCount: 0 };
  }

  // 2. Area overlap pre-filter.
  if (!areasMayOverlap(a.area, b.area)) {
    return { proposals: [], reason: "no_shared_area", sharedWindowCount: 0 };
  }

  // 3. Budget compatibility.
  const budget = commonBudget([a, b]);
  if (!budget.compatible || budget.ceilingCents === undefined) {
    return { proposals: [], reason: "no_option_within_budget", sharedWindowCount: 0 };
  }

  // 4. Shared time. Different desired durations are not silently shortened:
  //    require a fitting block for the larger requested duration.
  const duration = Math.max(a.durationMinutes, b.durationMinutes);
  const shared = intersectWindows(a.windows, b.windows);
  if (!hasFittingSlot(shared, duration)) {
    return { proposals: [], reason: "no_shared_time", sharedWindowCount: shared.length };
  }

  // Enumerate discrete 30-minute-aligned starts across all shared windows.
  const durationMs = duration * MINUTE_MS;
  const candidates: { start: number; windowIndex: number }[] = [];
  shared.forEach((w, windowIndex) => {
    for (const start of slotStarts(w, duration)) {
      candidates.push({ start, windowIndex });
    }
  });

  // Tie-break (stable): earliest start, then more shared activities (constant
  // for a pair, kept for group parity), then earliest shared window index.
  candidates.sort((x, y) => x.start - y.start || x.windowIndex - y.windowIndex);

  const activityId = sharedActivities[0]; // deterministic primary activity
  const bill = billStatus([a.billPreference, b.billPreference]);

  const proposals: Proposal[] = candidates.slice(0, MAX_PROPOSALS).map((c) => ({
    startsAt: c.start,
    endsAt: c.start + durationMs,
    activityId,
    budgetCeilingCents: budget.ceilingCents!,
    billStatus: bill,
  }));

  return { proposals, sharedWindowCount: shared.length };
}
