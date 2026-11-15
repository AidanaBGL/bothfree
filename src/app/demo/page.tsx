"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MonthCalendar } from "@/components/MonthCalendar";
import { TimeSlotTable } from "@/components/TimeSlotTable";
import { AddressInput } from "@/components/AddressInput";
import { ACTIVITIES, AREAS, activityById, areaById } from "@/lib/reference/catalog";
import { buildDateHelper } from "@/lib/dateideas/conversation";
import { DEMO_PLANS, TEST_PROFILE, BILL_OPTIONS, type DemoPlan, type DateTag } from "@/lib/demo/plans";
import { TEST_PROFILES } from "@/lib/demo/testProfiles";
import {
  COMFORTS,
  WITH_WHOM,
  INCLUDES,
  SPLIT_OPTIONS,
  DESTINATION_SUGGESTIONS,
  DEMO_TRIPS,
  budgetLabel as tripBudgetLabel,
  tripDatesLabel,
  type DemoTrip,
  type DateMode,
  type Comfort,
  type WithWhom,
} from "@/lib/demo/trips";
import { dateOverlap, budgetOverlap, formatOverlap } from "@/lib/travel/overlap";
import { INCOMING_REQUESTS, FRIEND_SUGGESTIONS, type Person } from "@/lib/demo/friends";
import { SEED_CONVERSATIONS, CANNED_REPLIES, type Conversation } from "@/lib/demo/messages";
import { supabaseConfigured, authSignUp, authVerify, authSignIn, authSignOut, authCurrentUser } from "@/lib/auth/actions";
import {
  getUserId,
  fetchPlans,
  insertPlan,
  fetchTrips,
  insertTrip,
  fetchMyProfile,
  fetchProfileById,
  fetchFriendRows,
  sendFriendRequest,
  respondFriendRequest,
  statusFor,
  ensureConversation,
  fetchConversations,
  fetchMessages,
  sendDbMessage,
  subscribeTable,
  type DbProfile,
  type PublicProfile,
  type FriendRequestRow,
} from "@/lib/data/store";
import { readBus, pushBus, PERSONAS, BUS_KEY, type BusPost, type Persona } from "@/lib/demo/matchbus";
import { SPARK_QUESTIONS } from "@/lib/demo/sparkQuestions";
import { seedMeetings, slotLabel, dateLabel, hourLabel, daysUntil, type Meeting } from "@/lib/demo/meetings";
import { buildIcs } from "@/lib/calendar/ics";

const SESSION_KEY = "bf-demo-session";
type AccountKind = "jury" | "demo" | "registered";
interface Session {
  name: string;
  email: string;
  kind: AccountKind;
}
const TEST_IDENTITY: Session = { name: TEST_PROFILE.name, email: "demo@bothfree.app", kind: "demo" };

type View = "feed" | "travel" | "friends" | "messages" | "spark" | "meetings" | "plans" | "profile";
type Mode = "invite" | "friendship" | "dating";

interface Notif {
  id: number;
  emoji: string;
  text: string;
  tone: "match" | "pending";
}

export default function DemoPage() {
  const [session, setSession] = useState<typeof TEST_IDENTITY | null>(null);
  const [ready, setReady] = useState(false);

  // Entry: which screen the logged-out visitor sees.
  const [entryScreen, setEntryScreen] = useState<"home" | "auth">("home");
  // Auth: sign-in fields pre-filled with demo credentials.
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(TEST_IDENTITY.email);
  const [password, setPassword] = useState("bothfree-demo");
  // Sign-up fields.
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suDob, setSuDob] = useState("");
  const [suGender, setSuGender] = useState("");
  const [suFriendly, setSuFriendly] = useState(false);
  const [suTerms, setSuTerms] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  // Email awaiting a verification code, and the code input.
  const [pendingVerify, setPendingVerify] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  // App state
  const [view, setView] = useState<View>("feed");
  const [premium, setPremium] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);

  // Feed interactions
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [helperFor, setHelperFor] = useState<string | null>(null);

  // Filters
  const [fDate, setFDate] = useState<"any" | DateTag>("any");
  const [fArea, setFArea] = useState("any");
  const [fEvent, setFEvent] = useState("any");

  // Plans the user posts, newest first
  const [myPlans, setMyPlans] = useState<DemoPlan[]>([]);

  // Travel trips the user posts, newest first
  const [myTrips, setMyTrips] = useState<DemoTrip[]>([]);

  // Travel filters
  const [tDest, setTDest] = useState("any");
  const [tStyle, setTStyle] = useState("any");
  const [tWith, setTWith] = useState("any");

  // Friends
  const [friends, setFriends] = useState<Person[]>([]);
  const [incoming, setIncoming] = useState<Person[]>(INCOMING_REQUESTS);
  const [sentFriends, setSentFriends] = useState<Set<string>>(new Set());

  // Messages (demo)
  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVERSATIONS);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Messages (Supabase)
  const [dbConvos, setDbConvos] = useState<{ id: string; otherId: string; name: string }[]>([]);
  const [dbOpenConvo, setDbOpenConvo] = useState<string | null>(null);
  const [dbMsgs, setDbMsgs] = useState<{ id: string; sender: string; body: string }[]>([]);
  const [dbDraft, setDbDraft] = useState("");

  // Supabase-backed data (registered accounts)
  const [uid, setUid] = useState<string | null>(null);
  const [dbPlans, setDbPlans] = useState<DemoPlan[]>([]);
  const [dbTrips, setDbTrips] = useState<DemoTrip[]>([]);
  const [dbProfile, setDbProfile] = useState<DbProfile | null>(null);
  const [friendRows, setFriendRows] = useState<FriendRequestRow[]>([]);
  const [peopleMap, setPeopleMap] = useState<Record<string, string>>({});
  const [openProfile, setOpenProfile] = useState<{ id?: string; plan?: DemoPlan } | null>(null);

  // Cross-account match bus (jury ↔ demo persona)
  const [bus, setBus] = useState<BusPost[]>([]);
  const [dismissedReq, setDismissedReq] = useState<Set<number>>(new Set());

  // Meetings (agreement flow)
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [rescheduleFor, setRescheduleFor] = useState<Meeting | null>(null);

  // Create modals
  const [createOpen, setCreateOpen] = useState(false);
  const [createTripOpen, setCreateTripOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (active) setSession({ name: s.name, email: s.email, kind: (s.kind as AccountKind) ?? "demo" });
        } else if (supabaseConfigured()) {
          // Restore a real signed-in Supabase user if there's no local session.
          const u = await authCurrentUser();
          if (active && u) setSession({ name: u.name, email: u.email, kind: "registered" });
        }
      } catch {
        /* ignore */
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Real (registered) accounts don't get the seeded demo chats/requests.
  useEffect(() => {
    if (session?.kind === "registered") {
      setConversations([]);
      setIncoming([]);
      setMeetings([]);
    } else if (session?.kind === "jury" || session?.kind === "demo") {
      setConversations(SEED_CONVERSATIONS);
      setIncoming(INCOMING_REQUESTS);
      setMeetings(seedMeetings());
    }
  }, [session?.kind]);

  // Load this user's plans/trips/profile from Supabase on real sign-in.
  useEffect(() => {
    if (!(supabaseConfigured() && session?.kind === "registered")) {
      setDbPlans([]);
      setDbTrips([]);
      setDbProfile(null);
      setUid(null);
      return;
    }
    let active = true;
    (async () => {
      const id = await getUserId();
      if (!active) return;
      setUid(id);
      const [pl, tr, prof, fr] = await Promise.all([
        fetchPlans(),
        fetchTrips(id),
        fetchMyProfile(),
        id ? fetchFriendRows(id) : Promise.resolve([]),
      ]);
      if (!active) return;
      setDbPlans(pl);
      setDbTrips(tr);
      setDbProfile(prof);
      setFriendRows(fr);
      // Resolve names of everyone in the friend graph.
      const otherIds = Array.from(new Set(fr.flatMap((r) => [r.from_user, r.to_user]).filter((x) => x !== id)));
      const map: Record<string, string> = {};
      await Promise.all(
        otherIds.map(async (oid) => {
          const p = await fetchProfileById(oid);
          if (p) map[oid] = p.name;
        }),
      );
      if (active) setPeopleMap(map);
    })();
    return () => {
      active = false;
    };
  }, [session?.kind]);

  // Realtime: when another account changes shared tables, refresh live.
  useEffect(() => {
    if (!(supabaseConfigured() && session?.kind === "registered" && uid)) return;
    const unsubs = [
      subscribeTable("plans", () => {
        fetchPlans().then(setDbPlans);
      }),
      subscribeTable("trips", () => {
        fetchTrips(uid).then(setDbTrips);
      }),
      subscribeTable("friend_requests", () => {
        void refreshFriends();
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [session?.kind, uid]);

  // Load DB conversations when opening Messages, and live-refresh on new messages.
  useEffect(() => {
    if (!(supabaseConfigured() && session?.kind === "registered" && uid && view === "messages")) return;
    void loadDbConvos();
    const unsub = subscribeTable("messages", () => {
      void loadDbConvos();
      if (dbOpenConvo) fetchMessages(dbOpenConvo).then(setDbMsgs);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, session?.kind, uid, dbOpenConvo]);

  // Keep the cross-account match bus in sync (live across tabs via `storage`).
  useEffect(() => {
    setBus(readBus());
    const onStorage = (e: StorageEvent) => {
      if (e.key === BUS_KEY) setBus(readBus());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function postToBus(plan: DemoPlan) {
    if (isDemo === false) return; // only jury/demo personas use the bus
    const me: Persona = session?.kind === "jury" ? "jury" : "demo";
    const info = PERSONAS[me];
    pushBus({ ts: Date.now(), persona: me, name: info.name, emoji: info.emoji, activityId: plan.activityId, areaId: plan.areaId, whenLabel: plan.whenLabel });
    const updated = readBus();
    setBus(updated);
    const theirs = updated.find((p) => p.persona !== me && p.activityId === plan.activityId && p.areaId === plan.areaId);
    if (theirs) {
      addNotif({ emoji: theirs.emoji, text: `It’s a match! ${theirs.name} entered the same plan — ${activityById(plan.activityId)?.label ?? "it"} nearby ✨`, tone: "match" });
    }
  }

  function startSession(identity: typeof TEST_IDENTITY) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(identity));
    setSession(identity);
  }
  async function signIn() {
    setAuthError(null);
    if (supabaseConfigured()) {
      setAuthBusy(true);
      const res = await authSignIn(email.trim(), password);
      setAuthBusy(false);
      if (res.error) return setAuthError(res.error);
      return startSession({ name: res.name ?? email.split("@")[0], email: email.trim(), kind: "registered" });
    }
    startSession({ name: TEST_IDENTITY.name, email: email.trim() || TEST_IDENTITY.email, kind: "registered" });
  }
  function enterJury() {
    startSession({ name: "Jury", email: "jury@bothfree.app", kind: "jury" });
  }
  function enterDemoUser() {
    startSession({ name: TEST_PROFILE.name, email: "demo@bothfree.app", kind: "demo" });
  }
  async function signUp() {
    setAuthError(null);
    const name = suName.trim();
    if (name.length < 2) return setAuthError("Please enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(suEmail.trim())) return setAuthError("Please enter a valid email.");
    if (suPassword.length < 6) return setAuthError("Password must be at least 6 characters.");
    if (!suDob) return setAuthError("Please enter your date of birth.");
    if (ageFromDob(suDob) < 18) return setAuthError("You must be 18 or older to join.");
    if (!suGender) return setAuthError("Please choose how you describe your gender.");
    if (!suTerms) return setAuthError("Please accept the terms to continue.");

    if (supabaseConfigured()) {
      setAuthBusy(true);
      const res = await authSignUp({
        email: suEmail.trim(),
        password: suPassword,
        name,
        dob: suDob,
        gender: suGender,
        lgbtqFriendly: suFriendly,
      });
      setAuthBusy(false);
      if (res.error) return setAuthError(res.error);
      if (res.needsVerify) return setPendingVerify(suEmail.trim()); // show the code screen
      return startSession({ name, email: suEmail.trim(), kind: "registered" });
    }
    startSession({ name, email: suEmail.trim(), kind: "registered" });
  }

  async function submitVerify() {
    if (!pendingVerify) return;
    setAuthError(null);
    setAuthBusy(true);
    const res = await authVerify(pendingVerify, verifyCode.trim());
    setAuthBusy(false);
    if (res.error) return setAuthError(res.error);
    startSession({ name: suName.trim() || pendingVerify.split("@")[0], email: pendingVerify, kind: "registered" });
  }
  function signOut() {
    void authSignOut();
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setView("feed");
    setEntryScreen("home");
    setPendingVerify(null);
  }

  function addNotif(n: Omit<Notif, "id">) {
    setNotifs((prev) => [{ ...n, id: Date.now() + Math.random() }, ...prev]);
    setUnread((u) => u + 1);
  }
  function openBell() {
    setBellOpen((o) => !o);
    if (!bellOpen) setUnread(0);
  }

  function like(id: string) {
    setLiked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function copyInvite(plan: DemoPlan) {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${plan.inviteToken}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    addNotif({ emoji: "🔗", text: `Invite link copied: ${url}`, tone: "match" });
  }
  function joinPlan(plan: DemoPlan) {
    setRequested((prev) => new Set(prev).add(plan.id));
    // Turn the "I'm in" into a concrete meeting proposal that must be confirmed.
    const parsed = parsePlanSlot(plan);
    const meeting: Meeting = {
      id: `mtg-${Date.now()}`,
      withName: plan.name,
      emoji: plan.emoji,
      activityLabel: activityById(plan.activityId)?.label ?? "Meet up",
      date: parsed.date,
      hour: parsed.hour,
      place: plan.areaLabel ?? areaById(plan.areaId)?.label ?? "TBD",
      status: "awaiting_them",
      proposedBy: "you",
    };
    setMeetings((prev) => [meeting, ...prev]);
    if (plan.likesYouBack) {
      // Seeded counterpart confirms shortly after — demonstrates both-sides agreement.
      setTimeout(() => {
        setMeetings((prev) => prev.map((m) => (m.id === meeting.id ? { ...m, status: "confirmed" } : m)));
        addNotif({ emoji: plan.emoji, text: `${plan.name} confirmed! You're set for ${meeting.activityLabel} — see Meetings.`, tone: "match" });
      }, 1200);
      addNotif({ emoji: plan.emoji, text: `It’s a match with ${plan.name}! Proposed a time — awaiting their confirmation.`, tone: "pending" });
    } else {
      addNotif({ emoji: "📨", text: `Proposed a meeting to ${plan.name}. We’ll notify you when they respond.`, tone: "pending" });
    }
    setView("meetings");
  }

  // ---- Meeting agreement actions ----
  function confirmMeeting(m: Meeting) {
    setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "confirmed" } : x)));
    addNotif({ emoji: "✅", text: `Confirmed with ${m.withName}: ${slotLabel(m)}. A reminder is set.`, tone: "match" });
  }
  function cancelMeeting(m: Meeting) {
    setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "cancelled" } : x)));
    addNotif({ emoji: "🚫", text: `Meeting with ${m.withName} cancelled. They’ve been notified.`, tone: "pending" });
  }
  function applyReschedule(m: Meeting, date: string, hour: number, place: string) {
    setMeetings((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, date, hour, place, status: "awaiting_them", proposedBy: "you" } : x)),
    );
    setRescheduleFor(null);
    addNotif({ emoji: "🔁", text: `New time proposed to ${m.withName} — awaiting their confirmation.`, tone: "pending" });
  }
  function downloadIcs(m: Meeting) {
    const start = new Date(`${m.date}T00:00:00`);
    start.setHours(m.hour, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const ics = buildIcs({
      uid: `${m.id}@bothfree`,
      sequence: 1,
      startUtc: start,
      endUtc: end,
      summary: `BothFree: ${m.activityLabel} with ${m.withName}`,
      location: m.place,
    });
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bothfree-${m.id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function joinTrip(trip: DemoTrip) {
    setRequested((prev) => new Set(prev).add(trip.id));
    if (trip.likesYouBack) {
      addNotif({ emoji: trip.emoji, text: `It’s a match! ${trip.name} wants to travel to ${trip.destination.split(",")[0]} too ✈️`, tone: "match" });
    } else {
      addNotif({ emoji: "📨", text: `Travel request sent to ${trip.name}. We’ll let you know if they’re in.`, tone: "pending" });
    }
  }

  function addFriend(p: Person) {
    if (friends.some((f) => f.id === p.id) || sentFriends.has(p.id)) return;
    if (p.likesYouBack) {
      // They accept your request (seeded) — straight to friends.
      setFriends((prev) => [p, ...prev]);
      addNotif({ emoji: p.emoji, text: `${p.name} accepted your friend request 🤝`, tone: "match" });
    } else {
      setSentFriends((prev) => new Set(prev).add(p.id));
      addNotif({ emoji: "📨", text: `Friend request sent to ${p.name}.`, tone: "pending" });
    }
  }
  function acceptFriend(p: Person) {
    setIncoming((prev) => prev.filter((x) => x.id !== p.id));
    setFriends((prev) => (prev.some((f) => f.id === p.id) ? prev : [p, ...prev]));
    addNotif({ emoji: p.emoji, text: `You and ${p.name} are now friends 🤝`, tone: "match" });
  }
  function declineFriend(p: Person) {
    setIncoming((prev) => prev.filter((x) => x.id !== p.id));
  }

  // ---- Real (Supabase) friend operations ----
  async function refreshFriends() {
    if (!uid) return;
    const rows = await fetchFriendRows(uid);
    setFriendRows(rows);
    const otherIds = Array.from(new Set(rows.flatMap((r) => [r.from_user, r.to_user]).filter((id) => id !== uid)));
    const map: Record<string, string> = {};
    await Promise.all(
      otherIds.map(async (id) => {
        const p = await fetchProfileById(id);
        if (p) map[id] = p.name;
      }),
    );
    setPeopleMap(map);
  }
  async function dbSendFriend(toUser: string, name: string) {
    const res = await sendFriendRequest(toUser);
    if (res.error) return addNotif({ emoji: "⚠️", text: res.error, tone: "pending" });
    await refreshFriends();
    addNotif({ emoji: "📨", text: `Friend request sent to ${name}.`, tone: "pending" });
  }
  async function dbRespondFriend(requestId: string, accept: boolean, name: string) {
    await respondFriendRequest(requestId, accept);
    await refreshFriends();
    if (accept) addNotif({ emoji: "🤝", text: `You and ${name} are now friends.`, tone: "match" });
  }

  // ---- Real (Supabase) messaging ----
  async function loadDbConvos() {
    if (!uid) return;
    const convos = await fetchConversations(uid);
    const withNames = await Promise.all(
      convos.map(async (c) => ({ ...c, name: peopleMap[c.otherId] ?? (await fetchProfileById(c.otherId))?.name ?? "Member" })),
    );
    setDbConvos(withNames);
  }
  async function openDbConvo(id: string) {
    setDbOpenConvo(id);
    setDbMsgs(await fetchMessages(id));
  }
  async function startChatWith(otherId: string) {
    const id = await ensureConversation(otherId);
    if (!id) return;
    setView("messages");
    await loadDbConvos();
    await openDbConvo(id);
  }
  async function sendDbChat() {
    const body = dbDraft.trim();
    if (!body || !dbOpenConvo) return;
    setDbDraft("");
    await sendDbMessage(dbOpenConvo, body);
    setDbMsgs(await fetchMessages(dbOpenConvo));
  }

  function openConversation(id: string) {
    setOpenChat(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }
  function sendMessage(id: string) {
    const text = draft.trim();
    const convo = conversations.find((c) => c.id === id);
    if (!text || !convo || convo.blocked) return;
    setDraft("");
    const mine = { id: `m-${Date.now()}`, from: "me" as const, text };
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, messages: [...c.messages, mine] } : c)));
    // Simulate the other person replying shortly after.
    const reply = CANNED_REPLIES[convo.messages.length % CANNED_REPLIES.length];
    setTimeout(() => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id || c.blocked) return c;
          const viewing = openChat === id;
          return { ...c, messages: [...c.messages, { id: `r-${Date.now()}`, from: "them", text: reply }], unread: viewing ? 0 : c.unread + 1 };
        }),
      );
      addNotif({ emoji: convo.person.emoji, text: `New message from ${convo.person.name}`, tone: "pending" });
    }, 900);
  }
  function toggleBlock(id: string) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, blocked: !c.blocked } : c)));
  }
  function reportConversation(name: string) {
    addNotif({ emoji: "🚩", text: `Thanks — your report about ${name} was sent to our team.`, tone: "pending" });
  }

  // Registered (real) accounts read from Supabase; jury/demo use seed data.
  const isDemo = session?.kind !== "registered";
  const dbMode = supabaseConfigured() && session?.kind === "registered";
  const myTripsList = dbMode ? dbTrips.filter((t) => t.mine) : myTrips;

  // The user's most recent posted trip powers the overlap badges in the feed.
  const viewerTrip = myTripsList[0] ?? null;
  const allTrips = useMemo(
    () => (isDemo ? [...myTrips, ...DEMO_TRIPS] : dbMode ? dbTrips : [...myTrips]),
    [myTrips, isDemo, dbMode, dbTrips],
  );
  const visibleTrips = useMemo(
    () =>
      allTrips.filter(
        (t) =>
          !passed.has(t.id) &&
          (tDest === "any" || t.destination === tDest) &&
          (tStyle === "any" || t.comfort === tStyle) &&
          (tWith === "any" || t.withWhom === tWith),
      ),
    [allTrips, passed, tDest, tStyle, tWith],
  );
  const tripDestinations = useMemo(() => Array.from(new Set(DEMO_TRIPS.map((t) => t.destination))), []);

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  const allPlans = useMemo(
    () => (isDemo ? [...myPlans, ...DEMO_PLANS, ...TEST_PROFILES] : dbMode ? dbPlans : [...myPlans]),
    [myPlans, isDemo, dbMode, dbPlans],
  );
  const myPlansList = dbMode ? dbPlans.filter((p) => p.ownerId === uid) : myPlans;

  // Incoming requests from the OTHER demo persona (jury ↔ user).
  const persona: Persona = session?.kind === "jury" ? "jury" : "demo";
  const matchRequests = isDemo ? bus.filter((p) => p.persona !== persona && !dismissedReq.has(p.ts)) : [];
  const visiblePlans = useMemo(
    () =>
      allPlans.filter(
        (p) =>
          !passed.has(p.id) &&
          (fDate === "any" || p.dateTag === fDate) &&
          (fArea === "any" || p.areaId === fArea) &&
          (fEvent === "any" || p.activityId === fEvent),
      ),
    [allPlans, passed, fDate, fArea, fEvent],
  );

  if (!ready) return null;

  // ===== Login =====
  if (!session) {
    return (
      <div className="authwrap">
        <aside className="authside">
          <div className="brand">
            both<span className="g">free</span>
            <span className="dot">.</span>
          </div>
          <div className="authpitch">
            <div className="eyebrow">✳ More life, less planning</div>
            <h1>
              Good plans start
              <br />
              when <em>both are free.</em>
            </h1>
            <p>Sign in to see who’s planning to meet near you.</p>
          </div>
          <div className="authfoot">Deterministic matching · no AI · New York</div>
        </aside>
        <main className="authmain">
          {entryScreen === "home" ? (
            <div className="authcard">
              <h2>Welcome to BothFree</h2>
              <p className="sub">Less planning. More living.</p>
              <div className="entrybtns">
                <button className="entrybtn jury" onClick={enterJury}>
                  <span className="entryemoji">⚖️</span>
                  <span className="entrytext">
                    <strong>Jury Access</strong>
                    <small>Isolated demo — explore everything, no real user data.</small>
                  </span>
                </button>
                <button className="entrybtn demo" onClick={enterDemoUser}>
                  <span className="entryemoji">🧭</span>
                  <span className="entrytext">
                    <strong>Explore as User</strong>
                    <small>Try the main features with a ready demo profile.</small>
                  </span>
                </button>
                <button className="entrybtn" onClick={() => { setEntryScreen("auth"); setAuthMode("signin"); setAuthError(null); }}>
                  <span className="entryemoji">🔑</span>
                  <span className="entrytext">
                    <strong>Log In</strong>
                    <small>Sign in to your existing account.</small>
                  </span>
                </button>
                <button className="entrybtn" onClick={() => { setEntryScreen("auth"); setAuthMode("signup"); setAuthError(null); }}>
                  <span className="entryemoji">✨</span>
                  <span className="entrytext">
                    <strong>Sign Up</strong>
                    <small>Create a new account with email verification.</small>
                  </span>
                </button>
              </div>
              <p className="hint">Find friends, discover experiences, and make plans that actually happen.</p>
            </div>
          ) : (
            <div className="authcard">
              <button type="button" className="linkbtn" style={{ marginBottom: 12 }} onClick={() => { setEntryScreen("home"); setPendingVerify(null); }}>
                ← Back
              </button>
              {pendingVerify ? (
                <form className="loginform" onSubmit={(e) => { e.preventDefault(); void submitVerify(); }}>
                  <h2>Check your email</h2>
                  <p className="sub">We sent a 6-digit code to {pendingVerify}.</p>
                  {authError && <div className="autherror">{authError}</div>}
                  <label className="field">
                    <span>Verification code</span>
                    <input className="custominput" inputMode="numeric" placeholder="123456" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} />
                  </label>
                  <button type="submit" className="continue" disabled={authBusy}>
                    {authBusy ? "Verifying…" : "Verify →"}
                  </button>
                  <div className="hint">
                    <button type="button" className="linkbtn" onClick={() => { setPendingVerify(null); setVerifyCode(""); setAuthError(null); }}>
                      Use a different email
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="authswitch">
              <button className={authMode === "signin" ? "on" : ""} onClick={() => { setAuthMode("signin"); setAuthError(null); }}>
                Sign in
              </button>
              <button className={authMode === "signup" ? "on" : ""} onClick={() => { setAuthMode("signup"); setAuthError(null); }}>
                Create account
              </button>
            </div>

            {authError && <div className="autherror">{authError}</div>}

            {authMode === "signin" ? (
              <form
                className="loginform"
                onSubmit={(e) => {
                  e.preventDefault();
                  void signIn();
                }}
              >
                <label className="field">
                  <span>Email</span>
                  <input type="email" className="custominput" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input type="password" className="custominput" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </label>
                <button type="submit" className="continue" disabled={authBusy}>
                  {authBusy ? "Signing in…" : "Log in →"}
                </button>
                <div className="hint">
                  New here?{" "}
                  <button type="button" className="linkbtn" onClick={() => { setAuthMode("signup"); setAuthError(null); }}>
                    Create an account
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="loginform"
                onSubmit={(e) => {
                  e.preventDefault();
                  void signUp();
                }}
              >
                <label className="field">
                  <span>Name</span>
                  <input className="custominput" placeholder="How should we call you?" value={suName} onChange={(e) => setSuName(e.target.value)} autoComplete="name" />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input type="email" className="custominput" placeholder="you@example.com" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} autoComplete="email" />
                </label>
                <div className="twocol">
                  <label className="field">
                    <span>Password</span>
                    <input type="password" className="custominput" placeholder="At least 6 characters" value={suPassword} onChange={(e) => setSuPassword(e.target.value)} autoComplete="new-password" />
                  </label>
                  <label className="field">
                    <span>Date of birth</span>
                    <input type="date" className="custominput" value={suDob} onChange={(e) => setSuDob(e.target.value)} />
                  </label>
                </div>
                <label className="field">
                  <span>How do you describe your gender?</span>
                  <select className="custominput" value={suGender} onChange={(e) => setSuGender(e.target.value)}>
                    <option value="">Select…</option>
                    <option value="woman">Woman</option>
                    <option value="man">Man</option>
                    <option value="nonbinary">Non-binary</option>
                    <option value="self">Prefer to self-describe</option>
                    <option value="prefer_not">Prefer not to say</option>
                  </select>
                </label>
                <label className="check">
                  <input type="checkbox" checked={suFriendly} onChange={(e) => setSuFriendly(e.target.checked)} />
                  <span>Show an “🏳️‍🌈 LGBTQ+ friendly” badge on my profile — tell others my space is welcoming (optional).</span>
                </label>
                <label className="check">
                  <input type="checkbox" checked={suTerms} onChange={(e) => setSuTerms(e.target.checked)} />
                  <span>I’m 18 or older and agree to the Terms & Privacy Policy.</span>
                </label>
                <button type="submit" className="continue" disabled={authBusy}>
                  {authBusy ? "Creating…" : "Create account →"}
                </button>
                <div className="hint">
                  Already have an account?{" "}
                  <button type="button" className="linkbtn" onClick={() => { setAuthMode("signin"); setAuthError(null); }}>
                    Sign in
                  </button>
                </div>
              </form>
            )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ===== App (sidebar layout) =====
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <Link href="/" style={{ textDecoration: "none" }}>
            both<span className="g">free</span>
            <span className="dot">.</span>
          </Link>
        </div>
        <span className={`kindpill kind-${session.kind}`}>
          {session.kind === "jury" ? "⚖️ Jury access" : session.kind === "demo" ? "🧭 Demo user" : "✓ Account"}
        </span>

        <button className="newplan" onClick={() => setCreateOpen(true)}>
          <span className="plus">+</span> New plan
        </button>

        <nav className="navgroup">
          {([
            ["feed", "🧭", "Discover"],
            ["travel", "✈️", "Travel"],
            ["friends", "🤝", "Friends"],
            ["messages", "💬", "Messages"],
            ["meetings", "📅", "Meetings"],
            ["spark", "✨", "Spark"],
            ["plans", "🗂️", "My plans"],
            ["profile", "🧑", "Profile"],
          ] as [View, string, string][]).map(([v, icon, label]) => (
            <button key={v} className={`navitem${view === v ? " active" : ""}`} onClick={() => setView(v)}>
              <span className="navicon">{icon}</span>
              {label}
              {v === "plans" && myPlansList.length > 0 && <span className="navbadge">{myPlansList.length}</span>}
              {v === "friends" && incoming.length > 0 && <span className="navbadge">{incoming.length}</span>}
              {v === "messages" && totalUnread > 0 && <span className="navbadge">{totalUnread}</span>}
              {v === "meetings" && meetings.filter((m) => m.status === "awaiting_you").length > 0 && (
                <span className="navbadge">{meetings.filter((m) => m.status === "awaiting_you").length}</span>
              )}
              {v === "spark" && !premium && <span className="navbadge pro">PRO</span>}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div className="bellwrap">
            <button className="bell" onClick={openBell} aria-label="Notifications">
              🔔{unread > 0 && <span className="bellcount">{unread}</span>}
            </button>
            {bellOpen && (
              <div className="notifpanel">
                <strong className="notifhead">Notifications</strong>
                {notifs.length === 0 && <div className="notifempty">Nothing yet — join a plan!</div>}
                {notifs.map((n) => (
                  <div className={`notifitem ${n.tone}`} key={n.id}>
                    <span className="notifemoji">{n.emoji}</span>
                    <span>{n.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            className={`premiumbtn${premium ? " on" : ""}`}
            onClick={() => setPremium((p) => !p)}
            title="Test mode — no real charge"
          >
            {premium ? "★ Premium" : "Try Premium"}
          </button>
          <button className="signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        {session.kind === "jury" && (
          <div className="jurybanner">
            ⚖️ Jury view — isolated demo environment. Profiles are test data; no real user information is shown. Change filters to see the matching update live.
          </div>
        )}
        {view === "feed" && (
          <>
            <div className="contenthead">
              <div>
                <h1 className="pagetitle">Discover plans</h1>
                <p className="sub">
                  {isDemo
                    ? `${allPlans.length} demo profiles · matching is real — change filters to see it update.`
                    : "People posting when and where they want to meet."}
                </p>
              </div>
              <button className="newplan compact" onClick={() => setCreateOpen(true)}>
                <span className="plus">+</span> New plan
              </button>
            </div>

            {matchRequests.length > 0 && (
              <div className="matchreqs">
                <div className="sectionlabel" style={{ marginTop: 0 }}>💚 Match requests</div>
                {matchRequests.map((p) => {
                  const mutual = bus.some(
                    (m) => m.persona === persona && m.activityId === p.activityId && m.areaId === p.areaId,
                  );
                  return (
                    <div className="frow" key={p.ts}>
                      <div className="avatar">{p.emoji}</div>
                      <div className="frow-id">
                        <strong>
                          {p.name}
                          {mutual && <span className="overlapbadge" style={{ marginLeft: 8 }}>✓ same plan</span>}
                        </strong>
                        <span className="frow-blurb">
                          Wants: {activityById(p.activityId)?.label} · {areaById(p.areaId)?.label} · {p.whenLabel}
                        </span>
                      </div>
                      <div className="frow-actions">
                        <button className="passbtn" onClick={() => setDismissedReq((prev) => new Set(prev).add(p.ts))}>
                          Dismiss
                        </button>
                        <button
                          className="matchbtn"
                          onClick={() => {
                            setDismissedReq((prev) => new Set(prev).add(p.ts));
                            addNotif({ emoji: p.emoji, text: `It’s a match! You and ${p.name} are set for ${activityById(p.activityId)?.label ?? "a plan"} 🎉`, tone: "match" });
                          }}
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="filters">
              <label className="filter">
                <span>Date</span>
                <select value={fDate} onChange={(e) => setFDate(e.target.value as typeof fDate)}>
                  <option value="any">Any time</option>
                  <option value="weekday">Weekdays</option>
                  <option value="weekend">Weekends</option>
                </select>
              </label>
              <label className="filter">
                <span>Location</span>
                <select value={fArea} onChange={(e) => setFArea(e.target.value)}>
                  <option value="any">Anywhere</option>
                  {AREAS.filter((a) => a.id !== "anywhere").map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter">
                <span>Event</span>
                <select value={fEvent} onChange={(e) => setFEvent(e.target.value)}>
                  <option value="any">Any event</option>
                  {ACTIVITIES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="feed">
              {visiblePlans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  premium={premium}
                  liked={liked.has(p.id)}
                  requested={requested.has(p.id)}
                  helperOpen={helperFor === p.id}
                  mine={dbMode ? p.ownerId === uid : myPlans.some((m) => m.id === p.id)}
                  onLike={() => like(p.id)}
                  onPass={() => setPassed((prev) => new Set(prev).add(p.id))}
                  onJoin={() => joinPlan(p)}
                  onToggleHelper={() => setHelperFor(helperFor === p.id ? null : p.id)}
                  onUpgrade={() => setPremium(true)}
                  onCopyInvite={() => copyInvite(p)}
                  onOpenProfile={() => setOpenProfile({ id: dbMode ? p.ownerId : undefined, plan: p })}
                />
              ))}
              {visiblePlans.length === 0 && (
                <div className="note">No plans match these filters. Try widening them, or post your own.</div>
              )}
            </div>
          </>
        )}

        {view === "travel" && (
          <>
            <div className="contenthead">
              <div>
                <h1 className="pagetitle">Travel Together ✈️</h1>
                <p className="sub">Find a travel partner whose dates, budget, and style line up with yours.</p>
              </div>
              <button className="newplan compact" onClick={() => setCreateTripOpen(true)}>
                <span className="plus">+</span> New trip
              </button>
            </div>

            {viewerTrip && (
              <div className="tripbanner">
                🧭 Matching against your trip: <b>{viewerTrip.destination.split(",")[0]}</b> · {tripDatesLabel(viewerTrip)} · {tripBudgetLabel(viewerTrip.budgetMinCents, viewerTrip.budgetMaxCents)}
              </div>
            )}

            <div className="filters">
              <label className="filter">
                <span>Destination</span>
                <select value={tDest} onChange={(e) => setTDest(e.target.value)}>
                  <option value="any">Anywhere</option>
                  {tripDestinations.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter">
                <span>Style</span>
                <select value={tStyle} onChange={(e) => setTStyle(e.target.value)}>
                  <option value="any">Any style</option>
                  {COMFORTS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter">
                <span>With</span>
                <select value={tWith} onChange={(e) => setTWith(e.target.value)}>
                  <option value="any">Anyone</option>
                  {WITH_WHOM.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="feed">
              {visibleTrips.map((t) => (
                <TripCard
                  key={t.id}
                  trip={t}
                  viewerTrip={viewerTrip}
                  premium={premium}
                  requested={requested.has(t.id)}
                  mine={myTrips.some((m) => m.id === t.id)}
                  onPass={() => setPassed((prev) => new Set(prev).add(t.id))}
                  onJoin={() => joinTrip(t)}
                />
              ))}
              {visibleTrips.length === 0 && (
                <div className="note">No trips match these filters. Try widening them, or post your own.</div>
              )}
            </div>
          </>
        )}

        {view === "friends" && (
          <>
            <div className="contenthead">
              <div>
                <h1 className="pagetitle">Friends</h1>
                <p className="sub">🔒 Your friends list is private — only you can see it.</p>
              </div>
            </div>

            {dbMode ? (
              (() => {
                const incomingDb = friendRows.filter((r) => r.status === "pending" && r.to_user === uid);
                const friendsDb = friendRows.filter((r) => r.status === "accepted");
                const other = (r: FriendRequestRow) => (r.from_user === uid ? r.to_user : r.from_user);
                return (
                  <>
                    {incomingDb.length > 0 && (
                      <>
                        <div className="sectionlabel">Friend requests</div>
                        <div className="frlist">
                          {incomingDb.map((r) => (
                            <div className="frow" key={r.id}>
                              <div className="avatar">🧑</div>
                              <div className="frow-id">
                                <strong>{peopleMap[other(r)] ?? "BothFree member"}</strong>
                                <span className="frow-blurb">wants to be your friend</span>
                              </div>
                              <div className="frow-actions">
                                <button className="passbtn" onClick={() => dbRespondFriend(r.id, false, peopleMap[other(r)] ?? "member")}>
                                  Decline
                                </button>
                                <button className="matchbtn" onClick={() => dbRespondFriend(r.id, true, peopleMap[other(r)] ?? "member")}>
                                  Accept
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="sectionlabel">Your friends · {friendsDb.length}</div>
                    {friendsDb.length === 0 ? (
                      <div className="note">No friends yet. Open someone’s profile from a plan and send a request.</div>
                    ) : (
                      <div className="frlist">
                        {friendsDb.map((r) => (
                          <div className="frow" key={r.id}>
                            <div className="avatar">🧑</div>
                            <div className="frow-id">
                              <strong>{peopleMap[other(r)] ?? "BothFree member"}</strong>
                              <span className="frow-blurb">Friends</span>
                            </div>
                            <span className="eventbadge">✓ Friends</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="note" style={{ marginTop: 16 }}>
                      To add friends, open a person’s profile from their plan in Discover and tap “Add friend.”
                    </div>
                  </>
                );
              })()
            ) : (
              <>
            {incoming.length > 0 && (
              <>
                <div className="sectionlabel">Friend requests</div>
                <div className="frlist">
                  {incoming.map((p) => (
                    <PersonRow key={p.id} person={p}>
                      <button className="passbtn" onClick={() => declineFriend(p)}>
                        Decline
                      </button>
                      <button className="matchbtn" onClick={() => acceptFriend(p)}>
                        Accept
                      </button>
                    </PersonRow>
                  ))}
                </div>
              </>
            )}

            <div className="sectionlabel">Your friends · {friends.length}</div>
            {friends.length === 0 ? (
              <div className="note">No friends yet. Accept a request or add someone below.</div>
            ) : (
              <div className="frlist">
                {friends.map((p) => (
                  <PersonRow key={p.id} person={p}>
                    <span className="eventbadge">✓ Friends</span>
                  </PersonRow>
                ))}
              </div>
            )}

            <div className="sectionlabel">People you may know</div>
            {isDemo ? (
              <div className="frlist">
                {FRIEND_SUGGESTIONS.filter((p) => !friends.some((f) => f.id === p.id)).map((p) => (
                  <PersonRow key={p.id} person={p}>
                    {sentFriends.has(p.id) ? (
                      <span className="eventbadge">Requested</span>
                    ) : (
                      <button className="matchbtn" onClick={() => addFriend(p)}>
                        ＋ Add friend
                      </button>
                    )}
                  </PersonRow>
                ))}
              </div>
            ) : (
              <div className="note">No suggestions yet — we’ll surface people as the community grows.</div>
            )}
              </>
            )}
          </>
        )}

        {view === "messages" && dbMode && (
          <>
            <div className="contenthead">
              <div>
                <h1 className="pagetitle">Messages</h1>
                <p className="sub">💬 You can message friends and mutual matches only.</p>
              </div>
            </div>
            <div className={`chatwrap${dbOpenConvo ? " open" : ""}`}>
              <div className="chatlist">
                {dbConvos.length === 0 && (
                  <div className="note" style={{ margin: 4 }}>No conversations yet. Open a friend’s profile and tap “Message.”</div>
                )}
                {dbConvos.map((c) => (
                  <button key={c.id} className={`convo${dbOpenConvo === c.id ? " active" : ""}`} onClick={() => openDbConvo(c.id)}>
                    <div className="avatar">🧑</div>
                    <div className="convo-id">
                      <strong>{c.name}</strong>
                      <span className="convo-last">Open chat</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="chatthread">
                {!dbOpenConvo ? (
                  <div className="chatempty">Select a conversation to start chatting.</div>
                ) : (
                  <>
                    <div className="chathead">
                      <button className="chatback" onClick={() => setDbOpenConvo(null)} aria-label="Back">←</button>
                      <div className="avatar">🧑</div>
                      <strong>{dbConvos.find((c) => c.id === dbOpenConvo)?.name ?? "Chat"}</strong>
                    </div>
                    <div className="chatbody">
                      {dbMsgs.length === 0 && <div className="chatblocked">Say hi 👋</div>}
                      {dbMsgs.map((m) => (
                        <div key={m.id} className={`bubble ${m.sender === uid ? "me" : "them"}`}>
                          {m.body}
                        </div>
                      ))}
                    </div>
                    <form
                      className="chatinput"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void sendDbChat();
                      }}
                    >
                      <input className="custominput" placeholder="Write a message…" value={dbDraft} onChange={(e) => setDbDraft(e.target.value)} />
                      <button type="submit" className="matchbtn" disabled={!dbDraft.trim()}>
                        Send
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {view === "messages" && !dbMode && (
          <>
            <div className="contenthead">
              <div>
                <h1 className="pagetitle">Messages</h1>
                <p className="sub">💬 You can message friends and mutual matches only.</p>
              </div>
            </div>
            <div className={`chatwrap${openChat ? " open" : ""}`}>
              <div className="chatlist">
                {conversations.length === 0 && (
                  <div className="note" style={{ margin: 4 }}>No conversations yet. Message a friend or a mutual match.</div>
                )}
                {conversations.map((c) => (
                  <button key={c.id} className={`convo${openChat === c.id ? " active" : ""}`} onClick={() => openConversation(c.id)}>
                    <div className="avatar">{c.person.emoji}</div>
                    <div className="convo-id">
                      <strong>{c.person.name}</strong>
                      <span className="convo-last">{c.blocked ? "Blocked" : c.messages[c.messages.length - 1]?.text}</span>
                    </div>
                    {c.unread > 0 && <span className="navbadge">{c.unread}</span>}
                  </button>
                ))}
              </div>
              <div className="chatthread">
                {(() => {
                  const c = conversations.find((x) => x.id === openChat);
                  if (!c) return <div className="chatempty">Select a conversation to start chatting.</div>;
                  return (
                    <>
                      <div className="chathead">
                        <button className="chatback" onClick={() => setOpenChat(null)} aria-label="Back">
                          ←
                        </button>
                        <div className="avatar">{c.person.emoji}</div>
                        <strong>{c.person.name}</strong>
                        <div className="chathead-actions">
                          <button className="rangebtn" onClick={() => reportConversation(c.person.name)}>
                            Report
                          </button>
                          <button className="rangebtn" onClick={() => toggleBlock(c.id)}>
                            {c.blocked ? "Unblock" : "Block"}
                          </button>
                        </div>
                      </div>
                      <div className="chatbody">
                        {c.messages.map((m) => (
                          <div key={m.id} className={`bubble ${m.from}`}>
                            {m.text}
                          </div>
                        ))}
                        {c.blocked && <div className="chatblocked">You blocked {c.person.name}. New messages are off.</div>}
                      </div>
                      <form
                        className="chatinput"
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendMessage(c.id);
                        }}
                      >
                        <input
                          className="custominput"
                          placeholder={c.blocked ? "Unblock to send messages" : "Write a message…"}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          disabled={c.blocked}
                        />
                        <button type="submit" className="matchbtn" disabled={c.blocked || !draft.trim()}>
                          Send
                        </button>
                      </form>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}

        {view === "plans" && (
          <>
            <div className="contenthead">
              <div>
                <h1 className="pagetitle">My plans</h1>
                <p className="sub">Plans you’ve posted for others to join.</p>
              </div>
              <button className="newplan compact" onClick={() => setCreateOpen(true)}>
                <span className="plus">+</span> New plan
              </button>
            </div>
            <div className="feed">
              {myPlansList.length === 0 && (
                <div className="emptybox">
                  <div className="emptyemoji">🗓️</div>
                  <h3>No plans yet</h3>
                  <p>Post your first plan and people who fit can ask to join.</p>
                  <button className="continue" style={{ maxWidth: 220 }} onClick={() => setCreateOpen(true)}>
                    + Create a plan
                  </button>
                </div>
              )}
              {myPlansList.map((p) => (
                <PlanCard key={p.id} plan={p} premium={premium} liked={false} requested mine onLike={() => {}} onPass={() => {}} onJoin={() => {}} helperOpen={false} onToggleHelper={() => {}} onUpgrade={() => {}} onCopyInvite={() => copyInvite(p)} />
              ))}
            </div>
          </>
        )}

        {view === "meetings" && (
          <>
            <div className="contenthead">
              <div>
                <h1 className="pagetitle">Meetings 📅</h1>
                <p className="sub">A match is just the start — a meeting counts only when both of you confirm.</p>
              </div>
            </div>
            {meetings.length === 0 ? (
              <div className="emptybox">
                <div className="emptyemoji">📅</div>
                <h3>No meetings yet</h3>
                <p>Say “I’m in” on a plan in Discover to propose a time — then both sides confirm.</p>
                <button className="continue" style={{ maxWidth: 220 }} onClick={() => setView("feed")}>
                  Browse plans
                </button>
              </div>
            ) : (
              <div className="feed">
                {meetings.map((m) => (
                  <MeetingCard
                    key={m.id}
                    m={m}
                    onConfirm={() => confirmMeeting(m)}
                    onCancel={() => cancelMeeting(m)}
                    onReschedule={() => setRescheduleFor(m)}
                    onIcs={() => downloadIcs(m)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {view === "spark" && <SparkView premium={premium} onUnlock={() => setPremium(true)} />}

        {view === "profile" && <ProfileView session={session} demo={isDemo} profile={dbProfile} />}
      </main>

      {createOpen && (
        <CreatePlanModal
          author={
            isDemo
              ? { name: TEST_PROFILE.name, emoji: TEST_PROFILE.emoji, age: TEST_PROFILE.age }
              : { name: dbProfile?.name || session.name || "You", emoji: "🧑" }
          }
          onClose={() => setCreateOpen(false)}
          onTravel={() => {
            setCreateOpen(false);
            setCreateTripOpen(true);
          }}
          onPost={async (plan) => {
            if (dbMode) {
              const saved = await insertPlan(plan);
              if (saved) setDbPlans((prev) => [saved, ...prev]);
            } else {
              setMyPlans((prev) => [plan, ...prev]);
              postToBus(plan);
            }
            setCreateOpen(false);
            setView("plans");
            if (plan.mode === "invite" && plan.inviteToken) {
              addNotif({ emoji: "🔗", text: "Invite plan created — open it in My plans to copy the share link.", tone: "match" });
            } else {
              addNotif({ emoji: "✅", text: "Your plan is live. People who fit can now ask to join.", tone: "match" });
            }
          }}
        />
      )}

      {createTripOpen && (
        <CreateTripModal
          onClose={() => setCreateTripOpen(false)}
          onPost={async (trip) => {
            if (dbMode) {
              const saved = await insertTrip(trip);
              if (saved) setDbTrips((prev) => [saved, ...prev]);
            } else {
              setMyTrips((prev) => [trip, ...prev]);
            }
            setCreateTripOpen(false);
            setView("travel");
            addNotif({ emoji: "✈️", text: "Your trip is live. We’ll match travellers by dates, budget, and style.", tone: "match" });
          }}
        />
      )}

      {rescheduleFor && (
        <RescheduleModal
          meeting={rescheduleFor}
          onClose={() => setRescheduleFor(null)}
          onApply={(date, hour, place) => applyReschedule(rescheduleFor, date, hour, place)}
        />
      )}

      {openProfile && (
        <ProfileModal
          uid={uid}
          dbMode={dbMode}
          plan={openProfile.plan}
          profileId={openProfile.id}
          friendRows={friendRows}
          onClose={() => setOpenProfile(null)}
          onSendFriend={(toUser, name) => dbSendFriend(toUser, name)}
          onMessage={(toUser) => {
            setOpenProfile(null);
            void startChatWith(toUser);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Profile modal (open someone's profile) ---------------- */

function ProfileModal({
  uid,
  dbMode,
  plan,
  profileId,
  friendRows,
  onClose,
  onSendFriend,
  onMessage,
}: {
  uid: string | null;
  dbMode: boolean;
  plan?: DemoPlan;
  profileId?: string;
  friendRows: FriendRequestRow[];
  onClose: () => void;
  onSendFriend: (toUser: string, name: string) => void;
  onMessage: (toUser: string) => void;
}) {
  const [loaded, setLoaded] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (dbMode && profileId) {
      setLoading(true);
      fetchProfileById(profileId).then((p) => {
        setLoaded(p);
        setLoading(false);
      });
    }
  }, [dbMode, profileId]);

  const name = loaded?.name ?? plan?.name ?? "BothFree member";
  const emoji = plan?.emoji ?? "🧑";
  const bio = loaded?.bio || plan?.note || "This member hasn’t added a bio yet.";
  const interests = loaded?.interests ?? (plan ? [plan.activityId] : []);
  const city = loaded?.city ?? "New York";

  const rel = dbMode && profileId && uid ? statusFor(friendRows, uid, profileId).status : "none";

  function friendButton() {
    if (!dbMode) {
      return (
        <button className="matchbtn" disabled={sent} onClick={() => setSent(true)}>
          {sent ? "Request sent ✓" : "＋ Add friend"}
        </button>
      );
    }
    if (!profileId) return <span className="eventbadge">Profile unavailable</span>;
    if (rel === "friends")
      return (
        <>
          <span className="eventbadge">✓ Friends</span>
          <button className="matchbtn" onClick={() => onMessage(profileId)}>
            💬 Message
          </button>
        </>
      );
    if (rel === "pending_out" || sent) return <span className="eventbadge">Requested</span>;
    if (rel === "pending_in") return <span className="eventbadge">Wants to be friends — see Friends tab</span>;
    return (
      <button
        className="matchbtn"
        onClick={() => {
          setSent(true);
          onSendFriend(profileId, name);
        }}
      >
        ＋ Add friend
      </button>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h2>Profile</h2>
          <button className="closebtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <p className="sub">Loading…</p>
          ) : (
            <>
              <div className="profiletop">
                <div className="avatar big">{emoji}</div>
                <div>
                  <h2 className="profilename">
                    {name}
                    {plan && !dbMode ? `, ${plan.age}` : ""}
                  </h2>
                  <div className="pcard-area">📍 {city}</div>
                </div>
              </div>
              <p className="pcard-bio">{bio}</p>
              {loaded?.lgbtqFriendly && (
                <div className="badgerow">
                  <span className="rainbowbadge">🏳️‍🌈 LGBTQ+ friendly</span>
                </div>
              )}
              {interests.length > 0 && (
                <>
                  <div className="sectionlabel">Interests</div>
                  <div className="tagrow">
                    {interests.map((id) => (
                      <span className="tag" key={id}>
                        {activityById(id)?.emoji} {activityById(id)?.label ?? id}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <div className="note" style={{ marginTop: 18 }}>
                Private info (email, exact schedule, friends list) is never shown here.
              </div>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="passbtn" onClick={onClose}>
            Close
          </button>
          {friendButton()}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Plan card ---------------- */

function PlanCard(props: {
  plan: DemoPlan;
  premium: boolean;
  liked: boolean;
  requested: boolean;
  mine: boolean;
  helperOpen: boolean;
  onLike: () => void;
  onPass: () => void;
  onJoin: () => void;
  onToggleHelper: () => void;
  onUpgrade: () => void;
  onCopyInvite?: () => void;
  onOpenProfile?: () => void;
}) {
  const { plan, premium, liked, requested, mine, helperOpen, onLike, onPass, onJoin, onToggleHelper, onUpgrade, onCopyInvite, onOpenProfile } = props;
  const activity = activityById(plan.activityId);
  const area = areaById(plan.areaId);
  const clickable = !mine && !!onOpenProfile;

  return (
    <article className="pcard">
      <div className="pcard-top">
        <button
          className={`avatar${clickable ? " clickable" : ""}`}
          onClick={clickable ? onOpenProfile : undefined}
          style={{ border: "none", cursor: clickable ? "pointer" : "default" }}
          aria-label={clickable ? `Open ${plan.name}'s profile` : undefined}
        >
          {plan.emoji}
        </button>
        <div className="pcard-id">
          <strong>
            {clickable ? (
              <button className="namelink" onClick={onOpenProfile}>
                {plan.name}
              </button>
            ) : (
              plan.name
            )}
            {!mine && `, ${plan.age}`}
            {mine && <span className="minetag"> · you</span>}
          </strong>
          <span className="pcard-area">
            📍 {plan.areaLabel ?? area?.label ?? plan.areaId} · 🗓️ {plan.whenLabel}
          </span>
        </div>
        <span className="eventbadge">
          {activity?.emoji} {activity?.label}
        </span>
      </div>

      <p className="pcard-bio">{plan.note}</p>
      <div className="avail">
        💸 {plan.budgetLabel}
        {plan.billLabel && ` · 💳 ${plan.billLabel}`}
      </div>
      <div className="badgerow">
        {plan.groupSize && plan.groupSize > 1 && <span className="eventbadge">👥 Group of {plan.groupSize}</span>}
        {plan.lgbtqFriendly && <span className="rainbowbadge">🏳️‍🌈 LGBTQ+ friendly</span>}
        {premium && !mine && plan.likesYouBack && <span className="likesyou">♥ Likes you back</span>}
      </div>

      {!mine && (
        <div className="pcard-actions">
          <button className="passbtn" onClick={onPass}>
            Pass
          </button>
          <button className={`likebtn${liked ? " on" : ""}`} onClick={onLike}>
            {liked ? "♥ Liked" : "♡ Like"}
          </button>
          <button className="matchbtn" disabled={requested} onClick={onJoin}>
            {requested ? "Requested ✓" : "I’m in →"}
          </button>
        </div>
      )}

      {!mine && (
        <>
          <button className="helperbtn" onClick={onToggleHelper}>
            💬 Icebreakers & date ideas{premium ? "" : " · Premium"}
          </button>
          {helperOpen &&
            (premium ? (
              <HelperPanel plan={plan} />
            ) : (
              <div className="locked">
                <strong>✨ Premium feature</strong>
                <p>Get tailored icebreakers and a first-date plan for {plan.name}, based on what you share — no AI.</p>
                <button className="matchbtn" onClick={onUpgrade}>
                  Switch to Premium (test)
                </button>
              </div>
            ))}
        </>
      )}

      {mine && plan.mode === "invite" && plan.inviteToken && onCopyInvite && (
        <>
          <div className="invitebox">
            🔗 <span>/invite/{plan.inviteToken}</span>
          </div>
          <button className="helperbtn" onClick={onCopyInvite}>
            Copy invite link
          </button>
        </>
      )}
    </article>
  );
}

function HelperPanel({ plan }: { plan: DemoPlan }) {
  const helper = useMemo(() => {
    const shared = [plan.activityId, ...TEST_PROFILE.interestIds.filter((i) => i !== plan.activityId)];
    return buildDateHelper({
      mode: "dating",
      otherName: plan.name,
      otherAge: plan.age,
      selfAge: TEST_PROFILE.age,
      areaLabels: [areaById(plan.areaId)?.label ?? plan.areaId],
      sharedActivityIds: shared,
    });
  }, [plan]);
  return (
    <div className="helper">
      <div className="helper-sec">
        <strong>Break the ice</strong>
        <ul>
          {helper.icebreakers.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>
      <div className="helper-sec">
        <strong>A good first meet-up</strong>
        <p>{helper.firstDateIdea}</p>
      </div>
      <div className="helper-sec">
        <strong>If it goes well</strong>
        <ul>
          {helper.nextDateIdeas.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>
      <div className="helper-foot">Suggestions are rule-based from what you share — not AI.</div>
    </div>
  );
}

/* ---------------- Spark (premium conversation cards) ---------------- */

function shuffleDeck(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function SparkView({ premium, onUnlock }: { premium: boolean; onUnlock: () => void }) {
  const [order, setOrder] = useState<number[]>(() => shuffleDeck(SPARK_QUESTIONS.length));
  const [idx, setIdx] = useState(0);

  if (!premium) {
    return (
      <>
        <div className="contenthead">
          <div>
            <h1 className="pagetitle">Spark ✨</h1>
            <p className="sub">Heartfelt cards to really get to know each other.</p>
          </div>
        </div>
        <div className="sparklock">
          <div className="sparkpreview">
            <div className="sparkcard small">
              <span className="sparknum">01</span>
              <p>{SPARK_QUESTIONS[0]}</p>
            </div>
            <div className="sparkcard small blurred">
              <p>{SPARK_QUESTIONS[1]}</p>
            </div>
            <div className="sparkcard small blurred">
              <p>{SPARK_QUESTIONS[2]}</p>
            </div>
          </div>
          <div className="locked" style={{ maxWidth: 420 }}>
            <strong>✨ Premium feature</strong>
            <p>
              Unlock 50 deep, playful questions that spark real conversation and help you
              get closer — perfect for a first date or a brand-new friend.
            </p>
            <button className="matchbtn" onClick={onUnlock}>
              Unlock Premium (test)
            </button>
          </div>
        </div>
      </>
    );
  }

  const q = SPARK_QUESTIONS[order[idx]];
  return (
    <>
      <div className="contenthead">
        <div>
          <h1 className="pagetitle">Spark ✨</h1>
          <p className="sub">
            Card {idx + 1} of {SPARK_QUESTIONS.length} · draw a card and answer it together.
          </p>
        </div>
      </div>
      <div className="sparkplay">
        <div className="sparkcard big">
          <span className="sparknum">{String(order[idx] + 1).padStart(2, "0")} / {SPARK_QUESTIONS.length}</span>
          <p>{q}</p>
        </div>
        <div className="sparkbtns">
          <button
            className="passbtn"
            onClick={() => {
              setOrder(shuffleDeck(SPARK_QUESTIONS.length));
              setIdx(0);
            }}
          >
            🔀 Shuffle
          </button>
          <button
            className="continue"
            style={{ width: "auto", padding: "14px 28px" }}
            onClick={() => setIdx((i) => (i + 1) % SPARK_QUESTIONS.length)}
          >
            Next card →
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------- Profile ---------------- */

function ProfileView({ session, demo, profile }: { session: typeof TEST_IDENTITY; demo: boolean; profile: DbProfile | null }) {
  const p = TEST_PROFILE;
  const name = (demo ? p.name : profile?.name) || session.name || "You";
  const emoji = demo ? p.emoji : "🧑";
  const city = demo ? p.city : profile?.city ?? "New York";
  const areaId = demo ? p.areaId : profile?.areaId ?? null;
  const bio = demo ? p.bio : profile?.bio || "Add a short bio so people get a feel for you.";
  const interests = demo ? p.interestIds : profile?.interests ?? [];
  const friendly = demo ? p.lgbtqFriendly : Boolean(profile?.lgbtqFriendly);
  const areaLabel = areaId ? areaById(areaId)?.label : null;
  return (
    <>
      <div className="contenthead">
        <h1 className="pagetitle">Profile</h1>
      </div>
      <div className="profilecard">
        <div className="profiletop">
          <div className="avatar big">{emoji}</div>
          <div>
            <h2 className="profilename">
              {name}
              {demo ? `, ${p.age}` : ""}
            </h2>
            <div className="pcard-area">
              📍 {city}
              {areaLabel ? ` · ${areaLabel}` : ""}
            </div>
          </div>
          <span className="eventbadge">{demo ? "Verified · demo" : "Your account"}</span>
        </div>
        <p className="pcard-bio">{bio}</p>
        {friendly && (
          <div className="badgerow">
            <span className="rainbowbadge">🏳️‍🌈 LGBTQ+ friendly</span>
          </div>
        )}
        {interests.length > 0 && (
          <>
            <div className="sectionlabel">Interests</div>
            <div className="tagrow">
              {interests.map((id) => (
                <span className="tag" key={id}>
                  {activityById(id)?.emoji} {activityById(id)?.label}
                </span>
              ))}
            </div>
          </>
        )}
        <div className="summary">
          <div className="summaryline">
            <span>City</span>
            <b>{city}</b>
          </div>
          <div className="summaryline">
            <span>Preferred area</span>
            <b>{areaLabel ?? "—"}</b>
          </div>
          <div className="summaryline">
            <span>Email</span>
            <b>{session.email}</b>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Create plan modal ---------------- */

/** Best-effort parse of a plan's "Sat · 11:00 AM" label into date + hour. */
function parsePlanSlot(plan: DemoPlan): { date: string; hour: number } {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const label = plan.whenLabel ?? "";
  const wd = weekdays.findIndex((w) => label.startsWith(w));
  const timeM = label.match(/(\d{1,2}):\d{2}\s*(AM|PM)/i);
  let hour = 18;
  if (timeM) {
    hour = Number(timeM[1]) % 12;
    if (/PM/i.test(timeM[2])) hour += 12;
  }
  const d = new Date();
  if (wd >= 0) {
    const delta = (wd - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + delta);
  } else {
    d.setDate(d.getDate() + 3);
  }
  return { date: d.toISOString().slice(0, 10), hour };
}

function ageFromDob(dob: string): number {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

const HOUR_LABELS: Record<number, string> = {};
for (let h = 0; h < 24; h++) {
  const period = h < 12 ? "AM" : "PM";
  const base = h % 12 === 0 ? 12 : h % 12;
  HOUR_LABELS[h] = `${base}:00 ${period}`;
}

const CREATE_MODES: { id: Mode; emoji: string; title: string; desc: string }[] = [
  { id: "invite", emoji: "💌", title: "Invite someone I know", desc: "Plan with a person you already know." },
  { id: "friendship", emoji: "🫶", title: "Find a new friend", desc: "Meet people by shared interests." },
  { id: "dating", emoji: "💚", title: "Find a date", desc: "Meet someone new for a date." },
];

function CreatePlanModal({ onClose, onPost, onTravel, author }: { onClose: () => void; onPost: (plan: DemoPlan) => void; onTravel: () => void; author: { name: string; emoji: string; age?: number } }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode | "">("");
  const [groupSize, setGroupSize] = useState(1);
  const [activity, setActivity] = useState("");
  const [area, setArea] = useState("");
  const [customArea, setCustomArea] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<string, number[]>>({});
  const [budget, setBudget] = useState(40);
  const [bill, setBill] = useState("own");
  const [note, setNote] = useState("");

  const hasSlot = Object.values(slots).some((hrs) => hrs.length > 0);
  const typedArea = customArea.trim();
  const effectiveArea = typedArea ? "custom" : area;
  const areaDisplay = typedArea || areaById(area)?.label || "somewhere in NYC";

  // "Find a new friend" inserts a group-size step right after the mode step.
  const stepKeys = ["mode", ...(mode === "friendship" ? ["groupSize"] : []), "activity", "days", "times", "area", "budget"];
  const totalSteps = stepKeys.length;
  const current = stepKeys[Math.min(step, totalSteps - 1)];

  const stepValid =
    (current === "mode" && !!mode) ||
    current === "groupSize" ||
    (current === "activity" && !!activity) ||
    (current === "days" && days.length > 0) ||
    (current === "times" && hasSlot) ||
    (current === "area" && !!effectiveArea) ||
    current === "budget";

  function post() {
    const dayWithSlot = days.filter((d) => (slots[d] ?? []).length > 0).sort()[0];
    const hour = Math.min(...(slots[dayWithSlot] ?? [9]));
    const d = new Date(`${dayWithSlot}T00:00:00`);
    const weekday = d.getDay();
    const dateTag: DateTag = weekday === 0 || weekday === 6 ? "weekend" : "weekday";
    const whenLabel = `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${HOUR_LABELS[hour]}`;
    const budgetLabel = budget === 0 ? "Free" : budget <= 20 ? "Under $20" : budget <= 40 ? "$20–40" : `Up to $${budget}`;

    onPost({
      id: `mine-${Date.now()}`,
      name: author.name,
      emoji: author.emoji,
      age: author.age ?? 0,
      activityId: activity,
      areaId: effectiveArea,
      areaLabel: typedArea || areaById(area)?.label,
      dateTag,
      whenLabel,
      budgetLabel,
      billLabel: BILL_OPTIONS.find((b) => b.id === bill)?.label,
      groupSize: mode === "friendship" ? groupSize : undefined,
      mode: mode || undefined,
      inviteToken: mode === "invite" ? Math.random().toString(36).slice(2, 10) : undefined,
      note: note.trim() || `${activityById(activity)?.label} in ${areaDisplay}. Come say hi!`,
      likesYouBack: false,
    });
  }

  function advance() {
    if (step < totalSteps - 1) setStep(step + 1);
    else post();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>New plan</h2>
          <button className="closebtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="wizprog">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span key={i} className={i <= step ? "on" : ""} />
          ))}
        </div>

        <div className="modal-body">
          <div className="step wizstep" key={current}>
            {current === "mode" && (
              <>
                <h2>What kind of plan? ✨</h2>
                <p className="sub">Friend and date are always kept separate.</p>
                <div className="cards">
                  {CREATE_MODES.map((m) => (
                    <button key={m.id} className={`choice${mode === m.id ? " sel" : ""}`} onClick={() => setMode(m.id)}>
                      <span className="emoji">{m.emoji}</span>
                      <strong>{m.title}</strong>
                      <small>{m.desc}</small>
                    </button>
                  ))}
                </div>
              </>
            )}

            {current === "groupSize" && (
              <>
                <h2>How many people? 👥</h2>
                <p className="sub">Looking for just one person, or a small group?</p>
                <div className="counter">
                  <button type="button" className="counterbtn" onClick={() => setGroupSize((n) => Math.max(1, n - 1))} disabled={groupSize <= 1} aria-label="Fewer">
                    −
                  </button>
                  <div className="counterval">
                    <strong>{groupSize}</strong>
                    <small>{groupSize === 1 ? "just one person" : `${groupSize} people`}</small>
                  </div>
                  <button type="button" className="counterbtn" onClick={() => setGroupSize((n) => Math.min(8, n + 1))} disabled={groupSize >= 8} aria-label="More">
                    +
                  </button>
                </div>
              </>
            )}

            {current === "activity" && (
              <>
                <h2>What do you want to do? 🎈</h2>
                <p className="sub">Pick the activity for your plan.</p>
                <div className="pickrow">
                  {ACTIVITIES.map((a) => (
                    <button key={a.id} className={`chip${activity === a.id ? " sel" : ""}`} onClick={() => setActivity(a.id)}>
                      {a.emoji} {a.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="helperbtn" style={{ marginTop: 14 }} onClick={onTravel}>
                  ✈️ Travel Together — plan a trip instead
                </button>
              </>
            )}

            {current === "days" && (
              <>
                <h2>When are you free? 📅</h2>
                <p className="sub">Pick the days that work — single days or a range.</p>
                <MonthCalendar selected={days} onChange={setDays} />
              </>
            )}

            {current === "times" && (
              <>
                <h2>What times on those days? ⏰</h2>
                <p className="sub">Tap the hours you’re free for each day.</p>
                <TimeSlotTable days={days} value={slots} onChange={setSlots} />
              </>
            )}

            {current === "area" && (
              <>
                <h2>Where should it be? 📍</h2>
                <p className="sub">Pick an area, or type your own place.</p>
                <div className="pickrow">
                  {AREAS.filter((a) => a.id !== "anywhere").map((a) => (
                    <button
                      key={a.id}
                      className={`chip${!typedArea && area === a.id ? " sel" : ""}`}
                      onClick={() => setArea(a.id)}
                      disabled={!!typedArea}
                    >
                      {a.emoji} {a.label}
                    </button>
                  ))}
                </div>
                <div className="sectionlabel">…or type a neighborhood or address</div>
                <AddressInput value={customArea} onChange={setCustomArea} placeholder="e.g. Williamsburg, Brooklyn" />
                {typedArea && <div className="drawhint">📍 Using “{typedArea}”. Clear the field to pick a preset.</div>}
              </>
            )}

            {current === "budget" && (
              <>
                <h2>Set your budget 💸</h2>
                <p className="sub">Great plans don’t need to cost a fortune.</p>
                <div className="amount">${budget}</div>
                <input className="slider" type="range" min={0} max={200} step={5} value={budget} onChange={(e) => setBudget(Number(e.target.value))} aria-label="Budget" />
                <div className="range">
                  <span>$0</span>
                  <span>$200+</span>
                </div>
                <div className="sectionlabel">Who pays?</div>
                <div className="pickrow">
                  {BILL_OPTIONS.map((b) => (
                    <button key={b.id} className={`chip${bill === b.id ? " sel" : ""}`} onClick={() => setBill(b.id)}>
                      {b.emoji} {b.label}
                    </button>
                  ))}
                </div>
                <div className="sectionlabel">A note (optional)</div>
                <textarea
                  className="custominput"
                  rows={3}
                  placeholder="Say a little about the vibe you're after…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </>
            )}
          </div>
        </div>

        <div className="modal-foot">
          <button className="passbtn" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          <button className="continue" style={{ width: "auto", padding: "14px 26px" }} disabled={!stepValid} onClick={advance}>
            {step === totalSteps - 1 ? "Post plan ✨" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Travel: trip card ---------------- */

function TripCard(props: {
  trip: DemoTrip;
  viewerTrip: DemoTrip | null;
  premium: boolean;
  requested: boolean;
  mine: boolean;
  onPass: () => void;
  onJoin: () => void;
}) {
  const { trip, viewerTrip, premium, requested, mine, onPass, onJoin } = props;
  const comfort = COMFORTS.find((c) => c.id === trip.comfort);
  const withW = WITH_WHOM.find((w) => w.id === trip.withWhom);

  let overlapLabel: string | null = null;
  if (viewerTrip && !mine) {
    const sameDest = viewerTrip.destination.toLowerCase() === trip.destination.toLowerCase();
    if (sameDest && viewerTrip.start && viewerTrip.end && trip.start && trip.end) {
      const o = dateOverlap(viewerTrip.start, viewerTrip.end, trip.start, trip.end);
      const budgetOk = budgetOverlap(
        viewerTrip.budgetMinCents,
        viewerTrip.budgetMaxCents,
        trip.budgetMinCents,
        trip.budgetMaxCents,
      );
      if (o && budgetOk) overlapLabel = formatOverlap(o);
    }
  }

  return (
    <article className="pcard">
      <div className="pcard-top">
        <div className="avatar">{trip.emoji}</div>
        <div className="pcard-id">
          <strong>
            {trip.name}
            {!mine && `, ${trip.age}`}
            {mine && <span className="minetag"> · you</span>}
          </strong>
          <span className="pcard-area">
            ✈️ {trip.destination} · 🗓️ {tripDatesLabel(trip)}
          </span>
        </div>
        <span className="eventbadge">
          {comfort?.emoji} {comfort?.label}
        </span>
      </div>

      <p className="pcard-bio">{trip.note}</p>
      <div className="avail">
        💸 {tripBudgetLabel(trip.budgetMinCents, trip.budgetMaxCents)} · {withW?.emoji} {withW?.label}
      </div>

      <div className="badgerow">
        {overlapLabel && <span className="overlapbadge">🎯 You overlap: {overlapLabel}</span>}
        {trip.lgbtqFriendly && <span className="rainbowbadge">🏳️‍🌈 LGBTQ+ friendly</span>}
        {premium && !mine && trip.likesYouBack && <span className="likesyou">♥ Likes you back</span>}
      </div>

      {!mine && (
        <div className="pcard-actions" style={{ gridTemplateColumns: "1fr 2fr" }}>
          <button className="passbtn" onClick={onPass}>
            Pass
          </button>
          <button className="matchbtn" disabled={requested} onClick={onJoin}>
            {requested ? "Requested ✓" : "I’m in →"}
          </button>
        </div>
      )}
    </article>
  );
}

/* ---------------- Travel: create-trip wizard ---------------- */

const TRIP_MONTHS = [
  { label: "December 2026", start: "2026-12-01", end: "2026-12-31" },
  { label: "January 2027", start: "2027-01-01", end: "2027-01-31" },
  { label: "February 2027", start: "2027-02-01", end: "2027-02-28" },
  { label: "March 2027", start: "2027-03-01", end: "2027-03-31" },
  { label: "Summer 2027", start: "2027-06-01", end: "2027-08-31" },
];
const TRIP_STEPS = 5;

function CreateTripModal({ onClose, onPost }: { onClose: () => void; onPost: (trip: DemoTrip) => void }) {
  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("exact");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [monthIdx, setMonthIdx] = useState(0);
  const [duration, setDuration] = useState(4);
  const [budgetMin, setBudgetMin] = useState(500);
  const [budgetMax, setBudgetMax] = useState(2000);
  const [includes, setIncludes] = useState<string[]>(["Accommodation", "Flights"]);
  const [split, setSplit] = useState("own");
  const [comfort, setComfort] = useState<Comfort | "">("");
  const [withWhom, setWithWhom] = useState<WithWhom | "">("");
  const [note, setNote] = useState("");

  const datesValid =
    (dateMode === "exact" && !!start && !!end && end >= start) ||
    dateMode === "flexible" ||
    dateMode === "unsure";

  const stepValid =
    (step === 0 && destination.trim().length > 2) ||
    (step === 1 && datesValid) ||
    (step === 2 && budgetMax >= budgetMin) ||
    (step === 3 && !!comfort) ||
    (step === 4 && !!withWhom);

  function toggleInclude(x: string) {
    setIncludes((prev) => (prev.includes(x) ? prev.filter((i) => i !== x) : [...prev, x]));
  }
  function setMin(v: number) {
    setBudgetMin(v);
    if (v > budgetMax) setBudgetMax(v);
  }
  function setMax(v: number) {
    setBudgetMax(v);
    if (v < budgetMin) setBudgetMin(v);
  }

  function post() {
    const month = TRIP_MONTHS[monthIdx];
    onPost({
      id: `trip-${Date.now()}`,
      name: TEST_PROFILE.name,
      emoji: TEST_PROFILE.emoji,
      age: TEST_PROFILE.age,
      destination: destination.trim(),
      dateMode,
      start: dateMode === "exact" ? start : dateMode === "flexible" ? month.start : undefined,
      end: dateMode === "exact" ? end : dateMode === "flexible" ? month.end : undefined,
      flexibleLabel: dateMode === "flexible" ? `${month.label} · ${duration} days` : undefined,
      budgetMinCents: budgetMin * 100,
      budgetMaxCents: budgetMax * 100,
      comfort: comfort as Comfort,
      withWhom: withWhom as WithWhom,
      note: note.trim() || `${comfort} trip to ${destination.trim()}. Looking for a good travel partner.`,
      likesYouBack: false,
      mine: true,
    });
  }
  function advance() {
    if (step < TRIP_STEPS - 1) setStep(step + 1);
    else post();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>New trip ✈️</h2>
          <button className="closebtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="wizprog">
          {Array.from({ length: TRIP_STEPS }, (_, i) => (
            <span key={i} className={i <= step ? "on" : ""} />
          ))}
        </div>
        <div className="modal-body">
          <div className="step wizstep" key={step}>
            {step === 0 && (
              <>
                <h2>Where to? 🌍</h2>
                <p className="sub">Type a destination, or pick a suggestion.</p>
                <input
                  className="custominput"
                  placeholder="e.g. Las Vegas, Nevada"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
                <div className="pickrow" style={{ marginTop: 12 }}>
                  {DESTINATION_SUGGESTIONS.map((d) => (
                    <button key={d} className={`chip${destination === d ? " sel" : ""}`} onClick={() => setDestination(d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2>When? 📅</h2>
                <p className="sub">Exact dates, a flexible window, or decide later.</p>
                <div className="pickrow">
                  {([["exact", "Exact dates"], ["flexible", "Flexible"], ["unsure", "Not sure yet"]] as [DateMode, string][]).map(
                    ([id, label]) => (
                      <button key={id} className={`chip${dateMode === id ? " sel" : ""}`} onClick={() => setDateMode(id)}>
                        {label}
                      </button>
                    ),
                  )}
                </div>
                {dateMode === "exact" && (
                  <div className="twocol" style={{ marginTop: 14 }}>
                    <label className="field">
                      <span>Departure</span>
                      <input type="date" className="custominput" value={start} onChange={(e) => setStart(e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Return</span>
                      <input type="date" className="custominput" value={end} onChange={(e) => setEnd(e.target.value)} />
                    </label>
                  </div>
                )}
                {dateMode === "flexible" && (
                  <div className="twocol" style={{ marginTop: 14 }}>
                    <label className="field">
                      <span>Preferred month</span>
                      <select className="custominput" value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}>
                        {TRIP_MONTHS.map((m, i) => (
                          <option key={m.label} value={i}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Trip length (days)</span>
                      <input type="number" min={1} max={30} className="custominput" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                    </label>
                  </div>
                )}
                {dateMode === "unsure" && (
                  <div className="drawhint" style={{ marginTop: 14 }}>
                    No problem — we’ll match you on destination, budget, and style for now.
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h2>Budget 💸</h2>
                <p className="sub">Per person, in USD. This helps find compatible partners.</p>
                <div className="twocol">
                  <div>
                    <div className="sectionlabel">Minimum: ${budgetMin}</div>
                    <input className="slider" type="range" min={0} max={5000} step={100} value={budgetMin} onChange={(e) => setMin(Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="sectionlabel">Maximum: ${budgetMax}</div>
                    <input className="slider" type="range" min={0} max={10000} step={100} value={budgetMax} onChange={(e) => setMax(Number(e.target.value))} />
                  </div>
                </div>
                <div className="sectionlabel">What’s included?</div>
                <div className="pickrow">
                  {INCLUDES.map((x) => (
                    <button key={x} className={`chip${includes.includes(x) ? " sel" : ""}`} onClick={() => toggleInclude(x)}>
                      {x}
                    </button>
                  ))}
                </div>
                <div className="sectionlabel">How do you want to split expenses?</div>
                <div className="pickrow">
                  {SPLIT_OPTIONS.map((s) => (
                    <button key={s.id} className={`chip${split === s.id ? " sel" : ""}`} onClick={() => setSplit(s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2>Travel style 🧳</h2>
                <p className="sub">Pick your comfort level — the rest you can discuss.</p>
                <div className="cards">
                  {COMFORTS.map((c) => (
                    <button key={c.id} className={`choice${comfort === c.id ? " sel" : ""}`} onClick={() => setComfort(c.id)}>
                      <span className="emoji">{c.emoji}</span>
                      <strong>{c.label}</strong>
                      <small>{c.desc}</small>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h2>Who with? 🤝</h2>
                <p className="sub">Friend trips stay friendly — a date is only a date if you both choose it.</p>
                <div className="cards">
                  {WITH_WHOM.map((w) => (
                    <button key={w.id} className={`choice${withWhom === w.id ? " sel" : ""}`} onClick={() => setWithWhom(w.id)}>
                      <span className="emoji">{w.emoji}</span>
                      <strong>{w.label}</strong>
                    </button>
                  ))}
                </div>
                <div className="sectionlabel">Anything else? (optional)</div>
                <textarea
                  className="custominput"
                  rows={3}
                  placeholder="Looking for someone who enjoys new cities, local food, and museums…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="passbtn" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          <button className="continue" style={{ width: "auto", padding: "14px 26px" }} disabled={!stepValid} onClick={advance}>
            {step === TRIP_STEPS - 1 ? "Find travel partners ✈️" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Friends: person row ---------------- */

function PersonRow({ person, children }: { person: Person; children: React.ReactNode }) {
  return (
    <div className="frow">
      <div className="avatar">{person.emoji}</div>
      <div className="frow-id">
        <strong>
          {person.name}, {person.age}
          {person.lgbtqFriendly && <span className="rainbowdot" title="LGBTQ+ friendly"> 🏳️‍🌈</span>}
        </strong>
        <span className="frow-blurb">{person.blurb}</span>
      </div>
      <div className="frow-actions">{children}</div>
    </div>
  );
}

/* ---------------- Meeting card + reschedule ---------------- */

const MEETING_STATE: Record<Meeting["status"], { label: string; cls: string }> = {
  awaiting_them: { label: "Awaiting their confirmation", cls: "pend" },
  awaiting_you: { label: "Waiting for YOU to confirm", cls: "you" },
  confirmed: { label: "Confirmed ✓", cls: "ok" },
  cancelled: { label: "Cancelled", cls: "off" },
  completed: { label: "Completed", cls: "off" },
};

function MeetingCard({
  m,
  onConfirm,
  onCancel,
  onReschedule,
  onIcs,
}: {
  m: Meeting;
  onConfirm: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onIcs: () => void;
}) {
  const st = MEETING_STATE[m.status];
  const dleft = daysUntil(m.date);
  const active = m.status === "awaiting_them" || m.status === "awaiting_you" || m.status === "confirmed";
  return (
    <article className="pcard">
      <div className="pcard-top">
        <div className="avatar">{m.emoji}</div>
        <div className="pcard-id">
          <strong>{m.activityLabel} with {m.withName}</strong>
          <span className="pcard-area">📍 {m.place}</span>
        </div>
        <span className={`meetstate ${st.cls}`}>{st.label}</span>
      </div>

      <div className="meetslot">
        <span className="meetslot-date">🗓️ {dateLabel(m.date)}</span>
        <span className="meetslot-time">⏰ {hourLabel(m.hour)}</span>
      </div>

      {m.status === "confirmed" && dleft >= 0 && (
        <div className="meetremind">
          🔔 Reminder: {dleft === 0 ? "today!" : dleft === 1 ? "tomorrow" : `in ${dleft} days`}
        </div>
      )}
      {m.status === "awaiting_you" && (
        <div className="meetremind you">{m.withName} proposed this time — confirm or suggest another.</div>
      )}

      {active && (
        <div className="pcard-actions" style={{ gridTemplateColumns: m.status === "confirmed" ? "1fr 1fr 1fr" : "1fr 1fr" }}>
          {m.status === "awaiting_you" && (
            <button className="matchbtn" onClick={onConfirm}>
              Confirm
            </button>
          )}
          {m.status === "confirmed" && (
            <button className="likebtn" onClick={onIcs}>
              📅 Add to calendar
            </button>
          )}
          <button className="passbtn" onClick={onReschedule}>
            Reschedule
          </button>
          <button className="passbtn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </article>
  );
}

function RescheduleModal({
  meeting,
  onClose,
  onApply,
}: {
  meeting: Meeting;
  onClose: () => void;
  onApply: (date: string, hour: number, place: string) => void;
}) {
  const [date, setDate] = useState(meeting.date);
  const [hour, setHour] = useState(meeting.hour);
  const [place, setPlace] = useState(meeting.place);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <h2>Propose a new time</h2>
          <button className="closebtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>Date</span>
            <input type="date" className="custominput" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Time</span>
            <select className="custominput" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {Array.from({ length: 14 }, (_, i) => i + 8).map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Place</span>
            <input className="custominput" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Where should you meet?" />
          </label>
          <div className="note">The other person will be notified and must confirm the new time.</div>
        </div>
        <div className="modal-foot">
          <button className="passbtn" onClick={onClose}>Cancel</button>
          <button className="continue" style={{ width: "auto", padding: "14px 26px" }} disabled={!date || !place.trim()} onClick={() => onApply(date, hour, place.trim())}>
            Send new time →
          </button>
        </div>
      </div>
    </div>
  );
}
