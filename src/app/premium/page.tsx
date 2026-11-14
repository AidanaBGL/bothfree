import Link from "next/link";

export default function PremiumPage() {
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
            Try the demo ↗
          </Link>
        </nav>
      </header>
      <main className="shell">
        <aside className="aside">
          <div className="eyebrow">✳ Premium</div>
          <h1>
            More ways
            <br />
            to <em>connect.</em>
          </h1>
          <p>
            Free covers inviting people you know, finding friends, and planning real
            meet-ups. Premium adds advanced dating tools — safety never depends on
            payment.
          </p>
        </aside>
        <section className="app">
          <div className="step">
            <h2>BothFree Premium</h2>
            <p className="sub">$14.99 / month · billed through Stripe</p>
            <div className="summary">
              <div className="summaryline">
                <span>See who liked you</span>
                <b>Premium</b>
              </div>
              <div className="summaryline">
                <span>Advanced dating filters</span>
                <b>Premium</b>
              </div>
              <div className="summaryline">
                <span>Invites, friends & planning</span>
                <b>Free</b>
              </div>
              <div className="summaryline">
                <span>Blocking, reporting & safety</span>
                <b>Always free</b>
              </div>
            </div>
            <div className="note">
              Test mode: payments are enabled only after full Stripe test integration.
              No purchase is simulated as a successful charge.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
