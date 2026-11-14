import type { Mode } from "@/lib/matching/types";

/**
 * Deterministic conversation & date-idea helper (a Premium feature).
 *
 * IMPORTANT: this is NOT an AI feature. In keeping with the product's "no AI,
 * fully transparent" positioning, suggestions are selected by rules from the
 * match context (shared activities, area, ages, mode) out of curated pools. The
 * output is stable for a given match — same inputs always produce the same
 * icebreakers — so it is predictable and unit-testable.
 */

export interface MatchContext {
  mode: Mode;
  otherName: string;
  otherAge?: number;
  selfAge?: number;
  areaLabels: string[];
  /** Shared activity ids, most relevant first (e.g. ["coffee", "walk"]). */
  sharedActivityIds: string[];
}

export interface DateHelper {
  icebreakers: string[];
  firstDateIdea: string;
  nextDateIdeas: string[];
}

const GENERIC_DATING = [
  "What's something you're weirdly passionate about lately?",
  "Best thing that's happened to you this week?",
  "Are you more of a planner or a go-with-the-flow person?",
  "What does a perfect lazy Sunday look like for you?",
];

const GENERIC_FRIENDSHIP = [
  "What do you usually get up to on a free weekend?",
  "Any hobby you've always wanted to pick up?",
  "What's a place in the city you think everyone should try?",
  "Podcast, playlist, or silence when you're out and about?",
];

const BY_ACTIVITY: Record<string, string[]> = {
  coffee: ["Cortado, pour-over, or just whatever's hot?", "Do you have a go-to café you keep going back to?"],
  food: ["Sweet or savory — where do you land?", "What's the best meal you've had recently?"],
  walk: ["Parks or waterfront for a good walk?", "Do you walk to think, or to switch your brain off?"],
  arts: ["Last exhibit or show that actually stuck with you?", "Do you make anything yourself?"],
  games: ["Board games or arcade?", "Are you competitive, or just here for the snacks?"],
  wellness: ["Morning person, or do you fight the alarm?", "What actually helps you unwind?"],
  music: ["Last gig you went to?", "A song you genuinely can't skip right now?"],
  surprise: ["If I planned something totally random, how adventurous are you?", "What's the most spontaneous thing you've done lately?"],
};

const FIRST_DATE_IDEA: Record<string, (area: string) => string> = {
  coffee: (a) => `Start with coffee somewhere low-key in ${a} — easy to talk, easy to extend if it clicks.`,
  food: (a) => `Grab a casual bite in ${a}; a few small plates to share keeps things relaxed.`,
  walk: (a) => `Take a walk through ${a} — strolling side by side makes conversation flow.`,
  arts: (a) => `Wander a gallery or exhibit in ${a}, then compare favorites over a drink.`,
  games: (a) => `Hit a games spot in ${a} — a little friendly competition breaks the ice fast.`,
  wellness: (a) => `Do something easygoing and active in ${a}, like a walk or a light class, then tea.`,
  music: (a) => `Catch live music in ${a} — low pressure to talk, and plenty to react to together.`,
  surprise: (a) => `Pick a spot in ${a} neither of you has tried and make it a little adventure.`,
};

const NEXT_IDEA: Record<string, string> = {
  coffee: "a relaxed coffee catch-up",
  food: "trying a new restaurant together",
  walk: "a longer walk somewhere scenic",
  arts: "a museum or gallery afternoon",
  games: "a game night or arcade run",
  wellness: "a yoga or wellness session",
  music: "catching live music",
  surprise: "a spontaneous surprise plan",
};

/** Stable string hash (djb2) so selections are deterministic per match. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Pick up to `n` items from a pool, rotating from a seeded offset. */
function pick<T>(pool: T[], seed: number, n: number): T[] {
  if (pool.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    out.push(pool[(seed + i) % pool.length]);
  }
  return out;
}

export function buildDateHelper(ctx: MatchContext): DateHelper {
  const seed = hash(ctx.otherName + "|" + ctx.sharedActivityIds.join(","));
  const area = ctx.areaLabels[0] ?? "the city";
  const topActivity = ctx.sharedActivityIds[0];

  const generic = ctx.mode === "friendship" ? GENERIC_FRIENDSHIP : GENERIC_DATING;

  // One or two activity-specific openers, then fill from the generic pool.
  const activityOpeners = ctx.sharedActivityIds.flatMap((id) => BY_ACTIVITY[id] ?? []);
  const icebreakers = [
    ...pick(activityOpeners, seed, 2),
    ...pick(generic, seed, 2),
  ].slice(0, 3);

  // A small age-gap nudge keeps it human without being creepy or presumptuous.
  if (ctx.selfAge && ctx.otherAge && Math.abs(ctx.selfAge - ctx.otherAge) >= 6) {
    icebreakers.push("You two are at slightly different life stages — ask what each of you is into right now.");
  }

  const firstDateIdea = topActivity && FIRST_DATE_IDEA[topActivity]
    ? FIRST_DATE_IDEA[topActivity](area)
    : `Keep the first meet-up short and low-key somewhere in ${area}.`;

  const nextDateIdeas = ctx.sharedActivityIds
    .slice(1)
    .map((id) => NEXT_IDEA[id])
    .filter(Boolean)
    .slice(0, 3)
    .map((idea) => `Next time: ${idea}.`);
  if (nextDateIdeas.length === 0) {
    nextDateIdeas.push("Next time: build on whatever you both enjoyed most.");
  }

  return { icebreakers, firstDateIdea, nextDateIdeas };
}
