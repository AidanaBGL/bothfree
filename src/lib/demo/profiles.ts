import { areaById, NYC_TIMEZONE, TIME_BANDS, type TimeBand } from "@/lib/reference/catalog";
import type { RequestInput } from "@/lib/matching/types";
import { localToUtcMs } from "@/lib/validation/timezone";

/**
 * Seeded discovery profiles for the no-login demo. In production these are real
 * people in the same room; here they let the jury scroll a feed and see genuine,
 * server-computed overlap. `likesYouBack` drives the mutual-match notification.
 *
 * Weekdays use JS getUTCDay(): 0 = Sun … 6 = Sat.
 */
export interface DemoProfile {
  id: string;
  name: string;
  emoji: string;
  age: number;
  bio: string;
  areaIds: string[];
  activityIds: string[];
  budgetCents: number;
  freeBands: TimeBand[];
  freeWeekdays: number[];
  availabilityLabel: string;
  likesYouBack: boolean;
}

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: "alex",
    name: "Alex",
    emoji: "💗",
    age: 30,
    bio: "Coffee first, decisions later. Up for most things in Manhattan or Brooklyn.",
    areaIds: ["manhattan", "brooklyn"],
    activityIds: ["coffee", "food", "walk", "music"],
    budgetCents: 4000,
    freeBands: ["Afternoon", "Evening"],
    freeWeekdays: [0, 1, 2, 3, 4, 5, 6],
    availabilityLabel: "Most afternoons & evenings",
    likesYouBack: true,
  },
  {
    id: "maya",
    name: "Maya",
    emoji: "🧘",
    age: 28,
    bio: "Yoga teacher who loves slow mornings and long walks by the water.",
    areaIds: ["brooklyn", "manhattan"],
    activityIds: ["wellness", "coffee", "walk"],
    budgetCents: 2500,
    freeBands: ["Morning", "Afternoon"],
    freeWeekdays: [0, 1, 2, 3, 4, 5, 6],
    availabilityLabel: "Mornings & afternoons, any day",
    likesYouBack: true,
  },
  {
    id: "diego",
    name: "Diego",
    emoji: "🎸",
    age: 31,
    bio: "Guitarist always hunting the next live show. Weekend nights are mine.",
    areaIds: ["manhattan", "queens"],
    activityIds: ["music", "food", "games"],
    budgetCents: 5000,
    freeBands: ["Evening"],
    freeWeekdays: [4, 5, 6],
    availabilityLabel: "Thu–Sat evenings",
    likesYouBack: true,
  },
  {
    id: "priya",
    name: "Priya",
    emoji: "🎨",
    age: 29,
    bio: "Museum regular and matcha enthusiast. Manhattan is my playground.",
    areaIds: ["manhattan"],
    activityIds: ["arts", "coffee", "walk"],
    budgetCents: 3000,
    freeBands: ["Afternoon", "Evening"],
    freeWeekdays: [0, 1, 2, 3, 4, 5, 6],
    availabilityLabel: "Afternoons & evenings in Manhattan",
    likesYouBack: false,
  },
  {
    id: "sam",
    name: "Sam",
    emoji: "🚶",
    age: 34,
    bio: "Runner and park wanderer. Early birds welcome.",
    areaIds: ["brooklyn", "queens"],
    activityIds: ["walk", "wellness", "food"],
    budgetCents: 2000,
    freeBands: ["Morning", "Evening"],
    freeWeekdays: [1, 3, 5],
    availabilityLabel: "Mon/Wed/Fri mornings & evenings",
    likesYouBack: true,
  },
  {
    id: "noah",
    name: "Noah",
    emoji: "🎳",
    age: 27,
    bio: "Board games and ramen are a perfect night. Queens & Brooklyn mostly.",
    areaIds: ["queens", "brooklyn"],
    activityIds: ["games", "food", "coffee"],
    budgetCents: 3500,
    freeBands: ["Evening"],
    freeWeekdays: [2, 3, 4, 6],
    availabilityLabel: "Tue–Thu & Sat evenings",
    likesYouBack: false,
  },
];

/** Expand a profile's weekly availability pattern into concrete UTC windows. */
export function profileToRequest(
  p: DemoProfile,
  mode: RequestInput["mode"],
  horizonDays = 45,
): RequestInput {
  const windows: RequestInput["windows"] = [];
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);

  for (let d = 0; d < horizonDays; d++) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + d);
    if (!p.freeWeekdays.includes(day.getUTCDay())) continue;
    const dateStr = day.toISOString().slice(0, 10);
    for (const band of p.freeBands) {
      const { startHour, endHour } = TIME_BANDS[band];
      const start = localToUtcMs(`${dateStr}T${pad(startHour)}:00`, NYC_TIMEZONE);
      const end = localToUtcMs(`${dateStr}T${pad(endHour)}:00`, NYC_TIMEZONE);
      if (start !== null && end !== null) windows.push({ start, end });
    }
  }

  return {
    userId: `demo-${p.id}`,
    mode,
    windows,
    durationMinutes: 60,
    bufferMinutes: 15,
    activityIds: p.activityIds,
    area: p.areaIds.map((id) => areaById(id)!.ring),
    maxBudgetCents: p.budgetCents,
    minBudgetCents: 0,
    billPreference: "each_pays_own",
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
