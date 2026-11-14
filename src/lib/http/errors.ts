import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

/**
 * Standard API error envelope (§13.1). Every error carries a stable code, a
 * user-safe message, and a correlation id. Status codes follow the spec:
 * 400 invalid, 401 no session, 403 forbidden, 404 not found/hidden,
 * 409 stale/conflict, 422 no feasible plan, 429 rate limit.
 */
export type ErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PLAN_STALE"
  | "NO_FEASIBLE_PLAN"
  | "RATE_LIMITED"
  | "DISABLED";

const STATUS: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PLAN_STALE: 409,
  NO_FEASIBLE_PLAN: 422,
  RATE_LIMITED: 429,
  DISABLED: 403,
};

export function apiError(code: ErrorCode, message: string, details?: unknown) {
  const requestId = randomUUID();
  return NextResponse.json(
    { error: { code, message, requestId, ...(details ? { details } : {}) } },
    { status: STATUS[code] },
  );
}
