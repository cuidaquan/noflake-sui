import {
  BadgeCheck,
  CalendarPlus,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  LinkIcon,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useCurrentNetwork, useCurrentWallet } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import type { DAppKit } from "@mysten/dapp-kit-core";
import type { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { EventSnapshot, ReservationSnapshot } from "./api/client";
import { fetchEventSnapshot } from "./api/client";
import {
  buildCheckInTransaction,
  buildCreateEventTransaction,
  buildReserveTransaction,
  buildSettleEventTransaction,
  deriveNoShowCount,
  eventStatusLabel,
  formatShortAddress,
  selectReserveCoin,
  reservationStatusLabel,
  settlementModeLabel,
  type CoinSnapshot,
} from "./sui";

type ViewMode = "host" | "event" | "reservation";
type TxState = "idle" | "building" | "signing" | "success" | "error";

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
  vaultObjectId: "0xvault_9f3a",
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

const packageId = import.meta.env.VITE_NOFLAKE_PACKAGE_ID ?? "";
const coinType =
  import.meta.env.VITE_NOFLAKE_COIN_TYPE ??
  "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

export default function App({ dAppKit }: { dAppKit: DAppKit<any> }) {
  const [event, setEvent] = useState(sampleEvent);
  const [viewMode, setViewMode] = useState<ViewMode>("host");
  const [selectedReservationId, setSelectedReservationId] = useState(sampleReservations[1].objectId);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMessage, setTxMessage] = useState("Ready for testnet transactions.");

  const account = useCurrentAccount({ dAppKit });
  const currentNetwork = useCurrentNetwork({ dAppKit });
  const currentWallet = useCurrentWallet({ dAppKit });

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

  const txConfig = useMemo(
    () => ({
      packageId,
      coinType,
    }),
    [],
  );

  async function execute(transaction: Transaction, actionLabel: string) {
    if (!account) {
      setTxMessage("Connect a wallet first.");
      setTxState("error");
      return;
    }

    if (!packageId) {
      setTxMessage("Set VITE_NOFLAKE_PACKAGE_ID before using transactions.");
      setTxState("error");
      return;
    }

    try {
      setTxState("building");
      setTxMessage(`${actionLabel}: building transaction.`);
      transaction.setSender(account.address);
      setTxState("signing");
      setTxMessage(`${actionLabel}: waiting for wallet signature.`);
      await dAppKit.signAndExecuteTransaction({ transaction });
      setTxState("success");
      setTxMessage(`${actionLabel}: transaction submitted.`);
    } catch (error) {
      setTxState("error");
      setTxMessage(error instanceof Error ? error.message : `${actionLabel} failed.`);
    }
  }

  async function handleReserve() {
    if (!account) {
      setTxMessage("Connect a wallet first.");
      setTxState("error");
      return;
    }

    if (!packageId) {
      setTxMessage("Set VITE_NOFLAKE_PACKAGE_ID before using transactions.");
      setTxState("error");
      return;
    }

    setTxState("building");
    setTxMessage("Reserve: searching for Circle testnet USDC coin.");

    const client = dAppKit.getClient(currentNetwork) as SuiJsonRpcClient;
    const coins = await client.getCoins({
      owner: account.address,
      coinType,
    });

    const reserveCoin = selectReserveCoin(coins.data as CoinSnapshot[], coinType, event.depositAmount);
    if (!reserveCoin) {
      setTxState("error");
      setTxMessage("No usable Circle testnet USDC coin found.");
      return;
    }

    await execute(
      buildReserveTransaction(txConfig, {
        eventObjectId: event.objectId,
        vaultObjectId: event.vaultObjectId,
        depositCoinObjectId: reserveCoin.coinObjectId,
        depositCoinBalance: reserveCoin.balance,
        depositAmount: event.depositAmount,
        attendeeAddress: account.address,
      }),
      "Reserve",
    );
  }

  const noShowCount = deriveNoShowCount(event);
  const vaultBalance = noShowCount * Number(event.depositAmount);

  return (
    <main className="app-shell">
      <aside className="rail">
        <div className="brand-mark" aria-label="NoFlake">
          <img src="/noflake-logo.png" alt="" />
        </div>
        <button className={viewMode === "host" ? "rail-button active" : "rail-button"} onClick={() => setViewMode("host")} title="Host dashboard">
          <ClipboardCheck size={19} />
        </button>
        <button className={viewMode === "event" ? "rail-button active" : "rail-button"} onClick={() => setViewMode("event")} title="Public event page">
          <LinkIcon size={19} />
        </button>
        <button className={viewMode === "reservation" ? "rail-button active" : "rail-button"} onClick={() => setViewMode("reservation")} title="Reservation page">
          <QrCode size={19} />
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">NoFlake on Sui</p>
            <h1>{viewMode === "host" ? "Host operations" : viewMode === "event" ? "Public reservation" : "Attendee check-in"}</h1>
          </div>
          <div className="topbar-actions">
            <div className="network-chip">
              <span />
              Sui testnet
            </div>
            <ConnectButton />
          </div>
        </header>

        {loadState === "error" ? <div className="notice">Backend cache unavailable. Showing demo state.</div> : null}
        {txState !== "idle" ? <div className={`notice notice-${txState}`}>{txMessage}</div> : null}

        <StatusStrip account={account?.address ?? null} walletName={currentWallet?.name ?? null} event={event} />

        {viewMode === "host" ? (
          <HostDashboard
            event={event}
            txConfig={txConfig}
            onSelectReservation={setSelectedReservationId}
            onCreateEvent={() =>
              execute(
                buildCreateEventTransaction(txConfig, {
                  title: event.title,
                  startMs: 1_700_000_000_000,
                  endMs: 1_700_000_360_000,
                  depositAmount: Number(event.depositAmount),
                  seatCount: event.seatCount,
                  settlementMode: event.settlementMode,
                }),
                "Create event",
              )
            }
            onSettle={() =>
              execute(
                buildSettleEventTransaction(txConfig, {
                  eventObjectId: event.objectId,
                  vaultObjectId: event.vaultObjectId,
                }),
                "Settle event",
              )
            }
            onCheckIn={(reservation) =>
              execute(
                buildCheckInTransaction(txConfig, {
                  eventObjectId: event.objectId,
                  vaultObjectId: event.vaultObjectId,
                  reservationObjectId: reservation.objectId,
                }),
                "Check in and refund",
              )
            }
          />
        ) : viewMode === "event" ? (
          <PublicEvent
            event={event}
            onReserve={handleReserve}
          />
        ) : (
          <ReservationPage event={event} reservation={selectedReservation} />
        )}
      </section>
    </main>
  );
}

function StatusStrip({
  account,
  walletName,
  event,
}: {
  account: string | null;
  walletName: string | null;
  event: EventSnapshot;
}) {
  return (
    <section className="status-strip">
      <div>
        <span>Wallet</span>
        <strong>{account ? formatShortAddress(account) : "Not connected"}</strong>
        <p>{walletName ?? "Connect to execute transactions"}</p>
      </div>
      <div>
        <span>Event</span>
        <strong>{eventStatusLabel(event.status)}</strong>
        <p>{settlementModeLabel(event.settlementMode)}</p>
      </div>
      <div>
        <span>Seats</span>
        <strong>
          {event.reservedCount}/{event.seatCount}
        </strong>
        <p>{deriveNoShowCount(event)} no-shows remain in vault</p>
      </div>
    </section>
  );
}

function HostDashboard({
  event,
  txConfig,
  onSelectReservation,
  onCreateEvent,
  onCheckIn,
  onSettle,
}: {
  event: EventSnapshot;
  txConfig: { packageId: string; coinType: string };
  onSelectReservation: (reservationId: string) => void;
  onCreateEvent: () => void;
  onCheckIn: (reservation: ReservationSnapshot) => void;
  onSettle: () => void;
}) {
  const noShowCount = deriveNoShowCount(event);
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
        <button className="primary-action" onClick={onCreateEvent} disabled={!txConfig.packageId}>
          <Wallet size={18} />
          Build create-event transaction
        </button>
      </section>

      <section className="metrics-strip">
        <Metric icon={<BadgeCheck size={18} />} label="Checked in" value={event.checkedInCount} />
        <Metric icon={<CircleDollarSign size={18} />} label="Vault" value={`${vaultBalance} USDC`} />
        <Metric icon={<ShieldCheck size={18} />} label="Mode" value={settlementModeLabel(event.settlementMode)} />
        <Metric icon={<Copy size={18} />} label="Package" value={txConfig.packageId ? formatShortAddress(txConfig.packageId) : "unset"} />
      </section>

      <section className="control-panel reservation-list">
        <PanelTitle icon={<ClipboardCheck size={18} />} title="Reservations" />
        <div className="table">
          {event.reservations.map((reservation) => (
            <button key={reservation.objectId} className="table-row" onClick={() => onSelectReservation(reservation.objectId)}>
              <span>{formatShortAddress(reservation.attendeeAddress)}</span>
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
          <span>{formatShortAddress(event.reservations[1]?.attendeeAddress ?? "")}</span>
          <strong>Refund {event.depositAmount} USDC immediately</strong>
          <button className="primary-action" onClick={() => onCheckIn(event.reservations[1] ?? event.reservations[0])}>
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
        <button className="secondary-action" onClick={onSettle}>
          <RefreshCw size={18} />
          Build settle transaction
        </button>
      </section>
    </div>
  );
}

function PublicEvent({ event, onReserve }: { event: EventSnapshot; onReserve: () => void }) {
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
          {settlementModeLabel(event.settlementMode)} settlement
        </div>
        <button className="primary-action" onClick={onReserve}>
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

function StatusPill({ status }: { status: ReservationSnapshot["status"] }) {
  return <span className={`status-pill ${status}`}>{reservationStatusLabel(status)}</span>;
}
