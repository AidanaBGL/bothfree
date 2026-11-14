import type { MatchResult } from "./types";

/**
 * Ranking signals for a discovery candidate (§11.5). Deliberately simple and
 * transparent: no opaque "compatibility score", and Premium never reorders by
 * age, gender, orientation, blocks, or consent.
 */
export interface Candidate {
  id: string;
  match: MatchResult;
  /** Number of activities shared with the viewer. */
  sharedActivityCount: number;
}

/**
 * Stable sort of candidates, best first:
 *   1. earliest first available proposal start (soonest plan wins)
 *   2. more shared activities
 *   3. more alternative shared windows
 *   4. stable tie-break on id
 *
 * Candidates with no feasible proposal sort last among themselves by id.
 */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  const firstStart = (c: Candidate) => c.match.proposals[0]?.startsAt ?? Number.POSITIVE_INFINITY;
  return [...candidates].sort((a, b) => {
    const sa = firstStart(a);
    const sb = firstStart(b);
    if (sa !== sb) return sa - sb;
    if (a.sharedActivityCount !== b.sharedActivityCount) {
      return b.sharedActivityCount - a.sharedActivityCount;
    }
    if (a.match.sharedWindowCount !== b.match.sharedWindowCount) {
      return b.match.sharedWindowCount - a.match.sharedWindowCount;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
