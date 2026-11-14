import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { buildProposals } from "@/lib/matching/proposals";
import type { RequestInput } from "@/lib/matching/types";
import { DEMO_PROFILES, profileToRequest } from "@/lib/demo/profiles";
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
  days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(60),
  times: z.array(z.enum(["Morning", "Afternoon", "Evening"])).min(1),
  // Preset activity ids plus optional free-text "custom:<label>" entries.
  activityIds: z.array(z.string().min(1)).min(1).max(6),
  areaId: z.string().min(1),
  budgetCents: z.number().int().min(0).max(1_000_000),
});

/**
 * Discovery feed for the demo. Builds the viewer's request from their chosen
 * days × time bands, then runs the SAME deterministic engine against every
 * seeded profile, returning each as a feed card with real shared slots. Cards
 * with a feasible plan are ranked first (soonest slot wins).
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

  // Only preset activities participate in matching; custom free-text entries are
  // kept for display but can only match if a profile also has that exact id.
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
    billPreference: "each_pays_own",
  };

  const cards = DEMO_PROFILES.map((p) => {
    const result = buildProposals(viewer, profileToRequest(p, input.mode));
    const sharedActivityIds = input.activityIds.filter((id) => p.activityIds.includes(id));
    const sharedActivities = sharedActivityIds.map((id) => activityById(id)?.label ?? id);
    return {
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      age: p.age,
      bio: p.bio,
      availabilityLabel: p.availabilityLabel,
      areaLabels: p.areaIds.map((id) => areaById(id)?.label ?? id),
      likesYouBack: p.likesYouBack,
      hasMatch: result.proposals.length > 0,
      reason: result.reason ?? null,
      sharedActivities,
      sharedActivityIds,
      slots: result.proposals.slice(0, 2).map((pr) => ({
        startsAt: new Date(pr.startsAt).toISOString(),
        endsAt: new Date(pr.endsAt).toISOString(),
        activityLabel: activityById(pr.activityId)?.label ?? pr.activityId,
        budgetCeilingCents: pr.budgetCeilingCents,
        billStatus: pr.billStatus,
      })),
    };
  });

  // Feasible plans first, soonest slot wins; others keep a stable order.
  cards.sort((a, b) => {
    if (a.hasMatch !== b.hasMatch) return a.hasMatch ? -1 : 1;
    const sa = a.slots[0]?.startsAt ?? "";
    const sb = b.slots[0]?.startsAt ?? "";
    return sa < sb ? -1 : sa > sb ? 1 : a.id < b.id ? -1 : 1;
  });

  return NextResponse.json({ count: cards.length, cards });
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
