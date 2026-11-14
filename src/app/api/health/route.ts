import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe (§13.2). Returns no secrets. */
export function GET() {
  return NextResponse.json({ status: "ok", service: "bothfree" });
}
