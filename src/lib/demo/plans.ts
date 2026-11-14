/**
 * Seeded content for the logged-in demo experience:
 *  - TEST_PROFILE: the signed-in user's own profile, pre-filled with info.
 *  - DEMO_PLANS: plans other people have "posted" to meet, shown in the feed.
 *
 * These are demo fixtures for browsing/filtering the feed. The deterministic
 * matching engine still powers real overlap elsewhere; here the focus is the
 * posting + discovery + request-to-join loop.
 */

export interface UserProfile {
  name: string;
  age: number;
  emoji: string;
  city: string;
  bio: string;
  interestIds: string[];
  areaId: string;
}

export const TEST_PROFILE: UserProfile = {
  name: "Jordan Lee",
  age: 29,
  emoji: "🧑🏽",
  city: "New York",
  bio: "New-ish to the city and always up for coffee, a gallery, or a long walk by the water. Here to meet genuine people and actually make plans — not just text forever.",
  interestIds: ["coffee", "walk", "arts", "music"],
  areaId: "manhattan",
};

export type DateTag = "weekday" | "weekend";

export interface DemoPlan {
  id: string;
  name: string;
  emoji: string;
  age: number;
  activityId: string;
  areaId: string;
  dateTag: DateTag;
  whenLabel: string;
  budgetLabel: string;
  note: string;
  likesYouBack: boolean;
}

export const DEMO_PLANS: DemoPlan[] = [
  {
    id: "alia",
    name: "Alia",
    emoji: "👩🏻",
    age: 25,
    activityId: "coffee",
    areaId: "manhattan",
    dateTag: "weekend",
    whenLabel: "Sat · 11:00 AM",
    budgetLabel: "Under $20",
    note: "Looking for a chill coffee + bookshop morning. Good conversation over good espresso.",
    likesYouBack: true,
  },
  {
    id: "madina",
    name: "Madina",
    emoji: "👩🏽",
    age: 24,
    activityId: "music",
    areaId: "manhattan",
    dateTag: "weekend",
    whenLabel: "Fri · 8:00 PM",
    budgetLabel: "$20–40",
    note: "Live jazz downtown — who's in? Love meeting people who actually listen.",
    likesYouBack: true,
  },
  {
    id: "sam",
    name: "Sam",
    emoji: "🚶",
    age: 34,
    activityId: "walk",
    areaId: "queens",
    dateTag: "weekend",
    whenLabel: "Sun · 9:00 AM",
    budgetLabel: "Free",
    note: "Morning run then coffee. All paces welcome — it's really about the company.",
    likesYouBack: true,
  },
  {
    id: "daniyar",
    name: "Daniyar",
    emoji: "🧑🏻",
    age: 27,
    activityId: "walk",
    areaId: "brooklyn",
    dateTag: "weekday",
    whenLabel: "Wed · 6:30 PM",
    budgetLabel: "Under $20",
    note: "Evening riverside walk, maybe tacos after if it clicks.",
    likesYouBack: false,
  },
  {
    id: "priya",
    name: "Priya",
    emoji: "🎨",
    age: 29,
    activityId: "arts",
    areaId: "manhattan",
    dateTag: "weekday",
    whenLabel: "Thu · 2:00 PM",
    budgetLabel: "$20–40",
    note: "Museum afternoon — a new exhibit just opened and I'd love company.",
    likesYouBack: false,
  },
  {
    id: "noah",
    name: "Noah",
    emoji: "🎳",
    age: 27,
    activityId: "games",
    areaId: "brooklyn",
    dateTag: "weekend",
    whenLabel: "Sat · 7:00 PM",
    budgetLabel: "$20–40",
    note: "Board games and ramen night with a small group. Beginners very welcome.",
    likesYouBack: true,
  },
];
