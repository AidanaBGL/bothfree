"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MonthCalendar } from "@/components/MonthCalendar";
import { TimeSlotTable } from "@/components/TimeSlotTable";
import { ACTIVITIES, AREAS, activityById, areaById } from "@/lib/reference/catalog";
import { buildDateHelper } from "@/lib/dateideas/conversation";
import { DEMO_PLANS, TEST_PROFILE, type DemoPlan, type DateTag } from "@/lib/demo/plans";

const SESSION_KEY = "bf-demo-session";
const TEST_IDENTITY = { name: TEST_PROFILE.name, email: "demo@bothfree.app" };

type View = "feed" | "plans" | "profile";

interface Notif {
  id: number;
  emoji: string;
  text: string;
  tone: "match" | "pending";
}

export default function DemoPage() {
  const [session, setSession] = useState<typeof TEST_IDENTITY | null>(null);
  const [ready, setReady] = useState(false);

  // Login fields, pre-filled with demo credentials.
  const [email, setEmail] = useState(TEST_IDENTITY.email);
  const [password, setPassword] = useState("bothfree-demo");

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

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function signIn() {
    const identity = { name: TEST_IDENTITY.name, email: email.trim() || TEST_IDENTITY.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(identity));
    setSession(identity);
  }
  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setView("feed");
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
  function joinPlan(plan: DemoPlan) {
    setRequested((prev) => new Set(prev).add(plan.id));
    if (plan.likesYouBack) {
      addNotif({ emoji: plan.emoji, text: `It’s a match! ${plan.name} is in for ${activityById(plan.activityId)?.label ?? "the plan"} 🎉`, tone: "match" });
    } else {
      addNotif({ emoji: "📨", text: `Request sent to ${plan.name}. We’ll let you know if they’re in.`, tone: "pending" });
    }
  }

  const allPlans = useMemo(() => [...myPlans, ...DEMO_PLANS], [myPlans]);
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
          <div className="authcard">
            <h2>Sign in</h2>
            <p className="sub">Enter your details to continue.</p>
            <form
              className="loginform"
              onSubmit={(e) => {
                e.preventDefault();
                signIn();
              }}
            >
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  className="custominput"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  className="custominput"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" className="continue">
                Log in →
              </button>
              <div className="hint">New here? Create an account</div>
            </form>
          </div>
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

        <button className="newplan" onClick={() => setCreateOpen(true)}>
          <span className="plus">+</span> New plan
        </button>

        <nav className="navgroup">
          {([
            ["feed", "🧭", "Discover"],
            ["plans", "🗂️", "My plans"],
            ["profile", "🧑", "Profile"],
          ] as [View, string, string][]).map(([v, icon, label]) => (
            <button key={v} className={`navitem${view === v ? " active" : ""}`} onClick={() => setView(v)}>
              <span className="navicon">{icon}</span>
              {label}
              {v === "plans" && myPlans.length > 0 && <span className="navbadge">{myPlans.length}</span>}
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
        {view === "feed" && (
          <>
            <div className="contenthead">
              <div>
                <h1 className="pagetitle">Discover plans</h1>
                <p className="sub">People posting when and where they want to meet.</p>
              </div>
              <button className="newplan compact" onClick={() => setCreateOpen(true)}>
                <span className="plus">+</span> New plan
              </button>
            </div>

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
                  mine={myPlans.some((m) => m.id === p.id)}
                  onLike={() => like(p.id)}
                  onPass={() => setPassed((prev) => new Set(prev).add(p.id))}
                  onJoin={() => joinPlan(p)}
                  onToggleHelper={() => setHelperFor(helperFor === p.id ? null : p.id)}
                  onUpgrade={() => setPremium(true)}
                />
              ))}
              {visiblePlans.length === 0 && (
                <div className="note">No plans match these filters. Try widening them, or post your own.</div>
              )}
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
              {myPlans.length === 0 && (
                <div className="emptybox">
                  <div className="emptyemoji">🗓️</div>
                  <h3>No plans yet</h3>
                  <p>Post your first plan and people who fit can ask to join.</p>
                  <button className="continue" style={{ maxWidth: 220 }} onClick={() => setCreateOpen(true)}>
                    + Create a plan
                  </button>
                </div>
              )}
              {myPlans.map((p) => (
                <PlanCard key={p.id} plan={p} premium={premium} liked={false} requested mine onLike={() => {}} onPass={() => {}} onJoin={() => {}} helperOpen={false} onToggleHelper={() => {}} onUpgrade={() => {}} />
              ))}
            </div>
          </>
        )}

        {view === "profile" && <ProfileView />}
      </main>

      {createOpen && (
        <CreatePlanModal
          onClose={() => setCreateOpen(false)}
          onPost={(plan) => {
            setMyPlans((prev) => [plan, ...prev]);
            setCreateOpen(false);
            setView("plans");
            addNotif({ emoji: "✅", text: "Your plan is live. People who fit can now ask to join.", tone: "match" });
          }}
        />
      )}
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
}) {
  const { plan, premium, liked, requested, mine, helperOpen, onLike, onPass, onJoin, onToggleHelper, onUpgrade } = props;
  const activity = activityById(plan.activityId);
  const area = areaById(plan.areaId);

  return (
    <article className="pcard">
      <div className="pcard-top">
        <div className="avatar">{plan.emoji}</div>
        <div className="pcard-id">
          <strong>
            {plan.name}
            {!mine && `, ${plan.age}`}
            {mine && <span className="minetag"> · you</span>}
          </strong>
          <span className="pcard-area">
            📍 {area?.label ?? plan.areaId} · 🗓️ {plan.whenLabel}
          </span>
        </div>
        <span className="eventbadge">
          {activity?.emoji} {activity?.label}
        </span>
      </div>

      <p className="pcard-bio">{plan.note}</p>
      <div className="avail">💸 {plan.budgetLabel}</div>
      {premium && !mine && plan.likesYouBack && <div className="likesyou">♥ Likes you back</div>}

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

/* ---------------- Profile ---------------- */

function ProfileView() {
  const p = TEST_PROFILE;
  return (
    <>
      <div className="contenthead">
        <h1 className="pagetitle">Profile</h1>
      </div>
      <div className="profilecard">
        <div className="profiletop">
          <div className="avatar big">{p.emoji}</div>
          <div>
            <h2 className="profilename">
              {p.name}, {p.age}
            </h2>
            <div className="pcard-area">📍 {p.city} · {areaById(p.areaId)?.label}</div>
          </div>
          <span className="eventbadge">Verified · demo</span>
        </div>
        <p className="pcard-bio">{p.bio}</p>
        <div className="sectionlabel">Interests</div>
        <div className="tagrow">
          {p.interestIds.map((id) => (
            <span className="tag" key={id}>
              {activityById(id)?.emoji} {activityById(id)?.label}
            </span>
          ))}
        </div>
        <div className="summary">
          <div className="summaryline">
            <span>City</span>
            <b>{p.city}</b>
          </div>
          <div className="summaryline">
            <span>Preferred area</span>
            <b>{areaById(p.areaId)?.label}</b>
          </div>
          <div className="summaryline">
            <span>Email</span>
            <b>{TEST_IDENTITY.email}</b>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Create plan modal ---------------- */

const HOUR_LABELS: Record<number, string> = {};
for (let h = 0; h < 24; h++) {
  const period = h < 12 ? "AM" : "PM";
  const base = h % 12 === 0 ? 12 : h % 12;
  HOUR_LABELS[h] = `${base}:00 ${period}`;
}

function CreatePlanModal({ onClose, onPost }: { onClose: () => void; onPost: (plan: DemoPlan) => void }) {
  const [activity, setActivity] = useState("");
  const [area, setArea] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<string, number[]>>({});
  const [budget, setBudget] = useState(40);
  const [note, setNote] = useState("");

  const hasSlot = Object.values(slots).some((hrs) => hrs.length > 0);
  const canPost = !!activity && !!area && days.length > 0 && hasSlot;

  function post() {
    // Earliest selected day that has a slot, and its earliest hour.
    const dayWithSlot = days.filter((d) => (slots[d] ?? []).length > 0).sort()[0];
    const hour = Math.min(...(slots[dayWithSlot] ?? [9]));
    const d = new Date(`${dayWithSlot}T00:00:00`);
    const weekday = d.getDay();
    const dateTag: DateTag = weekday === 0 || weekday === 6 ? "weekend" : "weekday";
    const whenLabel = `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${HOUR_LABELS[hour]}`;
    const budgetLabel = budget === 0 ? "Free" : budget <= 20 ? "Under $20" : budget <= 40 ? "$20–40" : `Up to $${budget}`;

    onPost({
      id: `mine-${Date.now()}`,
      name: TEST_PROFILE.name,
      emoji: TEST_PROFILE.emoji,
      age: TEST_PROFILE.age,
      activityId: activity,
      areaId: area,
      dateTag,
      whenLabel,
      budgetLabel,
      note: note.trim() || `${activityById(activity)?.label} in ${areaById(area)?.label}. Come say hi!`,
      likesYouBack: false,
    });
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
        <div className="modal-body">
          <div className="sectionlabel">What do you want to do?</div>
          <div className="pickrow">
            {ACTIVITIES.map((a) => (
              <button key={a.id} className={`chip${activity === a.id ? " sel" : ""}`} onClick={() => setActivity(a.id)}>
                {a.emoji} {a.label}
              </button>
            ))}
          </div>

          <div className="sectionlabel">Where?</div>
          <div className="pickrow">
            {AREAS.filter((a) => a.id !== "anywhere").map((a) => (
              <button key={a.id} className={`chip${area === a.id ? " sel" : ""}`} onClick={() => setArea(a.id)}>
                {a.emoji} {a.label}
              </button>
            ))}
          </div>
          <div className="drawhint">🗺️ Draw your own area on the map — coming next.</div>

          <div className="sectionlabel">Which days?</div>
          <MonthCalendar selected={days} onChange={setDays} />

          <div className="sectionlabel">Pick times for each day</div>
          <TimeSlotTable days={days} value={slots} onChange={setSlots} />

          <div className="sectionlabel">Budget per person</div>
          <div className="amount">${budget}</div>
          <input className="slider" type="range" min={0} max={200} step={5} value={budget} onChange={(e) => setBudget(Number(e.target.value))} aria-label="Budget" />

          <div className="sectionlabel">A note (optional)</div>
          <textarea
            className="custominput"
            rows={3}
            placeholder="Say a little about the vibe you're after…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="modal-foot">
          <button className="passbtn" onClick={onClose}>
            Cancel
          </button>
          <button className="continue" style={{ width: "auto", padding: "14px 26px" }} disabled={!canPost} onClick={post}>
            Post plan ✨
          </button>
        </div>
      </div>
    </div>
  );
}
