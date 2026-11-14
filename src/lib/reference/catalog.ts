import type { Ring } from "@/lib/matching/types";

/**
 * Reference catalog shared by the UI and the server. In production these rows
 * live in public.activities / public.cities (seeded via supabase/seed.sql); the
 * client only ever submits ids from this allowlist, never free text.
 */

export interface Activity {
  id: string;
  emoji: string;
  label: string;
}

export const ACTIVITIES: Activity[] = [
  { id: "coffee", emoji: "☕", label: "Coffee & chat" },
  { id: "food", emoji: "🍝", label: "Food & drinks" },
  { id: "walk", emoji: "🚶", label: "Walk outside" },
  { id: "arts", emoji: "🎨", label: "Arts & culture" },
  { id: "games", emoji: "🎳", label: "Games & fun" },
  { id: "wellness", emoji: "🧘", label: "Wellness" },
  { id: "music", emoji: "🎵", label: "Live music" },
  { id: "surprise", emoji: "✨", label: "Surprise me" },
];

/** Time-of-day bands in local wall-clock hours, half-open [start, end). */
export const TIME_BANDS = {
  Morning: { emoji: "☀️", startHour: 8, endHour: 12 },
  Afternoon: { emoji: "🌤️", startHour: 12, endHour: 17 },
  Evening: { emoji: "🌙", startHour: 17, endHour: 22 },
} as const;

export type TimeBand = keyof typeof TIME_BANDS;

export interface Area {
  id: string;
  emoji: string;
  label: string;
  /** Rough closed bounding ring [lng, lat] used for the overlap pre-filter. */
  ring: Ring;
}

/** Approximate NYC borough bounding rings (demo-grade, not survey-accurate). */
export const AREAS: Area[] = [
  { id: "manhattan", emoji: "🏙️", label: "Manhattan", ring: box(-74.02, 40.70, -73.91, 40.88) },
  { id: "brooklyn", emoji: "🌉", label: "Brooklyn", ring: box(-74.04, 40.57, -73.83, 40.74) },
  { id: "queens", emoji: "🌳", label: "Queens", ring: box(-73.96, 40.54, -73.70, 40.80) },
  { id: "bronx", emoji: "🌅", label: "Bronx", ring: box(-73.93, 40.79, -73.77, 40.92) },
  { id: "staten", emoji: "🌊", label: "Staten Island", ring: box(-74.26, 40.49, -74.05, 40.65) },
  { id: "anywhere", emoji: "📍", label: "Anywhere in NYC", ring: box(-74.26, 40.49, -73.70, 40.92) },
];

/** Build a closed rectangular ring from a lon/lat bounding box. */
function box(minLng: number, minLat: number, maxLng: number, maxLat: number): Ring {
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ];
}

export const NYC_TIMEZONE = "America/New_York";

export function activityById(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

export function areaById(id: string): Area | undefined {
  return AREAS.find((a) => a.id === id);
}
