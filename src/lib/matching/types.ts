/**
 * Shared types for the deterministic matching engine.
 *
 * All time values are epoch milliseconds in UTC. Conversion from a user's
 * local wall-clock time + IANA timezone into UTC happens at the request
 * boundary (see lib/validation), never inside the matching core. Intervals are
 * half-open: [start, end).
 */

export type Mode = "invite" | "friendship" | "dating";

export type BillPreference = "each_pays_own" | "split_evenly" | "i_treat" | "needs_discussion";

/** A half-open availability window in UTC epoch milliseconds: [start, end). */
export interface Window {
  start: number;
  end: number;
}

/** GeoJSON-style ring: array of [longitude, latitude] pairs. */
export type Ring = [number, number][];

/** One meeting request's matchable inputs, already normalized to UTC. */
export interface RequestInput {
  userId: string;
  mode: Mode;
  /** Merged, non-overlapping free windows in UTC. */
  windows: Window[];
  durationMinutes: number;
  /** Buffer added around a booked slot, in minutes. */
  bufferMinutes: number;
  activityIds: string[];
  /** Area as one or more polygon rings (outer rings only for the MVP pre-filter). */
  area: Ring[];
  /** Budget ceiling in integer US cents. 0 means "free", not "unset". */
  maxBudgetCents: number;
  /** Optional floor in cents; defaults to 0. */
  minBudgetCents?: number;
  billPreference: BillPreference;
}

/** A single concrete, acceptable meeting option produced by the engine. */
export interface Proposal {
  startsAt: number;
  endsAt: number;
  activityId: string;
  budgetCeilingCents: number;
  billStatus: "compatible" | "needs_discussion";
}

/** Why a pair produced no proposals, surfaced to the UI as aggregate reasons. */
export type EmptyReason =
  | "no_shared_time"
  | "no_shared_activities"
  | "no_shared_area"
  | "no_option_within_budget";

export interface MatchResult {
  proposals: Proposal[];
  /** Populated only when proposals is empty. */
  reason?: EmptyReason;
  /** Count of distinct overlapping windows, used by ranking. */
  sharedWindowCount: number;
}
