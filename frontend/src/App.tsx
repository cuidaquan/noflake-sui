export default function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">NoFlake on Sui</p>
        <h1>Programmable RSVP deposit settlement for small events.</h1>
        <p className="copy">
          This is the initial frontend scaffold for the host dashboard and attendee
          reservation flow.
        </p>
      </section>
      <section className="panel-grid">
        <article className="panel">
          <h2>Contracts</h2>
          <p>Event, reservation, vault, and settlement logic will live in Sui Move.</p>
        </article>
        <article className="panel">
          <h2>Frontend</h2>
          <p>Host check-in and attendee reservation flows will be implemented here.</p>
        </article>
      </section>
    </main>
  );
}
