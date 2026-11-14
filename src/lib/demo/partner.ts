import { areaById, NYC_TIMEZONE, TIME_BANDS } from "@/lib/reference/catalog";
import type { RequestInput } from "@/lib/matching/types";
import { localToUtcMs } from "@/lib/validation/timezone";

/**
 * A seeded demo counterpart ("Alex"). In the real product the other side is a
 * second live participant in the same room; for the no-login demo we compute
 * the viewer's request against this fixed profile so the jury sees a genuine,
 * server-computed intersection rather than a canned result.
 *
 * Alex is free every afternoon and evening for the next 10 days in Manhattan &
 * Brooklyn, likes coffee / food / walks / live music, budget up to $40.
 */
export function demoPartner(mode: RequestInput["mode"]): RequestInput {
  const windows: RequestInput["windows"] = [];
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);

  for (let d = 0; d < 10; d++) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + d);
    const dateStr = day.toISOString().slice(0, 10);
    for (const band of ["Afternoon", "Evening"] as const) {
      const { startHour, endHour } = TIME_BANDS[band];
      const start = localToUtcMs(`${dateStr}T${pad(startHour)}:00`, NYC_TIMEZONE);
      const end = localToUtcMs(`${dateStr}T${pad(endHour)}:00`, NYC_TIMEZONE);
      if (start !== null && end !== null) windows.push({ start, end });
    }
  }

  const manhattan = areaById("manhattan")!;
  const brooklyn = areaById("brooklyn")!;

  return {
    userId: "demo-partner-alex",
    mode,
    windows,
    durationMinutes: 60,
    bufferMinutes: 15,
    activityIds: ["coffee", "food", "walk", "music"],
    area: [manhattan.ring, brooklyn.ring],
    maxBudgetCents: 4000,
    minBudgetCents: 0,
    billPreference: "each_pays_own",
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
