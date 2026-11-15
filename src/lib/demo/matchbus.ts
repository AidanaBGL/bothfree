/**
 * Cross-account "match bus" for the demo.
 *
 * Jury (a guy) and Explore-as-User (a girl) are two separate demo personas. When
 * one posts a plan, it's written to a shared localStorage channel so the OTHER
 * persona — in another tab or after switching accounts in the same browser —
 * receives it as an incoming request. If both entered the same activity + area,
 * it's a mutual match. This is a browser-local stand-in for what Supabase
 * Realtime does between two real signed-in users.
 */

export type Persona = "jury" | "demo";

export interface BusPost {
  ts: number;
  persona: Persona;
  name: string;
  emoji: string;
  activityId: string;
  areaId: string;
  whenLabel: string;
}

const KEY = "bf-demo-matchbus";

export const PERSONAS: Record<Persona, { name: string; emoji: string }> = {
  jury: { name: "Alia", emoji: "👩🏻" },
  demo: { name: "Madina", emoji: "👩🏽" },
};

export function readBus(): BusPost[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as BusPost[];
  } catch {
    return [];
  }
}

export function pushBus(post: BusPost): void {
  const all = [post, ...readBus()].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export const BUS_KEY = KEY;
