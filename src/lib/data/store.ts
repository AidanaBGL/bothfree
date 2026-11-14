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
  return (data as Row[]).map((r) => ({ ...(r.payload as DemoTrip), id: r.id, mine: r.owner_id === myUid }));
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
