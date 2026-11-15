import type { UserProfile } from "./plans";

/**
 * The two demo personas, mirroring the Alia & Madina cards in the Discover feed.
 * Jury signs in as Alia; Explore-as-User signs in as Madina. Because each sees
 * the other in the feed (and both have likesYouBack=true), sending a match
 * between them always results in a mutual match — a reliable jury demo.
 */
export type PersonaKind = "jury" | "demo";

export const PERSONA_PROFILES: Record<PersonaKind, UserProfile & { age: number; emoji: string }> = {
  jury: {
    name: "Alia",
    age: 25,
    emoji: "👩🏻",
    city: "New York",
    bio: "Looking for a chill coffee + bookshop morning. Good conversation over good espresso.",
    interestIds: ["coffee", "walk", "arts"],
    areaId: "manhattan",
    lgbtqFriendly: true,
  },
  demo: {
    name: "Madina",
    age: 24,
    emoji: "👩🏽",
    city: "New York",
    bio: "Live jazz downtown — who's in? Love meeting people who actually listen.",
    interestIds: ["music", "food", "coffee"],
    areaId: "manhattan",
    lgbtqFriendly: true,
  },
};

/** The feed card id each persona represents (so we hide their own card). */
export const PERSONA_SELF_CARD: Record<PersonaKind, string> = {
  jury: "alia",
  demo: "madina",
};
