import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Readiness probe (§13.2). Reports whether critical configuration is present
 * without leaking values. Only booleans are exposed.
 */
export function GET() {
  const checks = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  };
  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json({ ready, checks }, { status: ready ? 200 : 503 });
}
