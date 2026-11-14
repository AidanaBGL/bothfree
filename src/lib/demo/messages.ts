/**
 * Direct-messages demo data (§7).
 *
 * Access rule: you can only message people you have an accepted friendship or a
 * mutual match with — this cuts spam. Blocking disables new messages in that
 * conversation. In production this runs on Supabase Realtime + row-level
 * security; here it's seeded and simulated client-side. Out of scope for now:
 * voice, video, file sharing, group calls.
 */

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
}

export interface Conversation {
  id: string;
  person: { id: string; name: string; emoji: string };
  messages: ChatMessage[];
  unread: number;
  blocked: boolean;
}

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "c-carlos",
    person: { id: "p-carlos", name: "Carlos", emoji: "🧑🏽" },
    unread: 0,
    blocked: false,
    messages: [
      { id: "m1", from: "them", text: "Hey! Loved that taco spot you mentioned 🌮" },
      { id: "m2", from: "me", text: "Right?? We should actually go together." },
      { id: "m3", from: "them", text: "I'm free Saturday afternoon — you in?" },
    ],
  },
  {
    id: "c-hana",
    person: { id: "p-hana", name: "Hana", emoji: "👩🏻" },
    unread: 0,
    blocked: false,
    messages: [
      { id: "m1", from: "them", text: "That exhibit was incredible." },
      { id: "m2", from: "me", text: "The light installation at the end got me." },
      { id: "m3", from: "them", text: "Coffee next week to plan the next one?" },
    ],
  },
  {
    id: "c-omar",
    person: { id: "p-omar", name: "Omar", emoji: "🧑🏾" },
    unread: 1,
    blocked: false,
    messages: [
      { id: "m1", from: "me", text: "That board-game night was so fun." },
      { id: "m2", from: "them", text: "Rematch Friday? Bring a friend 🎲" },
    ],
  },
];

/** Deterministic-ish canned replies so the demo chat feels alive. */
export const CANNED_REPLIES = [
  "Haha totally.",
  "Sounds good to me!",
  "Let's do it 😊",
  "When works for you?",
  "Nice — I'm in.",
  "Can't wait!",
];
