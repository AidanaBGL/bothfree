import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <header>
        <div className="logo">
          both<span className="g">free</span>
          <span className="dot">.</span>
        </div>
        <nav>
          <a href="#how">How it works</a>
          <Link href="/premium">Premium</Link>
          <Link className="navbtn" href="/demo">
            Try the demo ↗
          </Link>
        </nav>
      </header>

      <main className="shell">
        <aside className="aside">
          <div className="eyebrow">✳ More life, less planning</div>
          <h1>
            Good plans
            <br />
            start when
            <br />
            <em>both are free.</em>
          </h1>
          <p>
            Meet up with someone you know, find a new friend, or make space for a
            date. BothFree finds the overlap in your free time, interests, area,
            and budget — then turns it into a plan on the calendar.
          </p>
          <Link className="cta" href="/demo">
            Start a plan ✨
          </Link>
        </aside>

        <section className="app" id="how">
          <div className="top">
            <span className="pill">NO AI · DETERMINISTIC MATCHING</span>
          </div>
          <div className="step">
            <h2>Three ways to connect</h2>
            <p className="sub">Pick the intent — friend and date are always kept separate.</p>
            <div className="cards">
              <div className="choice">
                <span className="emoji">💌</span>
                <strong>Invite someone I know</strong>
                <small>Make that “we should meet” actually happen.</small>
              </div>
              <div className="choice">
                <span className="emoji">🌼</span>
                <strong>Find a new friend</strong>
                <small>Find your people and make plans.</small>
              </div>
              <div className="choice">
                <span className="emoji">💗</span>
                <strong>Find a date</strong>
                <small>Meet someone with shared free time.</small>
              </div>
              <div className="choice">
                <span className="emoji">📅</span>
                <strong>Land it on the calendar</strong>
                <small>Agree on one option, export an .ics invite.</small>
              </div>
            </div>
            <div className="note">
              The server really computes time, area, activity, and budget overlap —
              no fixtures. Try the interactive demo without creating an account.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
