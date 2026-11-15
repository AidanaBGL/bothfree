/**
 * Meeting agreement — the core of BothFree. A match isn't the goal; a confirmed
 * meeting is. A meeting moves through an explicit state machine and is only
 * "confirmed" once BOTH sides have agreed to the same date, time, and place.
 */

export type MeetingStatus =
  | "awaiting_them" // you proposed, waiting for the other side
  | "awaiting_you" // they proposed / rescheduled, your turn to confirm
  | "confirmed" // both agreed
  | "cancelled"
  | "completed";

export interface Meeting {
  id: string;
  withName: string;
  emoji: string;
  activityLabel: string;
  /** Proposed slot. */
  date: string; // YYYY-MM-DD
  hour: number; // 0–23
  place: string;
  status: MeetingStatus;
  /** Who made the current (latest) proposal. */
  proposedBy: "you" | "them";
}

export function hourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base}:00 ${period}`;
}

export function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function slotLabel(m: Pick<Meeting, "date" | "hour" | "place">): string {
  return `${dateLabel(m.date)} · ${hourLabel(m.hour)} · ${m.place}`;
}

/** Days until the meeting (for reminders). Negative means in the past. */
export function daysUntil(iso: string): number {
  const d = new Date(`${iso}T00:00:00`).getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now.getTime()) / 86_400_000);
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/** Seeded meetings for the demo, covering every state the jury should see. */
export function seedMeetings(): Meeting[] {
  return [
    {
      id: "mtg-alex",
      withName: "Alex",
      emoji: "💗",
      activityLabel: "Coffee & chat",
      date: futureDate(2),
      hour: 17,
      place: "Blue Bottle, Manhattan",
      status: "confirmed",
      proposedBy: "you",
    },
    {
      id: "mtg-maya",
      withName: "Maya",
      emoji: "🧘",
      activityLabel: "Walk outside",
      date: futureDate(4),
      hour: 10,
      place: "Prospect Park, Brooklyn",
      status: "awaiting_you",
      proposedBy: "them",
    },
    {
      id: "mtg-diego",
      withName: "Diego",
      emoji: "🎸",
      activityLabel: "Live music",
      date: futureDate(6),
      hour: 20,
      place: "Blue Note, Manhattan",
      status: "awaiting_them",
      proposedBy: "you",
    },
  ];
}
