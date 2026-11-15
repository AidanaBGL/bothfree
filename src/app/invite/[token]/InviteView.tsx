"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getInvitePlan } from "@/lib/data/store";
import { activityById, areaById } from "@/lib/reference/catalog";
import type { DemoPlan } from "@/lib/demo/plans";

type State = { status: "loading" } | { status: "found"; plan: DemoPlan } | { status: "missing" };

export function InviteView({ token }: { token: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getInvitePlan(token).then((plan) => {
      if (!active) return;
      setState(plan ? { status: "found", plan } : { status: "missing" });
    });
    return () => {
      active = false;
    };
  }, [token]);

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
          <Link className="navbtn" href="/demo">
            Open BothFree ↗
          </Link>
        </nav>
      </header>

      <main className="shell">
        <aside className="aside">
          <div className="eyebrow">✳ You’re invited</div>
          <h1>
            Someone wants
            <br />
            to <em>make a plan</em>
            <br />
            with you.
          </h1>
          <p>Join to see the proposed time and confirm a plan that works for both of you.</p>
          <Link className="cta" href="/demo">
            Respond to the invite →
          </Link>
        </aside>

        <section className="app">
          {state.status === "loading" && (
            <div className="step">
              <h2>Loading invitation…</h2>
              <div className="availskeleton">
                <div className="skelrow" />
                <div className="skelrow" />
              </div>
            </div>
          )}

          {state.status === "missing" && (
            <div className="step">
              <h2>Invitation not found</h2>
              <p className="sub">This invite link is invalid or has expired.</p>
              <div className="note">
                If you think this is a mistake, ask the person to send you a fresh link, or open BothFree and
                sign in.
              </div>
            </div>
          )}

          {state.status === "found" && (
            <div className="step">
              <h2>Your invitation 💌</h2>
              <p className="sub">
                From <b>{state.plan.name}</b>
              </p>
              <div className="summary">
                <div className="summaryline">
                  <span>Activity</span>
                  <b>
                    {activityById(state.plan.activityId)?.emoji} {activityById(state.plan.activityId)?.label ?? state.plan.activityId}
                  </b>
                </div>
                <div className="summaryline">
                  <span>Where</span>
                  <b>{state.plan.areaLabel ?? areaById(state.plan.areaId)?.label ?? "—"}</b>
                </div>
                <div className="summaryline">
                  <span>When</span>
                  <b>{state.plan.whenLabel}</b>
                </div>
                {state.plan.budgetLabel && (
                  <div className="summaryline">
                    <span>Budget</span>
                    <b>{state.plan.budgetLabel}</b>
                  </div>
                )}
                {state.plan.billLabel && (
                  <div className="summaryline">
                    <span>Who pays</span>
                    <b>{state.plan.billLabel}</b>
                  </div>
                )}
              </div>
              {state.plan.note && <p className="pcard-bio" style={{ marginTop: 14 }}>“{state.plan.note}”</p>}
              <div className="footer">
                <Link className="continue" href="/demo" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                  Sign in to respond →
                </Link>
                <div className="hint">You’ll confirm a time once you join.</div>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
