import { createClient } from "@/lib/supabase/browser";
import type { DemoPlan } from "@/lib/demo/plans";
import type { DemoTrip } from "@/lib/demo/trips";

/**
 * Supabase read/write for registered accounts. Plans and trips are stored as a
 * JSONB `payload` keyed by the row id (so the matching logic stays the same),
 * with `owner_id` for RLS and "is this mine?" checks. Reads are intentionally
 * forgiving — on any error they return empty so the UI degrades gracefully.
 */

interface Row {
  id: string;
  owner_id: string;
  payload: unknown;
}

export async function getUserId(): Promise<string | null> {
  const { data } = await createClient().auth.getUser();
  return data.user?.id ?? null;
}

// ---- Plans ----------------------------------------------------------
export async function fetchPlans(): Promise<DemoPlan[]> {
  const { data, error } = await createClient()
    .from("plans")
    .select("id, owner_id, payload")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({ ...(r.payload as DemoPlan), id: r.id, ownerId: r.owner_id }));
}

export async function insertPlan(plan: DemoPlan): Promise<DemoPlan | null> {
  const supabase = createClient();
  const owner = (await supabase.auth.getUser()).data.user?.id;
  if (!owner) return null;
  const { data, error } = await supabase
    .from("plans")
    .insert({ owner_id: owner, payload: plan })
    .select("id, owner_id, payload")
    .single();
  if (error || !data) return null;
  const r = data as Row;
  return { ...(r.payload as DemoPlan), id: r.id, ownerId: r.owner_id };
}

// ---- Trips ----------------------------------------------------------
export async function fetchTrips(myUid: string | null): Promise<DemoTrip[]> {
  const { data, error } = await createClient()
    .from("trips")
    .select("id, owner_id, payload")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({ ...(r.payload as DemoTrip), id: r.id, ownerId: r.owner_id, mine: r.owner_id === myUid }));
}

export async function insertTrip(trip: DemoTrip): Promise<DemoTrip | null> {
  const supabase = createClient();
  const owner = (await supabase.auth.getUser()).data.user?.id;
  if (!owner) return null;
  const { data, error } = await supabase
    .from("trips")
    .insert({ owner_id: owner, payload: trip })
    .select("id, owner_id, payload")
    .single();
  if (error || !data) return null;
  const r = data as Row;
  return { ...(r.payload as DemoTrip), id: r.id, mine: true };
}

// ---- Trip join requests ---------------------------------------------
export interface TripRequest {
  id: string;
  tripId: string;
  fromUser: string;
  toUser: string;
  status: "pending" | "accepted" | "declined";
}

export async function requestTripJoin(tripId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const from = (await supabase.auth.getUser()).data.user?.id;
  if (!from) return { error: "Not signed in" };
  const { error } = await supabase.from("trip_requests").insert({ trip_id: tripId, from_user: from });
  if (error && !/duplicate|unique/i.test(error.message)) return { error: error.message };
  return {};
}

export async function fetchTripRequests(uid: string): Promise<TripRequest[]> {
  const { data } = await createClient()
    .from("trip_requests")
    .select("id, trip_id, from_user, to_user, status")
    .or(`from_user.eq.${uid},to_user.eq.${uid}`);
  return ((data as Record<string, string>[] | null) ?? []).map((r) => ({
    id: r.id,
    tripId: r.trip_id,
    fromUser: r.from_user,
    toUser: r.to_user,
    status: r.status as TripRequest["status"],
  }));
}

export async function respondTripRequest(id: string, accept: boolean): Promise<{ error?: string }> {
  const { error } = await createClient()
    .from("trip_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  return error ? { error: error.message } : {};
}

// ---- Plan join requests ---------------------------------------------
export interface PlanRequest {
  id: string;
  planId: string;
  fromUser: string;
  toUser: string;
  status: "pending" | "accepted" | "declined";
}

export async function requestPlanJoin(planId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const from = (await supabase.auth.getUser()).data.user?.id;
  if (!from) return { error: "Not signed in" };
  const { error } = await supabase.from("plan_requests").insert({ plan_id: planId, from_user: from });
  if (error && !/duplicate|unique/i.test(error.message)) return { error: error.message };
  return {};
}

export async function fetchPlanRequests(uid: string): Promise<PlanRequest[]> {
  const { data } = await createClient()
    .from("plan_requests")
    .select("id, plan_id, from_user, to_user, status")
    .or(`from_user.eq.${uid},to_user.eq.${uid}`);
  return ((data as Record<string, string>[] | null) ?? []).map((r) => ({
    id: r.id,
    planId: r.plan_id,
    fromUser: r.from_user,
    toUser: r.to_user,
    status: r.status as PlanRequest["status"],
  }));
}

export async function respondPlanRequest(id: string, accept: boolean): Promise<{ error?: string }> {
  const { error } = await createClient()
    .from("plan_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  return error ? { error: error.message } : {};
}

// ---- Profile --------------------------------------------------------
export interface DbProfile {
  name: string;
  bio: string;
  interests: string[];
  city: string;
  areaId: string | null;
  lgbtqFriendly: boolean;
}

interface ProfileRow {
  name: string | null;
  bio: string | null;
  interests: string[] | null;
  city: string | null;
  area_id: string | null;
  lgbtq_friendly: boolean | null;
}

export interface PublicProfile extends DbProfile {
  id: string;
}

/** Any user's public-safe profile (name, bio, interests, city). Never exposes
 *  email, DOB, phone, or their friends list. */
export async function fetchProfileById(userId: string): Promise<PublicProfile | null> {
  const { data } = await createClient()
    .from("profiles")
    .select("id, name, bio, interests, city, area_id, lgbtq_friendly")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const r = data as ProfileRow & { id: string };
  return {
    id: r.id,
    name: r.name ?? "BothFree member",
    bio: r.bio ?? "",
    interests: r.interests ?? [],
    city: r.city ?? "New York",
    areaId: r.area_id ?? null,
    lgbtqFriendly: Boolean(r.lgbtq_friendly),
  };
}

// ---- Friends --------------------------------------------------------
export type FriendStatus = "none" | "pending_out" | "pending_in" | "friends";

export interface FriendRequestRow {
  id: string;
  from_user: string;
  to_user: string;
  status: "pending" | "accepted" | "declined";
}

/** All friend rows touching the current user (both directions). */
export async function fetchFriendRows(uid: string): Promise<FriendRequestRow[]> {
  const { data } = await createClient()
    .from("friend_requests")
    .select("id, from_user, to_user, status")
    .or(`from_user.eq.${uid},to_user.eq.${uid}`);
  return (data as FriendRequestRow[] | null) ?? [];
}

export async function sendFriendRequest(toUser: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const from = (await supabase.auth.getUser()).data.user?.id;
  if (!from) return { error: "Not signed in" };
  if (from === toUser) return { error: "That's you" };
  const { error } = await supabase.from("friend_requests").insert({ from_user: from, to_user: toUser, status: "pending" });
  return error ? { error: error.message } : {};
}

export async function respondFriendRequest(id: string, accept: boolean): Promise<{ error?: string }> {
  const { error } = await createClient()
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  return error ? { error: error.message } : {};
}

/** Derive this user's relationship to another user from the friend rows. */
export function statusFor(rows: FriendRequestRow[], uid: string, otherId: string): { status: FriendStatus; requestId?: string } {
  const row = rows.find(
    (r) => (r.from_user === uid && r.to_user === otherId) || (r.from_user === otherId && r.to_user === uid),
  );
  if (!row) return { status: "none" };
  if (row.status === "accepted") return { status: "friends", requestId: row.id };
  if (row.status === "declined") return { status: "none", requestId: row.id };
  return { status: row.from_user === uid ? "pending_out" : "pending_in", requestId: row.id };
}

// ---- Conversations + messages --------------------------------------
export interface DbConversation {
  id: string;
  otherId: string;
}
export interface DbMessage {
  id: string;
  conversationId: string;
  sender: string;
  body: string;
}

function convPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Find the conversation with another user, creating it if needed. */
export async function ensureConversation(otherId: string): Promise<string | null> {
  const supabase = createClient();
  const me = (await supabase.auth.getUser()).data.user?.id;
  if (!me || me === otherId) return null;
  const [user_a, user_b] = convPair(me, otherId);
  const existing = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (existing.data) return (existing.data as { id: string }).id;
  const { data } = await supabase.from("conversations").insert({ user_a, user_b }).select("id").single();
  return (data as { id: string } | null)?.id ?? null;
}

export async function fetchConversations(uid: string): Promise<DbConversation[]> {
  const { data } = await createClient()
    .from("conversations")
    .select("id, user_a, user_b")
    .or(`user_a.eq.${uid},user_b.eq.${uid}`);
  const rows = (data as { id: string; user_a: string; user_b: string }[] | null) ?? [];
  return rows.map((r) => ({ id: r.id, otherId: r.user_a === uid ? r.user_b : r.user_a }));
}

export async function fetchMessages(conversationId: string): Promise<DbMessage[]> {
  const { data } = await createClient()
    .from("messages")
    .select("id, conversation_id, sender, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return ((data as { id: string; conversation_id: string; sender: string; body: string }[] | null) ?? []).map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    sender: r.sender,
    body: r.body,
  }));
}

export async function sendDbMessage(conversationId: string, body: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const sender = (await supabase.auth.getUser()).data.user?.id;
  if (!sender) return { error: "Not signed in" };
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender, body });
  return error ? { error: error.message } : {};
}

/**
 * Subscribe to any insert/update on a table and call `cb`. Returns an unsubscribe
 * function. Used so one account's actions appear live in another's session.
 */
export function subscribeTable(table: string, cb: () => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, () => cb())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

// ---- Availability calendar ------------------------------------------
export interface AvailabilitySlot {
  id: string;
  startsAt: string; // ISO UTC
  endsAt: string;
}

export async function fetchMyAvailability(): Promise<AvailabilitySlot[]> {
  const supabase = createClient();
  const me = (await supabase.auth.getUser()).data.user?.id;
  if (!me) return [];
  const { data } = await supabase
    .from("availability_slots")
    .select("id, starts_at, ends_at")
    .eq("user_id", me)
    .order("starts_at", { ascending: true });
  return ((data as { id: string; starts_at: string; ends_at: string }[] | null) ?? []).map((r) => ({
    id: r.id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
  }));
}

export async function addAvailability(startsAt: string, endsAt: string): Promise<{ error?: string; slot?: AvailabilitySlot }> {
  const supabase = createClient();
  const me = (await supabase.auth.getUser()).data.user?.id;
  if (!me) return { error: "Not signed in" };
  const { data, error } = await supabase
    .from("availability_slots")
    .insert({ user_id: me, starts_at: startsAt, ends_at: endsAt })
    .select("id, starts_at, ends_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save" };
  const r = data as { id: string; starts_at: string; ends_at: string };
  return { slot: { id: r.id, startsAt: r.starts_at, endsAt: r.ends_at } };
}

export async function deleteAvailability(id: string): Promise<{ error?: string }> {
  const { error } = await createClient().from("availability_slots").delete().eq("id", id);
  return error ? { error: error.message } : {};
}

export interface MutualSlot {
  startsAt: string;
  endsAt: string;
  minutes: number;
}

/** Secure RPC: returns only the overlapping intervals, never the full schedule. */
export async function getMutualAvailability(otherUserId: string): Promise<MutualSlot[]> {
  const { data, error } = await createClient().rpc("get_mutual_availability", { other_user_id: otherUserId });
  if (error || !data) return [];
  return (data as { starts_at: string; ends_at: string; minutes: number }[]).map((r) => ({
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    minutes: r.minutes,
  }));
}

// ---- Meeting proposals ----------------------------------------------
export interface MeetingProposal {
  id: string;
  fromUser: string;
  toUser: string;
  startsAt: string;
  endsAt: string;
  activity: string | null;
  place: string | null;
  details: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
}

export async function proposeMeeting(p: {
  toUser: string;
  startsAt: string;
  endsAt: string;
  activity?: string;
  place?: string;
  details?: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  const from = (await supabase.auth.getUser()).data.user?.id;
  if (!from) return { error: "Not signed in" };
  const { error } = await supabase.from("meeting_proposals").insert({
    from_user: from,
    to_user: p.toUser,
    starts_at: p.startsAt,
    ends_at: p.endsAt,
    activity: p.activity ?? null,
    place: p.place ?? null,
    details: p.details ?? null,
  });
  // Unique index violation (duplicate) is fine — treat as already sent.
  if (error && !/duplicate|unique/i.test(error.message)) return { error: error.message };
  return {};
}

export async function fetchMeetingProposals(uid: string): Promise<MeetingProposal[]> {
  const { data } = await createClient()
    .from("meeting_proposals")
    .select("id, from_user, to_user, starts_at, ends_at, activity, place, details, status")
    .or(`from_user.eq.${uid},to_user.eq.${uid}`)
    .order("starts_at", { ascending: true });
  return ((data as Record<string, string>[] | null) ?? []).map((r) => ({
    id: r.id,
    fromUser: r.from_user,
    toUser: r.to_user,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    activity: r.activity ?? null,
    place: r.place ?? null,
    details: r.details ?? null,
    status: r.status as MeetingProposal["status"],
  }));
}

export async function respondMeetingProposal(id: string, accept: boolean): Promise<{ error?: string }> {
  const { error } = await createClient()
    .from("meeting_proposals")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  return error ? { error: error.message } : {};
}

// ---- Invite links ---------------------------------------------------
function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key && !url.includes("YOUR_") && !key.includes("YOUR_"));
}

/** Resolve a private invite plan by its secret token (keyless via RPC). */
export async function getInvitePlan(token: string): Promise<DemoPlan | null> {
  if (!configured()) return null;
  try {
    const { data, error } = await createClient().rpc("get_invite_plan", { token });
    if (error || !data) return null;
    return data as DemoPlan;
  } catch {
    return null;
  }
}

// ---- Notifications --------------------------------------------------
export interface DbNotification {
  id: string;
  kind: string;
  title: string;
  objectType: string | null;
  objectId: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function fetchNotifications(uid: string): Promise<DbNotification[]> {
  const { data } = await createClient()
    .from("notifications")
    .select("id, kind, title, object_type, object_id, read_at, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data as Record<string, string | null>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    title: r.title as string,
    objectType: r.object_type,
    objectId: r.object_id,
    readAt: r.read_at,
    createdAt: r.created_at as string,
  }));
}

export async function markNotificationsRead(uid: string): Promise<void> {
  await createClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", uid)
    .is("read_at", null);
}

export async function fetchMyProfile(): Promise<DbProfile | null> {
  const supabase = createClient();
  const u = (await supabase.auth.getUser()).data.user;
  if (!u) return null;
  const { data } = await supabase
    .from("profiles")
    .select("name, bio, interests, city, area_id, lgbtq_friendly")
    .eq("id", u.id)
    .maybeSingle();
  const row = data as ProfileRow | null;
  return {
    name: row?.name ?? (u.user_metadata?.name as string | undefined) ?? "",
    bio: row?.bio ?? "",
    interests: row?.interests ?? [],
    city: row?.city ?? "New York",
    areaId: row?.area_id ?? null,
    lgbtqFriendly: Boolean(row?.lgbtq_friendly),
  };
}
