"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MonthCalendar } from "@/components/MonthCalendar";
import { ACTIVITIES, AREAS, TIME_BANDS, type TimeBand } from "@/lib/reference/catalog";
import { buildDateHelper } from "@/lib/dateideas/conversation";

type Mode = "invite" | "friendship" | "dating";

const SESSION_KEY = "bf-demo-session";
const TEST_IDENTITY = { name: "Guest", email: "demo@bothfree.app" };

const MODES: { id: Mode; emoji: string; title: string; desc: string }[] = [
  { id: "invite", emoji: "💌", title: "Invite someone I know", desc: "Make that “we should meet” happen." },
  { id: "friendship", emoji: "🌼", title: "Find a new friend", desc: "Find your people and make plans." },
  { id: "dating", emoji: "💗", title: "Find a date", desc: "Meet someone with shared free time." },
];

const REASON_TEXT: Record<string, string> = {
  no_shared_time: "No shared time with your days yet",
  no_shared_activities: "No activities in common",
  no_shared_area: "Different part of the city",
  no_option_within_budget: "Outside your budget",
};

interface Slot {
  startsAt: string;
  activityLabel: string;
  budgetCeilingCents: number;
  billStatus: string;
}
interface Card {
  id: string;
  name: string;
  emoji: string;
  age: number;
  bio: string;
  availabilityLabel: string;
  areaLabels: string[];
  likesYouBack: boolean;
  hasMatch: boolean;
  reason: string | null;
  sharedActivities: string[];
  sharedActivityIds: string[];
  slots: Slot[];
}
interface Notif {
  id: number;
  emoji: string;
  text: string;
  tone: "match" | "pending";
}

export default function DemoPage() {
  const [session, setSession] = useState<typeof TEST_IDENTITY | null>(null);
  const [ready, setReady] = useState(false);

  // Onboarding state
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode | "">("");
  const [days, setDays] = useState<string[]>([]);
  const [times, setTimes] = useState<TimeBand[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [customs, setCustoms] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [areaId, setAreaId] = useState("");
  const [budget, setBudget] = useState(60);

  // Feed state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [passed, setPassed] = useState<Set<string>>(new Set());

  // Notifications
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);

  // Premium (Test mode) + date helper
  const [premium, setPremium] = useState(false);
  const [helperFor, setHelperFor] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // Login form fields, pre-filled with demo credentials.
  const [email, setEmail] = useState(TEST_IDENTITY.email);
  const [password, setPassword] = useState("bothfree-demo");

  function signIn() {
    const identity = { name: TEST_IDENTITY.name, email: email.trim() || TEST_IDENTITY.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(identity));
    setSession(identity);
  }
  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    restart();
  }

  const totalActivities = presets.length + customs.length;
  const canContinue =
    (step === 0 && !!mode) ||
    (step === 1 && days.length > 0 && times.length > 0) ||
    (step === 2 && totalActivities > 0) ||
    (step === 3 && !!areaId) ||
    step === 4 ||
    step === 5;

  function toggle<T>(list: T[], value: T, setter: (v: T[]) => void, max = 99) {
    if (list.includes(value)) setter(list.filter((x) => x !== value));
    else if (list.length < max) setter([...list, value]);
  }

  function addCustom() {
    const v = customDraft.trim();
    if (v && !customs.includes(v) && customs.length < 3) setCustoms([...customs, v]);
    setCustomDraft("");
  }

  async function loadFeed() {
    setLoading(true);
    setError(null);
    try {
      const activityIds = [...presets, ...customs.map((c) => `custom:${c}`)];
      const res = await fetch("/api/v1/demo/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, days, times, activityIds, areaId, budgetCents: budget * 100 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong.");
        return;
      }
      setCards(data.cards);
      setStep(5);
    } catch {
      setError("Could not reach the discovery service.");
    } finally {
      setLoading(false);
    }
  }

  function advance() {
    if (step === 4) {
      void loadFeed();
      return;
    }
    setStep(step + 1);
  }

  function restart() {
    setStep(0);
    setMode("");
    setDays([]);
    setTimes([]);
    setPresets([]);
    setCustoms([]);
    setAreaId("");
    setBudget(60);
    setCards(null);
    setLiked(new Set());
    setMatched(new Set());
    setPassed(new Set());
  }

  function like(card: Card) {
    setLiked((prev) => {
      const next = new Set(prev);
      next.has(card.id) ? next.delete(card.id) : next.add(card.id);
      return next;
    });
  }
  function pass(card: Card) {
    setPassed((prev) => new Set(prev).add(card.id));
  }
  function sendMatch(card: Card) {
    setMatched((prev) => new Set(prev).add(card.id));
    const notif: Notif = card.likesYouBack
      ? { id: Date.now(), emoji: card.emoji, text: `It’s a match! ${card.name} wants to meet too 🎉`, tone: "match" }
      : { id: Date.now(), emoji: "📨", text: `Match request sent to ${card.name}. We’ll notify you if they match back.`, tone: "pending" };
    setNotifs((prev) => [notif, ...prev]);
    setUnread((u) => u + 1);
  }
  function openBell() {
    setBellOpen((o) => !o);
    if (!bellOpen) setUnread(0);
  }

  const visibleCards = useMemo(
    () => (cards ?? []).filter((c) => !passed.has(c.id)),
    [cards, passed],
  );

  if (!ready) return null;

  // ---- Login ----
  if (!session) {
    return (
      <>
        <DemoHeader />
        <main className="shell">
          <aside className="aside">
            <div className="eyebrow">✳ Welcome back</div>
            <h1>
              Good plans
              <br />
              start when
              <br />
              <em>both are free.</em>
            </h1>
            <p>
              Sign in to pick up where you left off and find your next real-life
              moment.
            </p>
          </aside>
          <section className="app">
            <div className="step">
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
                <div className="footer">
                  <button type="submit" className="continue">
                    Log in →
                  </button>
                  <div className="hint">New here? Create an account</div>
                </div>
              </form>
            </div>
          </section>
        </main>
      </>
    );
  }

  // ---- Discovery feed ----
  if (step === 5) {
    return (
      <>
        <DemoHeader
          session={session}
          onSignOut={signOut}
          unread={unread}
          bellOpen={bellOpen}
          onBell={openBell}
          notifs={notifs}
          premium={premium}
          onTogglePremium={() => setPremium((p) => !p)}
        />
        <main className="feedshell">
          <div className="feedbar">
            <div>
              <h2 className="feedtitle">People who fit your plan</h2>
              <p className="sub">
                {visibleCards.filter((c) => c.hasMatch).length} can meet · computed live from your {days.length}{" "}
                day{days.length === 1 ? "" : "s"}
              </p>
            </div>
            <button className="navbtn" onClick={restart}>
              New search ↻
            </button>
          </div>

          {!premium && (cards ?? []).some((c) => c.likesYouBack) && (
            <button className="upsell" onClick={() => setPremium(true)}>
              ✨ Someone in your feed already likes you — unlock Premium (test) to see who.
            </button>
          )}

          <div className="feed">
            {visibleCards.map((c) => (
              <article className="pcard" key={c.id}>
                <div className="pcard-top">
                  <div className="avatar">{c.emoji}</div>
                  <div className="pcard-id">
                    <strong>
                      {c.name}, {c.age}
                    </strong>
                    <span className="pcard-area">📍 {c.areaLabels.join(" · ")}</span>
                  </div>
                  {c.hasMatch ? (
                    <span className="fitbadge">You both fit</span>
                  ) : (
                    <span className="fitbadge off">{REASON_TEXT[c.reason ?? ""] ?? "No overlap yet"}</span>
                  )}
                </div>

                <p className="pcard-bio">{c.bio}</p>
                <div className="avail">🗓️ {c.availabilityLabel}</div>
                {premium && c.likesYouBack && <div className="likesyou">♥ Likes you back</div>}

                {c.sharedActivities.length > 0 && (
                  <div className="tagrow">
                    {c.sharedActivities.map((a) => (
                      <span className="tag" key={a}>
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                {c.slots.length > 0 && (
                  <div className="slots">
                    {c.slots.map((s, i) => (
                      <div className="slot" key={i}>
                        <b>{formatSlot(s.startsAt)}</b>
                        <span>
                          {s.activityLabel} · up to ${Math.round(s.budgetCeilingCents / 100)}
                          {s.billStatus === "needs_discussion" ? " · split TBD" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pcard-actions">
                  <button className="passbtn" onClick={() => pass(c)}>
                    Pass
                  </button>
                  <button className={`likebtn${liked.has(c.id) ? " on" : ""}`} onClick={() => like(c)}>
                    {liked.has(c.id) ? "♥ Liked" : "♡ Like"}
                  </button>
                  <button
                    className="matchbtn"
                    disabled={!c.hasMatch || matched.has(c.id)}
                    onClick={() => sendMatch(c)}
                  >
                    {matched.has(c.id) ? "Match sent ✓" : "Send match"}
                  </button>
                </div>

                {c.hasMatch && (
                  <>
                    <button
                      className="helperbtn"
                      onClick={() => setHelperFor(helperFor === c.id ? null : c.id)}
                    >
                      💬 Icebreakers & date ideas{premium ? "" : " · Premium"}
                    </button>
                    {helperFor === c.id &&
                      (premium ? (
                        <HelperPanel card={c} mode={(mode || "dating") as Mode} />
                      ) : (
                        <div className="locked">
                          <strong>✨ Premium feature</strong>
                          <p>
                            Get tailored icebreakers and a first-date plan for {c.name}, based on
                            what you share — no AI, just smart suggestions.
                          </p>
                          <button className="matchbtn" onClick={() => setPremium(true)}>
                            Switch to Premium (test)
                          </button>
                        </div>
                      ))}
                  </>
                )}
              </article>
            ))}

            {visibleCards.length === 0 && (
              <div className="note">
                No more profiles. Start a new search with different days, area, or budget.
              </div>
            )}
          </div>
        </main>
      </>
    );
  }

  // ---- Onboarding wizard ----
  return (
    <>
      <DemoHeader
        session={session}
        onSignOut={signOut}
        unread={unread}
        bellOpen={bellOpen}
        onBell={openBell}
        notifs={notifs}
      />
      <main className="shell">
        <aside className="aside">
          <div className="eyebrow">✳ Build your plan</div>
          <h1>
            Tell us when
            <br />
            you’re <em>free.</em>
          </h1>
          <p>
            Pick your days, times, and vibe. Then scroll a feed of people and see
            exactly when you both have time — computed on the server, no AI.
          </p>
        </aside>

        <section className="app">
          <div className="top">
            <button className="back" onClick={() => step > 0 && setStep(step - 1)} aria-label="Previous step">
              ←
            </button>
            <span className="pill">{`STEP ${step + 1} OF 5`}</span>
          </div>
          <div className="progress">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={i <= step ? "on" : ""} />
            ))}
          </div>

          {step === 0 && (
            <div className="step">
              <h2>What brings you here? ✨</h2>
              <p className="sub">Friend and date are always kept separate.</p>
              <div className="cards">
                {MODES.map((m) => (
                  <button key={m.id} className={`choice ${mode === m.id ? "sel" : ""}`} onClick={() => setMode(m.id)}>
                    <span className="emoji">{m.emoji}</span>
                    <strong>{m.title}</strong>
                    <small>{m.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="step">
              <h2>When are you free? 📅</h2>
              <p className="sub">Pick single days or a whole range — any month.</p>
              <MonthCalendar selected={days} onChange={setDays} />
              <div className="sectionlabel">Preferred time of day</div>
              <div className="times">
                {(Object.keys(TIME_BANDS) as TimeBand[]).map((t) => (
                  <button key={t} className={`chip ${times.includes(t) ? "sel" : ""}`} onClick={() => toggle(times, t, setTimes)}>
                    {TIME_BANDS[t].emoji} {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step">
              <h2>What’s your kind of fun? 🎈</h2>
              <p className="sub">Pick what you enjoy, or add your own.</p>
              <div className="cards">
                {ACTIVITIES.map((a) => (
                  <button
                    key={a.id}
                    className={`choice ${presets.includes(a.id) ? "sel" : ""}`}
                    onClick={() => toggle(presets, a.id, setPresets)}
                  >
                    <span className="emoji">{a.emoji}</span>
                    <strong>
                      {a.label}
                      {presets.includes(a.id) ? " ✓" : ""}
                    </strong>
                  </button>
                ))}
              </div>
              <div className="sectionlabel">Add your own</div>
              <div className="customrow">
                <input
                  className="custominput"
                  placeholder="e.g. Pottery class, Sunset picnic…"
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustom()}
                />
                <button className="addbtn" onClick={addCustom} disabled={!customDraft.trim()}>
                  Add
                </button>
              </div>
              {customs.length > 0 && (
                <div className="tagrow">
                  {customs.map((c) => (
                    <span className="tag removable" key={c} onClick={() => setCustoms(customs.filter((x) => x !== c))}>
                      {c} ✕
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="step">
              <h2>Where should we meet? 📍</h2>
              <p className="sub">Choose a preferred New York City area.</p>
              <div className="cards">
                {AREAS.map((a) => (
                  <button key={a.id} className={`choice ${areaId === a.id ? "sel" : ""}`} onClick={() => setAreaId(a.id)}>
                    <span className="emoji">{a.emoji}</span>
                    <strong>{a.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="step">
              <h2>Let’s set your budget 💸</h2>
              <p className="sub">Great moments don’t need to cost a fortune.</p>
              <div className="amount">${budget}</div>
              <div style={{ textAlign: "center", color: "#9aa394", fontSize: 13 }}>per person, per meet-up</div>
              <input
                className="slider"
                type="range"
                min={0}
                max={200}
                step={5}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                aria-label="Budget"
              />
              <div className="range">
                <span>$0</span>
                <span>$200+</span>
              </div>
            </div>
          )}

          {error && <div className="note">{error}</div>}

          <div className="footer">
            <button className="continue" onClick={advance} disabled={!canContinue || loading}>
              {loading ? "Finding people…" : step === 4 ? "Find people ✨" : "Continue →"}
            </button>
            <div className="hint">Signed in as {session.email}</div>
          </div>
        </section>
      </main>
    </>
  );
}

function DemoHeader(props: {
  session?: typeof TEST_IDENTITY;
  onSignOut?: () => void;
  unread?: number;
  bellOpen?: boolean;
  onBell?: () => void;
  notifs?: Notif[];
  premium?: boolean;
  onTogglePremium?: () => void;
}) {
  const { session, onSignOut, unread = 0, bellOpen, onBell, notifs = [], premium, onTogglePremium } = props;
  return (
    <header>
      <div className="logo">
        <Link href="/" style={{ textDecoration: "none" }}>
          both<span className="g">free</span>
          <span className="dot">.</span>
        </Link>
      </div>
      <nav>
        {session && onTogglePremium && (
          <button
            className={`premiumbtn${premium ? " on" : ""}`}
            onClick={onTogglePremium}
            title="Test mode — no real charge"
          >
            {premium ? "★ Premium · test" : "Try Premium (test)"}
          </button>
        )}
        {session && onBell && (
          <div className="bellwrap">
            <button className="bell" onClick={onBell} aria-label="Notifications">
              🔔{unread > 0 && <span className="bellcount">{unread}</span>}
            </button>
            {bellOpen && (
              <div className="notifpanel">
                <strong className="notifhead">Notifications</strong>
                {notifs.length === 0 && <div className="notifempty">Nothing yet — send a match!</div>}
                {notifs.map((n) => (
                  <div className={`notifitem ${n.tone}`} key={n.id}>
                    <span className="notifemoji">{n.emoji}</span>
                    <span>{n.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {session && (
          <button className="navbtn" onClick={onSignOut}>
            Sign out
          </button>
        )}
      </nav>
    </header>
  );
}

function HelperPanel({ card, mode }: { card: Card; mode: Mode }) {
  const helper = useMemo(
    () =>
      buildDateHelper({
        mode,
        otherName: card.name,
        otherAge: card.age,
        areaLabels: card.areaLabels,
        sharedActivityIds: card.sharedActivityIds,
      }),
    [card, mode],
  );
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
        <strong>A good first date</strong>
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

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}
