import { z } from "zod";

/**
 * Zod schema for the meeting-request DTO (§13.3). Mirrors the public API
 * contract. `activityIds` and `cityId` are validated against the reference
 * catalog server-side after this shape check; `area` coordinates must be a real
 * GeoJSON ring array, never a string.
 */

export const MODES = ["invite", "friendship", "dating"] as const;
export const BILL_PREFERENCES = [
  "each_pays_own",
  "split_evenly",
  "i_treat",
  "needs_discussion",
] as const;

/** Allowed meeting durations, in minutes (§9.3 duration allowlist). */
export const DURATION_ALLOWLIST = [30, 45, 60, 90, 120, 180] as const;

const lngLat = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

const ring = z.array(lngLat).min(4); // closed ring: first == last, >= 3 distinct points

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "expected local ISO datetime without offset");

export const requestDtoSchema = z
  .object({
    mode: z.enum(MODES),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string().min(1), // IANA name; existence checked via Intl at the boundary
    durationMinutes: z.number().int().refine((d) => DURATION_ALLOWLIST.includes(d as never), {
      message: "duration not in allowlist",
    }),
    bufferMinutes: z.number().int().min(0).max(120),
    availability: z
      .array(z.object({ startLocal: localDateTime, endLocal: localDateTime }))
      .min(1),
    activityIds: z.array(z.string().min(1)).min(1).max(3),
    cityId: z.string().min(1),
    area: z.object({
      type: z.enum(["Polygon", "MultiPolygon"]),
      coordinates: z.union([z.array(ring), z.array(z.array(ring))]),
    }),
    budget: z.object({
      minCents: z.number().int().min(0),
      maxCents: z.number().int().min(0),
      currency: z.literal("USD"),
    }),
    billPreference: z.enum(BILL_PREFERENCES),
    expectedVersion: z.number().int().min(0),
  })
  .refine((v) => v.budget.maxCents >= v.budget.minCents, {
    message: "maxCents must be >= minCents",
    path: ["budget", "maxCents"],
  })
  .refine((v) => v.dateTo >= v.dateFrom, {
    message: "dateTo must be on or after dateFrom",
    path: ["dateTo"],
  })
  .refine(
    (v) => {
      const from = Date.parse(`${v.dateFrom}T00:00:00Z`);
      const to = Date.parse(`${v.dateTo}T00:00:00Z`);
      return (to - from) / 86_400_000 <= 14; // window must not exceed 14 days
    },
    { message: "date range must not exceed 14 days", path: ["dateTo"] },
  );

export type RequestDto = z.infer<typeof requestDtoSchema>;
