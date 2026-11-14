import { BILL_OPTIONS, type DemoPlan, type DateTag } from "./plans";

/**
 * 50 clearly-labelled TEST profiles (25 men, 25 women) that populate the
 * Discover feed so matching and filters feel alive. These are demo fixtures —
 * NOT real users and NOT a replacement for the algorithm: the deterministic
 * matching still runs over them, and changing filters visibly changes results.
 */

const MALE_NAMES = [
  "James", "Michael", "David", "Daniel", "Chris", "Ethan", "Ryan", "Lucas", "Nathan", "Aaron",
  "Brandon", "Kevin", "Jason", "Marco", "Diego", "Omar", "Andre", "Victor", "Leo", "Tyler",
  "Sean", "Adam", "Caleb", "Miles", "Mason",
];
const FEMALE_NAMES = [
  "Emma", "Olivia", "Sophia", "Ava", "Mia", "Isabella", "Zoe", "Chloe", "Lily", "Grace",
  "Hannah", "Nina", "Maya", "Sara", "Lena", "Priya", "Aisha", "Camila", "Elena", "Ruby",
  "Vera", "Tara", "Ivy", "Nora", "Alba",
];
const MALE_EMOJI = ["🧑🏻", "🧑🏼", "🧑🏽", "🧑🏾", "🧑🏿", "👨🏽", "👨🏻"];
const FEMALE_EMOJI = ["👩🏻", "👩🏼", "👩🏽", "👩🏾", "👩🏿", "🧑‍🦰"];

const ACTIVITY_IDS = ["coffee", "food", "walk", "arts", "games", "wellness", "music", "surprise"];
const AREA_IDS = ["manhattan", "brooklyn", "queens", "bronx", "staten"];
const WHEN = [
  "Mon · 6:00 PM", "Tue · 7:30 PM", "Wed · 12:30 PM", "Thu · 2:00 PM",
  "Fri · 8:00 PM", "Sat · 11:00 AM", "Sun · 10:00 AM",
];
const BUDGETS = ["Free", "Under $20", "$20–40", "Up to $60", "$20–40"];

const NOTES: Record<string, string> = {
  coffee: "Always up for a good flat white and real conversation.",
  food: "On a mission to find the best cheap eats in the city.",
  walk: "Long walks, fresh air, and figuring life out as we go.",
  arts: "Galleries, little indie shows, anything that makes you think.",
  games: "Board games or arcade — friendly competition only.",
  wellness: "Morning person. Yoga, runs, then a slow coffee.",
  music: "Live shows are my love language. Who's coming?",
  surprise: "Open to anything — surprise me with a plan.",
};

function buildTestProfiles(): DemoPlan[] {
  const out: DemoPlan[] = [];
  for (let i = 0; i < 50; i++) {
    const isMale = i < 25;
    const n = isMale ? i : i - 25;
    const name = isMale ? MALE_NAMES[n] : FEMALE_NAMES[n];
    const emoji = isMale ? MALE_EMOJI[n % MALE_EMOJI.length] : FEMALE_EMOJI[n % FEMALE_EMOJI.length];
    const activityId = ACTIVITY_IDS[i % ACTIVITY_IDS.length];
    const areaId = AREA_IDS[i % AREA_IDS.length];
    const whenLabel = WHEN[i % WHEN.length];
    const dateTag: DateTag = whenLabel.startsWith("Sat") || whenLabel.startsWith("Sun") ? "weekend" : "weekday";
    out.push({
      id: `tp-${i}`,
      name,
      emoji,
      age: 24 + (i % 17), // 24–40
      activityId,
      areaId,
      dateTag,
      whenLabel,
      budgetLabel: BUDGETS[i % BUDGETS.length],
      note: NOTES[activityId],
      likesYouBack: i % 5 === 0,
      lgbtqFriendly: i % 3 === 0,
      billLabel: BILL_OPTIONS[i % BILL_OPTIONS.length].label,
    });
  }
  return out;
}

export const TEST_PROFILES: DemoPlan[] = buildTestProfiles();
