import {
  BadgeCheck,
  CalendarPlus,
  CircleDollarSign,
  ClipboardCheck,
  LinkIcon,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { EventSnapshot, ReservationSnapshot, SettlementMode } from "./api/client";
import { fetchEventSnapshot } from "./api/client";

const sampleReservations: ReservationSnapshot[] = [
  {
    objectId: "0xres_a71c",
    eventObjectId: "0xevent_9f3a",
    attendeeAddress: "0x8f7d...4a12",
    depositAmount: "20",
    status: "checked_in_refunded",
    updatedDigest: "9Tn...a2",
  },
  {
    objectId: "0xres_c25e",
    eventObjectId: "0xevent_9f3a",
    attendeeAddress: "0x2a91...b771",
    depositAmount: "20",
    status: "reserved",
    updatedDigest: "7Rc...91",
  },
  {
    objectId: "0xres_e940",
    eventObjectId: "0xevent_9f3a",
    attendeeAddress: "0x55b2...90ec",
    depositAmount: "20",
    status: "reserved",
    updatedDigest: "4Lm...d8",
  },
];

const sampleEvent: EventSnapshot = {
  objectId: "0xevent_9f3a",
  hostAddress: "0xhost...dinner",
  title: "Sui Builder Dinner",
  depositAmount: "20",
  seatCount: 3,
  reservedCount: 3,
  checkedInCount: 1,
  settlementMode: "party",
  status: "open",
  updatedDigest: "F8x...21",
  reservations: sampleReservations,
  settlement: null,
};

export default function App() {
  const [event, setEvent] = useState<EventSnapshot>(sampleEvent);
  const [activeView, setActiveView] = useState<"host" | "event" | "reservation">("host");
  const [selectedReservationId, setSelectedReservationId] = useState(sampleReservations[1].objectId);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const eventId = new URLSearchParams(window.location.search).get("event");
    if (!eventId) return;

    setLoadState("loading");
    fetchEventSnapshot(eventId)
      .then((snapshot) => {
        setEvent(snapshot);
        setSelectedReservationId(snapshot.reservations[0]?.objectId ?? "");
        setLoadState("idle");
      })
      .catch(() => setLoadState("error"));
  }, []);

  const selectedReservation =
    event.reservations.find((reservation) => reservation.objectId === selectedReservationId) ??
    event.reservations[0];

  return (
    <main className="app-shell">
      <aside className="rail">
        <div className="brand-mark">NF</div>
        <button className={activeView === "host" ? "rail-button active" : "rail-button"} onClick={() => setActiveView("host")} title="Host dashboard">
          <ClipboardCheck size={19} />
        </button>
        <button className={activeView === "event" ? "rail-button active" : "rail-button"} onClick={() => setActiveView("event")} title="Public event page">
          <LinkIcon size={19} />
        </button>
        <button className={activeView === "reservation" ? "rail-button active" : "rail-button"} onClick={() => setActiveView("reservation")} title="Reservation page">
          <QrCode size={19} />
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">NoFlake on Sui</p>
            <h1>{activeView === "host" ? "Host operations" : activeView === "event" ? "Public reservation" : "Attendee check-in"}</h1>
          </div>
          <div className="network-chip">
            <span />
            Sui testnet
          </div>
        </header>

        {loadState === "error" ? <div className="notice">Backend cache unavailable. Showing demo state.</div> : null}

        {activeView === "host" ? (
          <HostDashboard event={event} onSelectReservation={setSelectedReservationId} />
        ) : activeView === "event" ? (
          <PublicEvent event={event} />
        ) : (
          <ReservationPage event={event} reservation={selectedReservation} />
        )}
      </section>
    </main>
  );
}

function HostDashboard({
  event,
  onSelectReservation,
}: {
  event: EventSnapshot;
  onSelectReservation: (reservationId: string) => void;
}) {
  const noShowCount = event.reservedCount - event.checkedInCount;
  const vaultBalance = noShowCount * Number(event.depositAmount);

  return (
    <div className="dashboard-grid">
      <section className="control-panel event-builder">
        <PanelTitle icon={<CalendarPlus size={18} />} title="Create event" />
        <div className="form-grid">
          <label>
            Event title
            <input value={event.title} readOnly />
          </label>
          <label>
            Deposit
            <input value={`${event.depositAmount} USDC`} readOnly />
          </label>
          <label>
            Seats
            <input value={event.seatCount} readOnly />
          </label>
          <label>
            Mode
            <select value={event.settlementMode} disabled>
              <option value="strict">Strict</option>
              <option value="party">Party</option>
            </select>
          </label>
        </div>
        <button className="primary-action">
          <Wallet size={18} />
          Build create-event transaction
        </button>
      </section>

      <section className="metrics-strip">
        <Metric icon={<Users size={18} />} label="Reserved" value={`${event.reservedCount}/${event.seatCount}`} />
        <Metric icon={<BadgeCheck size={18} />} label="Checked in" value={event.checkedInCount} />
        <Metric icon={<CircleDollarSign size={18} />} label="Vault" value={`${vaultBalance} USDC`} />
        <Metric icon={<ShieldCheck size={18} />} label="Mode" value={modeLabel(event.settlementMode)} />
      </section>

      <section className="control-panel reservation-list">
        <PanelTitle icon={<Users size={18} />} title="Reservations" />
        <div className="table">
          {event.reservations.map((reservation) => (
            <button key={reservation.objectId} className="table-row" onClick={() => onSelectReservation(reservation.objectId)}>
              <span>{reservation.attendeeAddress}</span>
              <span>{reservation.depositAmount} USDC</span>
              <StatusPill status={reservation.status} />
            </button>
          ))}
        </div>
      </section>

      <section className="control-panel checkin-console">
        <PanelTitle icon={<ScanLine size={18} />} title="Check-in mode" />
        <div className="scanner">
          <ScanLine size={52} />
          <div className="scan-bars" />
        </div>
        <div className="confirm-sheet">
          <span>0x2a91...b771</span>
          <strong>Refund {event.depositAmount} USDC immediately</strong>
          <button className="primary-action">
            <BadgeCheck size={18} />
            Confirm check-in & refund
          </button>
        </div>
      </section>

      <section className="control-panel settlement-panel">
        <PanelTitle icon={<RefreshCw size={18} />} title="Settlement" />
        <div className="settlement-line">
          <span>No-show deposits</span>
          <strong>{vaultBalance} USDC</strong>
        </div>
        <div className="settlement-line">
          <span>Distribution</span>
          <strong>{event.settlementMode === "party" ? "Checked-in attendees" : "Host"}</strong>
        </div>
        <button className="secondary-action">
          <RefreshCw size={18} />
          Build settle transaction
        </button>
      </section>
    </div>
  );
}

function PublicEvent({ event }: { event: EventSnapshot }) {
  return (
    <div className="public-layout">
      <section className="event-ticket">
        <p className="eyebrow">Open RSVP</p>
        <h2>{event.title}</h2>
        <div className="ticket-rule">
          <CircleDollarSign size={18} />
          {event.depositAmount} USDC refundable deposit
        </div>
        <div className="ticket-rule">
          <ShieldCheck size={18} />
          {modeLabel(event.settlementMode)} settlement
        </div>
        <button className="primary-action">
          <Wallet size={18} />
          Reserve with deposit
        </button>
      </section>
      <section className="capacity-board">
        <span>{event.reservedCount}</span>
        <p>reserved seats</p>
        <div className="seat-grid">
          {Array.from({ length: event.seatCount }).map((_, index) => (
            <i key={index} className={index < event.reservedCount ? "seat filled" : "seat"} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ReservationPage({ event, reservation }: { event: EventSnapshot; reservation: ReservationSnapshot }) {
  return (
    <div className="reservation-layout">
      <section className="qr-card">
        <div className="qr-grid">
          {Array.from({ length: 49 }).map((_, index) => (
            <span key={index} className={(index * 7 + 3) % 5 === 0 ? "dark" : ""} />
          ))}
        </div>
        <p>{reservation.objectId}</p>
      </section>
      <section className="control-panel reservation-detail">
        <PanelTitle icon={<QrCode size={18} />} title="Reservation" />
        <h2>{event.title}</h2>
        <StatusPill status={reservation.status} />
        <div className="detail-list">
          <span>Attendee</span>
          <strong>{reservation.attendeeAddress}</strong>
          <span>Deposit</span>
          <strong>{reservation.depositAmount} USDC</strong>
          <span>Refund rule</span>
          <strong>Check-in returns deposit immediately</strong>
        </div>
      </section>
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="panel-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${status}`}>{status.replace(/_/g, " ")}</span>;
}

function modeLabel(mode: SettlementMode) {
  return mode === "party" ? "Party Mode" : "Strict Mode";
}
