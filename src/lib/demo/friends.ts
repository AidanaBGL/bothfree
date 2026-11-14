/**
 * Friends & friend-requests demo data (§6).
 *
 * Privacy principle: a person's friends list is private — only they can see it.
 * In production this is enforced by row-level security, not just the UI. Here
 * the whole experience is the signed-in user's own view, so no one else's list
 * is ever exposed.
 */

export interface Person {
  id: string;
  name: string;
  emoji: string;
  age: number;
  blurb: string;
  /** Seeded people who would accept your request (so the loop is demoable). */
  likesYouBack?: boolean;
  lgbtqFriendly?: boolean;
}

/** People who have sent YOU a friend request — Accept / Decline. */
export const INCOMING_REQUESTS: Person[] = [
  { id: "p-emma", name: "Emma", emoji: "🧑‍🦰", age: 28, blurb: "Loves hiking and weekend farmers markets.", lgbtqFriendly: true },
  { id: "p-marcus", name: "Marcus", emoji: "🧑🏿", age: 31, blurb: "Film buff and amateur chef." },
  { id: "p-yuki", name: "Yuki", emoji: "👩🏻", age: 26, blurb: "Cyclist, into street photography." },
];

/** "People you may know" — send a request; some will accept back. */
export const FRIEND_SUGGESTIONS: Person[] = [
  { id: "p-carlos", name: "Carlos", emoji: "🧑🏽", age: 30, blurb: "Soccer, tacos, and live music.", likesYouBack: true },
  { id: "p-hana", name: "Hana", emoji: "👩🏻", age: 27, blurb: "Bookstores and matcha afternoons.", lgbtqFriendly: true },
  { id: "p-omar", name: "Omar", emoji: "🧑🏾", age: 33, blurb: "Runner and board-game night host.", likesYouBack: true },
  { id: "p-lena", name: "Lena", emoji: "👩🏼", age: 29, blurb: "Gallery hopper and wine nights." },
  { id: "p-theo", name: "Theo", emoji: "🧑🏻", age: 25, blurb: "Climbing-gym regular, always exploring.", likesYouBack: true },
];
