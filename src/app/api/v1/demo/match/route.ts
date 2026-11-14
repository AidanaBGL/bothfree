import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { buildProposals } from "@/lib/matching/proposals";
import type { RequestInput } from "@/lib/matching/types";
import { demoPartner } from "@/lib/demo/partner";
import {
  activityById,
  areaById,
  NYC_TIMEZONE,
  TIME_BANDS,
  type TimeBand,
} from "@/lib/reference/catalog";
import { localToUtcMs } from "@/lib/validation/timezone";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  mode: z.enum(["invite", "friendship", "dating"]),
  days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(7),
  times: z.array(z.enum(["Morning", "Afternoon", "Evening"])).min(1),
  activityIds: z.array(z.string()).min(1).max(3),
  areaId: z.string().min(1),
  budgetCents: z.number().int().min(0).max(1_000_000),
  billPreference: z
    .enum(["each_pays_own", "split_evenly", "i_treat", "needs_discussion"])
    .default("each_pays_own"),
});

/**
 * No-login demo matcher. Validates the wizard input, converts the chosen
 * local day/time bands into real UTC windows, and runs the SAME deterministic
 * engine the product uses against a seeded counterpart. This proves the server
 * genuinely computes the intersection — it is not a canned response.
 */
export async function POST(req: NextRequest) {
  if (process.env.DEMO_ENABLED === "false") {
    return apiError("DISABLED", "Demo mode is disabled.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_INPUT", "Request body must be valid JSON.");
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Some choices were invalid.", parsed.error.flatten());
  }
  const input = parsed.data;

  const area = areaById(input.areaId);
  if (!area) return apiError("INVALID_INPUT", "Unknown area.");
  for (const id of input.activityIds) {
    if (!activityById(id)) return apiError("INVALID_INPUT", `Unknown activity: ${id}`);
  }

  // Expand each selected day × time band into a concrete UTC window.
  const windows: RequestInput["windows"] = [];
  for (const dateStr of input.days) {
    for (const band of input.times as TimeBand[]) {
      const { startHour, endHour } = TIME_BANDS[band];
      const start = localToUtcMs(`${dateStr}T${pad(startHour)}:00`, NYC_TIMEZONE);
      const end = localToUtcMs(`${dateStr}T${pad(endHour)}:00`, NYC_TIMEZONE);
      if (start === null || end === null) {
        return apiError("INVALID_INPUT", `Invalid local time on ${dateStr}.`);
      }
      windows.push({ start, end });
    }
  }

  const viewer: RequestInput = {
    userId: "demo-viewer",
    mode: input.mode,
    windows,
    durationMinutes: 60,
    bufferMinutes: 15,
    activityIds: input.activityIds,
    area: [area.ring],
    maxBudgetCents: input.budgetCents,
    minBudgetCents: 0,
    billPreference: input.billPreference,
  };

  const result = buildProposals(viewer, demoPartner(input.mode));

  return NextResponse.json({
    partner: { displayName: "Alex", areaLabels: ["Manhattan", "Brooklyn"] },
    reason: result.reason ?? null,
    sharedWindowCount: result.sharedWindowCount,
    proposals: result.proposals.map((p) => ({
      startsAt: new Date(p.startsAt).toISOString(),
      endsAt: new Date(p.endsAt).toISOString(),
      activityId: p.activityId,
      activityLabel: activityById(p.activityId)?.label ?? p.activityId,
      budgetCeilingCents: p.budgetCeilingCents,
      billStatus: p.billStatus,
    })),
  });
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
