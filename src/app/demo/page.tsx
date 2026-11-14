"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ACTIVITIES, AREAS, TIME_BANDS, type TimeBand } from "@/lib/reference/catalog";

type Mode = "invite" | "friendship" | "dating";

const MODES: { id: Mode; emoji: string; title: string; desc: string }[] = [
  { id: "invite", emoji: "💌", title: "Invite someone I know", desc: "Make that “we should meet” happen." },
  { id: "friendship", emoji: "🌼", title: "Find a new friend", desc: "Find your people and make plans." },
  { id: "dating", emoji: "💗", title: "Find a date", desc: "Meet someone with shared free time." },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const REASON_TEXT: Record<string, string> = {
  no_shared_time: "No shared time — try adding more days or time bands.",
  no_shared_activities: "No shared activities — pick something Alex also enjoys.",
  no_shared_area: "No shared area — Alex meets in Manhattan or Brooklyn.",
  no_option_within_budget: "No option within budget — nudge your budget up a little.",
};

interface Proposal {
  startsAt: string;
  endsAt: string;
  activityLabel: string;
  budgetCeilingCents: number;
  billStatus: string;
}
interface MatchResponse {
  reason: string | null;
  proposals: Proposal[];
  partner: { displayName: string };
}

export default function DemoPage() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode | "">("");
  const [days, setDays] = useState<string[]>([]);
  const [times, setTimes] = useState<TimeBand[]>([]);
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [areaId, setAreaId] = useState("");
  const [budget, setBudget] = useState(60);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);
  const dateKey = (d: Date) => d.toISOString().slice(0, 10);

  function toggle<T>(list: T[], value: T, setter: (v: T[]) => void, max = 99) {
    if (list.includes(value)) setter(list.filter((x) => x !== value));
    else if (list.length < max) setter([...list, value]);
  }

  const canContinue =
    (step === 0 && !!mode) ||
    (step === 1 && days.length > 0 && times.length > 0) ||
    (step === 2 && activityIds.length > 0) ||
    (step === 3 && !!areaId) ||
    step === 4 ||
    step === 5;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/demo/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          days,
          times,
          activityIds,
          areaId,
          budgetCents: budget * 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong.");
        return;
      }
      setResult(data);
      setStep(5);
    } catch {
      setError("Could not reach the matching service.");
    } finally {
      setLoading(false);
    }
  }

  function advance() {
    if (step === 4) {
      void submit();
      return;
    }
    if (step === 5) {
      restart();
      return;
    }
    setStep(step + 1);
  }

  function restart() {
    setStep(0);
    setMode("");
    setDays([]);
    setTimes([]);
    setActivityIds([]);
    setAreaId("");
    setBudget(60);
    setResult(null);
    setError(null);
  }

  return (
    <>
      <header>
        <div className="logo">
          <Link href="/" style={{ textDecoration: "none" }}>
            both<span className="g">free</span>
            <span className="dot">.</span>
          </Link>
        </div>
        <nav>
          <button className="navbtn" onClick={restart}>
            Start over ↗
          </button>
        </nav>
      </header>

      <main className="shell">
        <aside className="aside">
          <div className="eyebrow">✳ Interactive demo</div>
          <h1>
            Your next
            <br />
            real-life moment
            <br />
            <em>starts here.</em>
          </h1>
          <p>
            Make your choices and BothFree’s server computes a real plan against a
            seeded partner, Alex. No account, no AI — just overlapping free time.
          </p>
        </aside>

        <section className="app">
          <div className="top">
            <button className="back" onClick={() => step > 0 && setStep(step - 1)} aria-label="Previous step">
              ←
            </button>
            <span className="pill">{step === 5 ? "YOUR PLAN" : `STEP ${Math.min(step + 1, 5)} OF 5`}</span>
          </div>
          <div className="progress">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={i <= step ? "on" : ""} />
            ))}
          </div>

          {step === 0 && (
            <div className="step">
              <h2>What brings you here? ✨</h2>
              <p className="sub">Choose how you’d like to connect.</p>
              <div className="cards">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`choice ${mode === m.id ? "sel" : ""}`}
                    onClick={() => setMode(m.id)}
                  >
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
              <p className="sub">Pick a few days and the times that work for you.</p>
              <div className="sectionlabel">Your next 7 days</div>
              <div className="days">
                {next7.map((d) => {
                  const key = dateKey(d);
                  return (
                    <button
                      key={key}
                      className={`day ${days.includes(key) ? "sel" : ""}`}
                      onClick={() => toggle(days, key, setDays)}
                    >
                      {WEEKDAYS[(d.getDay() + 6) % 7]}
                      <b>{d.getDate()}</b>
                    </button>
                  );
                })}
              </div>
              <div className="sectionlabel">Preferred time of day</div>
              <div className="times">
                {(Object.keys(TIME_BANDS) as TimeBand[]).map((t) => (
                  <button
                    key={t}
                    className={`chip ${times.includes(t) ? "sel" : ""}`}
                    onClick={() => toggle(times, t, setTimes)}
                  >
                    {TIME_BANDS[t].emoji} {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step">
              <h2>What’s your kind of fun? 🎈</h2>
              <p className="sub">Pick up to 3 activities. {activityIds.length}/3 selected.</p>
              <div className="cards">
                {ACTIVITIES.map((a) => (
                  <button
                    key={a.id}
                    className={`choice ${activityIds.includes(a.id) ? "sel" : ""}`}
                    onClick={() => toggle(activityIds, a.id, setActivityIds, 3)}
                  >
                    <span className="emoji">{a.emoji}</span>
                    <strong>
                      {a.label}
                      {activityIds.includes(a.id) ? " ✓" : ""}
                    </strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step">
              <h2>Where should we meet? 📍</h2>
              <p className="sub">Choose a preferred New York City area.</p>
              <div className="cards">
                {AREAS.map((a) => (
                  <button
                    key={a.id}
                    className={`choice ${areaId === a.id ? "sel" : ""}`}
                    onClick={() => setAreaId(a.id)}
                  >
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

          {step === 5 && result && (
            <div className="step success">
              <div className="mascot">{result.proposals.length > 0 ? "🌷" : "🤔"}</div>
              {result.proposals.length > 0 ? (
                <>
                  <h2>You and {result.partner.displayName} can meet!</h2>
                  <p>The server found these real options from your overlapping time.</p>
                  <div className="summary">
                    {result.proposals.map((p, i) => (
                      <div className="summaryline" key={i}>
                        <span>{p.activityLabel}</span>
                        <b>
                          {formatSlot(p.startsAt)} · up to ${Math.round(p.budgetCeilingCents / 100)}
                          {p.billStatus === "needs_discussion" ? " · split TBD" : ""}
                        </b>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2>No shared option yet</h2>
                  <p>{REASON_TEXT[result.reason ?? ""] ?? "Try adjusting your choices."}</p>
                </>
              )}
              <div className="note">
                Demo only: this computes against a seeded partner and does not create
                accounts or save plans to a server.
              </div>
            </div>
          )}

          {error && <div className="note">{error}</div>}

          <div className="footer">
            <button className="continue" onClick={advance} disabled={!canContinue || loading}>
              {loading
                ? "Computing…"
                : step === 5
                  ? "Create another plan ↻"
                  : step === 4
                    ? "Build my plan ✨"
                    : "Continue →"}
            </button>
            <div className="hint">Interactive concept preview · No account needed</div>
          </div>
        </section>
      </main>
    </>
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
