import Link from "next/link";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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
          <p>
            You’ve received a BothFree invitation. Join to see the proposed times
            and confirm a plan that works for both of you.
          </p>
          <Link className="cta" href="/demo">
            Respond to the invite →
          </Link>
        </aside>
        <section className="app">
          <div className="step">
            <h2>Invitation</h2>
            <p className="sub">Reference: {token}</p>
            <div className="summary">
              <div className="summaryline">
                <span>From</span>
                <b>A BothFree member</b>
              </div>
              <div className="summaryline">
                <span>Status</span>
                <b>Waiting for your response</b>
              </div>
              <div className="summaryline">
                <span>What you’ll do</span>
                <b>Pick times that work → confirm</b>
              </div>
            </div>
            <div className="note">
              Demo invite: this link is illustrative. In the full product it opens
              the real plan and lets you respond without revealing the organizer’s
              full schedule.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
