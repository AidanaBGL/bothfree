/**
 * Travel Together demo data (§5). Seeded travel partners for the feed, plus the
 * enums/labels used by the create-trip wizard. Matching uses the deterministic
 * date/budget overlap in lib/travel/overlap — it never invents flights, prices,
 * or bookings.
 */

export type DateMode = "exact" | "flexible" | "unsure";
export type Comfort = "budget" | "standard" | "premium" | "luxury";
export type WithWhom = "one" | "group" | "friends" | "date";

export const COMFORTS: { id: Comfort; emoji: string; label: string; desc: string }[] = [
  { id: "budget", emoji: "🎒", label: "Budget", desc: "Hostels, deals, keep it light." },
  { id: "standard", emoji: "🏨", label: "Standard", desc: "Comfy 3★ hotels, easy pace." },
  { id: "premium", emoji: "✨", label: "Premium", desc: "4★ stays, a few nice extras." },
  { id: "luxury", emoji: "💎", label: "Luxury", desc: "5★, fine dining, the works." },
];

export const WITH_WHOM: { id: WithWhom; emoji: string; label: string }[] = [
  { id: "one", emoji: "👤", label: "One person" },
  { id: "group", emoji: "👥", label: "Small group" },
  { id: "friends", emoji: "🫶", label: "Friends" },
  { id: "date", emoji: "💚", label: "A date" },
];

export const INCLUDES = ["Flights", "Accommodation", "Food", "Activities", "Transport"] as const;
export type Include = (typeof INCLUDES)[number];

export const SPLIT_OPTIONS: { id: string; label: string }[] = [
  { id: "cover", label: "I’ll cover the expenses" },
  { id: "own", label: "Everyone pays their own way" },
  { id: "equal", label: "Split expenses equally" },
  { id: "discuss", label: "Let’s discuss" },
];

export const DESTINATION_SUGGESTIONS = [
  "Las Vegas, Nevada",
  "Miami, Florida",
  "Los Angeles, California",
  "New York, New York",
  "Paris, France",
  "Tokyo, Japan",
];

export interface DemoTrip {
  id: string;
  name: string;
  emoji: string;
  age: number;
  destination: string;
  dateMode: DateMode;
  /** Inclusive ISO window for exact/flexible trips. */
  start?: string;
  end?: string;
  flexibleLabel?: string; // e.g. "December · 3–5 days"
  budgetMinCents: number;
  budgetMaxCents: number;
  comfort: Comfort;
  withWhom: WithWhom;
  note: string;
  likesYouBack: boolean;
  lgbtqFriendly?: boolean;
  /** True for trips the signed-in user posted. */
  mine?: boolean;
  /** Supabase owner id (set when loaded from the database). */
  ownerId?: string;
}

export const DEMO_TRIPS: DemoTrip[] = [
  {
    id: "t-liam",
    name: "Liam",
    emoji: "🧑🏼",
    age: 30,
    destination: "Las Vegas, Nevada",
    dateMode: "exact",
    start: "2026-12-12",
    end: "2026-12-18",
    budgetMinCents: 120000,
    budgetMaxCents: 200000,
    comfort: "premium",
    withWhom: "group",
    note: "Shows, a little gambling, good food. Looking for an easygoing crew.",
    likesYouBack: true,
    lgbtqFriendly: true,
  },
  {
    id: "t-sofia",
    name: "Sofia",
    emoji: "👩🏽",
    age: 27,
    destination: "Miami, Florida",
    dateMode: "exact",
    start: "2026-12-05",
    end: "2026-12-12",
    budgetMinCents: 80000,
    budgetMaxCents: 150000,
    comfort: "standard",
    withWhom: "friends",
    note: "Beach mornings, art-deco walks, Cuban food. Friends trip, split evenly.",
    likesYouBack: false,
    lgbtqFriendly: true,
  },
  {
    id: "t-kenji",
    name: "Kenji",
    emoji: "🧑🏻",
    age: 33,
    destination: "Tokyo, Japan",
    dateMode: "flexible",
    start: "2027-03-01",
    end: "2027-03-31",
    flexibleLabel: "March · 7–10 days",
    budgetMinCents: 200000,
    budgetMaxCents: 350000,
    comfort: "premium",
    withWhom: "one",
    note: "Food, temples, and record shops. Flexible on exact dates in March.",
    likesYouBack: true,
  },
  {
    id: "t-ava",
    name: "Ava",
    emoji: "👩🏼",
    age: 29,
    destination: "Las Vegas, Nevada",
    dateMode: "exact",
    start: "2026-12-14",
    end: "2026-12-20",
    budgetMinCents: 150000,
    budgetMaxCents: 300000,
    comfort: "luxury",
    withWhom: "date",
    note: "Spa, fine dining, a show or two. Looking for someone with similar taste.",
    likesYouBack: true,
    lgbtqFriendly: true,
  },
  {
    id: "t-noah",
    name: "Noah",
    emoji: "🧑🏾",
    age: 26,
    destination: "Los Angeles, California",
    dateMode: "exact",
    start: "2026-12-20",
    end: "2026-12-27",
    budgetMinCents: 60000,
    budgetMaxCents: 120000,
    comfort: "budget",
    withWhom: "group",
    note: "Road-trip energy, hikes, tacos, and the coast. Keeping it affordable.",
    likesYouBack: false,
  },
];

export function budgetLabel(minCents: number, maxCents: number): string {
  return `$${Math.round(minCents / 100).toLocaleString()}–${Math.round(maxCents / 100).toLocaleString()}`;
}

export function tripDatesLabel(t: Pick<DemoTrip, "dateMode" | "start" | "end" | "flexibleLabel">): string {
  if (t.dateMode === "unsure") return "Dates flexible";
  if (t.dateMode === "flexible") return t.flexibleLabel ?? "Flexible dates";
  if (t.start && t.end) {
    const fmt = (iso: string) =>
      new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return `${fmt(t.start)} – ${fmt(t.end)}`;
  }
  return "Dates TBD";
}
