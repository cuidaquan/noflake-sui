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
import { QRCodeSVG } from "qrcode.react";
import type { EventSnapshot, ReservationSnapshot } from "./api/client";
import { fetchEventSnapshot } from "./api/client";
import {
  buildCheckInPayload,
  buildCheckInTransaction,
  buildCreateEventTransaction,
  buildReserveTransaction,
  buildSettleEventTransaction,
  deriveNoShowCount,
  deriveSettlementPreview,
  eventStatusLabel,
  explorerObjectUrl,
  explorerTransactionUrl,
  extractCreatedEventRefs,
  extractReservationId,
  extractSettlementSnapshot,
  formatShortAddress,
  parseCheckInPayload,
  selectReserveCoin,
  reservationStatusLabel,
  settlementModeLabel,
  validateCheckInPayloadForEvent,
  type CoinSnapshot,
  type CheckInPayloadInput,
} from "./sui";

type ViewMode = "host" | "event" | "reservation";
type TxState = "idle" | "building" | "signing" | "success" | "error";

interface CreateEventFormState {
  title: string;
  startLocal: string;
  endLocal: string;
  depositAmount: string;
  seatCount: string;
  settlementMode: "strict" | "party";
}

interface CreatedEventState {
  eventObjectId: string;
  vaultObjectId: string;
  digest: string;
}

interface CheckInDraftState {
  rawPayload: string;
  parsed: CheckInPayloadInput | null;
  reservation: ReservationSnapshot | null;
  error: string;
}

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

const defaultCreateEventForm: CreateEventFormState = {
  title: "Sui Builder Dinner",
  startLocal: "2026-06-01T19:00",
  endLocal: "2026-06-01T22:00",
  depositAmount: "20",
  seatCount: "3",
  settlementMode: "party",
};

export default function App({ dAppKit }: { dAppKit: DAppKit<any> }) {
  const [event, setEvent] = useState(sampleEvent);
  const [viewMode, setViewMode] = useState<ViewMode>("host");
  const [selectedReservationId, setSelectedReservationId] = useState(sampleReservations[1].objectId);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMessage, setTxMessage] = useState("Ready for testnet transactions.");
  const [manualEventId, setManualEventId] = useState("");
  const [createEventForm, setCreateEventForm] = useState<CreateEventFormState>(defaultCreateEventForm);
  const [createdEvent, setCreatedEvent] = useState<CreatedEventState | null>(null);
  const [checkInDraft, setCheckInDraft] = useState<CheckInDraftState>({
    rawPayload: "",
    parsed: null,
    reservation: null,
    error: "Paste a NoFlake check-in QR payload to begin.",
  });
  const [settlementResult, setSettlementResult] = useState<EventSnapshot["settlement"]>(sampleEvent.settlement);

  const account = useCurrentAccount({ dAppKit });
  const currentNetwork = useCurrentNetwork({ dAppKit });
  const currentWallet = useCurrentWallet({ dAppKit });

  useEffect(() => {
    const eventId = new URLSearchParams(window.location.search).get("event");
    if (!eventId) return;

    setManualEventId(eventId);
    void loadEventSnapshot(eventId);
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

  async function loadEventSnapshot(eventId = manualEventId) {
    if (!eventId.trim()) {
      setLoadState("error");
      setTxMessage("Enter an event id before loading.");
      setTxState("error");
      return;
    }

    setLoadState("loading");
    try {
      const snapshot = await fetchEventSnapshot(eventId.trim());
      setEvent(snapshot);
      setSettlementResult(snapshot.settlement);
      setSelectedReservationId(snapshot.reservations[0]?.objectId ?? "");
      setLoadState("idle");
      setTxState("success");
      setTxMessage(`Loaded event ${formatShortAddress(snapshot.objectId)} from backend cache.`);
    } catch {
      setLoadState("error");
      setTxState("error");
      setTxMessage("Backend cache unavailable or event was not found.");
    }
  }

  async function copyText(value: string, label: string) {
    await navigator.clipboard?.writeText(value);
    setTxState("success");
    setTxMessage(`${label} copied.`);
  }

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
      const result = await dAppKit.signAndExecuteTransaction({ transaction });
      const digest =
        result.$kind === "Transaction"
          ? result.Transaction.digest
          : result.FailedTransaction.digest;
      setTxState("success");
      setTxMessage(`${actionLabel}: transaction submitted (${formatShortAddress(digest)}).`);
      return { digest };
    } catch (error) {
      setTxState("error");
      setTxMessage(error instanceof Error ? error.message : `${actionLabel} failed.`);
      return null;
    }
  }

  async function handleCreateEvent() {
    const title = createEventForm.title.trim();
    const depositAmount = Number(createEventForm.depositAmount);
    const seatCount = Number(createEventForm.seatCount);
    const startMs = new Date(createEventForm.startLocal).getTime();
    const endMs = new Date(createEventForm.endLocal).getTime();

    if (!title) {
      setTxState("error");
      setTxMessage("Create event: title is required.");
      return;
    }
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      setTxState("error");
      setTxMessage("Create event: deposit must be greater than zero.");
      return;
    }
    if (!Number.isInteger(seatCount) || seatCount <= 0) {
      setTxState("error");
      setTxMessage("Create event: seat count must be a positive integer.");
      return;
    }
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
      setTxState("error");
      setTxMessage("Create event: start time must be before end time.");
      return;
    }

    const result = await execute(
      buildCreateEventTransaction(txConfig, {
        title,
        startMs,
        endMs,
        depositAmount,
        seatCount,
        settlementMode: createEventForm.settlementMode,
      }),
      "Create event",
    );
    if (!result) return;

    const client = dAppKit.getClient(currentNetwork) as SuiJsonRpcClient;
    const txDetails = await client.getTransactionBlock({
      digest: result.digest,
      options: {
        showEvents: true,
        showObjectChanges: true,
      },
    });

    const refs = extractCreatedEventRefs(txDetails);
    const digest = result.digest;
    if (!refs) {
      setTxState("success");
      setTxMessage("Create event: transaction submitted. Event refs were not found in wallet response yet.");
      setCreatedEvent(null);
      return;
    }

    setCreatedEvent({ ...refs, digest });
    setEvent({
      ...sampleEvent,
      objectId: refs.eventObjectId,
      vaultObjectId: refs.vaultObjectId,
      hostAddress: account?.address ?? sampleEvent.hostAddress,
      title,
      depositAmount: String(depositAmount),
      seatCount,
      reservedCount: 0,
      checkedInCount: 0,
      settlementMode: createEventForm.settlementMode,
      status: "open",
      updatedDigest: digest,
      reservations: [],
      settlement: null,
    });
    setSelectedReservationId("");
    setTxMessage(`Create event: ${formatShortAddress(refs.eventObjectId)} created.`);
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

    const result = await execute(
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
    if (!result) return;

    const txDetails = await client.getTransactionBlock({
      digest: result.digest,
      options: {
        showEvents: true,
        showObjectChanges: true,
      },
    });
    const reservationId = extractReservationId(txDetails);
    if (!reservationId) {
      setTxState("success");
      setTxMessage("Reserve: transaction submitted. Reservation id was not found in RPC response yet.");
      return;
    }

    const reservation: ReservationSnapshot = {
      objectId: reservationId,
      eventObjectId: event.objectId,
      attendeeAddress: account.address,
      depositAmount: event.depositAmount,
      status: "reserved",
      updatedDigest: result.digest,
    };
    setEvent((current) => ({
      ...current,
      reservedCount: Math.min(current.seatCount, current.reservedCount + 1),
      status: current.reservedCount + 1 >= current.seatCount ? "full" : current.status,
      reservations: [reservation, ...current.reservations.filter((item) => item.objectId !== reservation.objectId)],
      updatedDigest: result.digest,
    }));
    setSelectedReservationId(reservation.objectId);
    setViewMode("reservation");
    setTxState("success");
    setTxMessage(`Reserve: reservation ${formatShortAddress(reservation.objectId)} created.`);
  }

  function handleCheckInPayloadChange(rawPayload: string) {
    if (!rawPayload.trim()) {
      setCheckInDraft({
        rawPayload,
        parsed: null,
        reservation: null,
        error: "Paste a NoFlake check-in QR payload to begin.",
      });
      return;
    }

    try {
      const parsed = parseCheckInPayload(rawPayload);
      const precheck = validateCheckInPayloadForEvent(parsed, event);
      if (!precheck.ok) {
        setCheckInDraft({ rawPayload, parsed, reservation: null, error: precheck.reason });
        return;
      }

      setSelectedReservationId(precheck.reservation.objectId);
      setCheckInDraft({ rawPayload, parsed, reservation: precheck.reservation, error: "" });
    } catch (error) {
      setCheckInDraft({
        rawPayload,
        parsed: null,
        reservation: null,
        error: error instanceof Error ? error.message : "QR payload could not be parsed.",
      });
    }
  }

  async function handleCheckIn(reservation: ReservationSnapshot) {
    const result = await execute(
      buildCheckInTransaction(txConfig, {
        eventObjectId: event.objectId,
        vaultObjectId: event.vaultObjectId,
        reservationObjectId: reservation.objectId,
      }),
      "Check in and refund",
    );
    if (!result) return;

    setEvent((current) => ({
      ...current,
      checkedInCount: current.reservations.some((item) => item.objectId === reservation.objectId && item.status === "reserved")
        ? current.checkedInCount + 1
        : current.checkedInCount,
      reservations: current.reservations.map((item) =>
        item.objectId === reservation.objectId
          ? { ...item, status: "checked_in_refunded", updatedDigest: result.digest }
          : item,
      ),
      updatedDigest: result.digest,
    }));
    setCheckInDraft((current) => ({
      ...current,
      reservation: { ...reservation, status: "checked_in_refunded", updatedDigest: result.digest },
      error: "Checked in + refunded.",
    }));
  }

  async function handleSettle() {
    const result = await execute(
      buildSettleEventTransaction(txConfig, {
        eventObjectId: event.objectId,
        vaultObjectId: event.vaultObjectId,
      }),
      "Settle event",
    );
    if (!result) return;

    const client = dAppKit.getClient(currentNetwork) as SuiJsonRpcClient;
    const txDetails = await client.getTransactionBlock({
      digest: result.digest,
      options: {
        showEvents: true,
        showObjectChanges: true,
      },
    });
    const settlement = extractSettlementSnapshot(txDetails, result.digest);
    if (!settlement) {
      setTxState("success");
      setTxMessage("Settle event: transaction submitted. Settlement receipt was not found in RPC response yet.");
      return;
    }

    setSettlementResult(settlement);
    setEvent((current) => ({
      ...current,
      status: "settled",
      settlement,
      updatedDigest: result.digest,
    }));
    setTxState("success");
    setTxMessage(`Settle event: receipt ${formatShortAddress(settlement.objectId)} created.`);
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
        <DemoControlBar
          eventId={manualEventId}
          onEventIdChange={setManualEventId}
          onLoad={() => void loadEventSnapshot()}
          onRefresh={() => void loadEventSnapshot(event.objectId)}
        />

        {viewMode === "host" ? (
          <HostDashboard
            event={event}
            txConfig={txConfig}
            createEventForm={createEventForm}
            createdEvent={createdEvent}
            checkInDraft={checkInDraft}
            onCreateEventFormChange={setCreateEventForm}
            onCheckInPayloadChange={handleCheckInPayloadChange}
            onSelectReservation={setSelectedReservationId}
            onCreateEvent={handleCreateEvent}
            onSettle={handleSettle}
            onCheckIn={handleCheckIn}
            settlementResult={settlementResult}
            onCopy={copyText}
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
  createEventForm,
  createdEvent,
  checkInDraft,
  onCreateEventFormChange,
  onCheckInPayloadChange,
  onSelectReservation,
  onCreateEvent,
  onCheckIn,
  onSettle,
  settlementResult,
  onCopy,
}: {
  event: EventSnapshot;
  txConfig: { packageId: string; coinType: string };
  createEventForm: CreateEventFormState;
  createdEvent: CreatedEventState | null;
  checkInDraft: CheckInDraftState;
  onCreateEventFormChange: (form: CreateEventFormState) => void;
  onCheckInPayloadChange: (rawPayload: string) => void;
  onSelectReservation: (reservationId: string) => void;
  onCreateEvent: () => void;
  onCheckIn: (reservation: ReservationSnapshot) => void;
  onSettle: () => void;
  settlementResult: EventSnapshot["settlement"];
  onCopy: (value: string, label: string) => void;
}) {
  const settlementPreview = deriveSettlementPreview(event);
  const noShowCount = settlementPreview.noShowCount;
  const vaultBalance = settlementPreview.vaultBalance;
  const updateForm = (patch: Partial<CreateEventFormState>) => onCreateEventFormChange({ ...createEventForm, ...patch });

  return (
    <div className="dashboard-grid">
      <section className="control-panel event-builder">
        <PanelTitle icon={<CalendarPlus size={18} />} title="Create event" />
        <div className="form-grid">
          <label>
            Event title
            <input value={createEventForm.title} onChange={(error) => updateForm({ title: error.currentTarget.value })} />
          </label>
          <label>
            Deposit
            <input inputMode="decimal" value={createEventForm.depositAmount} onChange={(error) => updateForm({ depositAmount: error.currentTarget.value })} />
          </label>
          <label>
            Seats
            <input inputMode="numeric" value={createEventForm.seatCount} onChange={(error) => updateForm({ seatCount: error.currentTarget.value })} />
          </label>
          <label>
            Start
            <input type="datetime-local" value={createEventForm.startLocal} onChange={(error) => updateForm({ startLocal: error.currentTarget.value })} />
          </label>
          <label>
            End
            <input type="datetime-local" value={createEventForm.endLocal} onChange={(error) => updateForm({ endLocal: error.currentTarget.value })} />
          </label>
          <label>
            Mode
            <select value={createEventForm.settlementMode} onChange={(error) => updateForm({ settlementMode: error.currentTarget.value as "strict" | "party" })}>
              <option value="strict">Strict</option>
              <option value="party">Party</option>
            </select>
          </label>
        </div>
        <button className="primary-action" onClick={onCreateEvent} disabled={!txConfig.packageId}>
          <Wallet size={18} />
          Create testnet event
        </button>
        {createdEvent ? (
          <div className="object-card">
            <span>Created event</span>
            <strong><a href={explorerObjectUrl(createdEvent.eventObjectId)} target="_blank" rel="noreferrer">{createdEvent.eventObjectId}</a></strong>
            <span>Vault</span>
            <strong><a href={explorerObjectUrl(createdEvent.vaultObjectId)} target="_blank" rel="noreferrer">{createdEvent.vaultObjectId}</a></strong>
            <span>Digest</span>
            <strong><a href={explorerTransactionUrl(createdEvent.digest)} target="_blank" rel="noreferrer">{createdEvent.digest || "submitted"}</a></strong>
            <button className="inline-copy" onClick={() => onCopy(createdEvent.eventObjectId, "Event id")}>Copy event id</button>
          </div>
        ) : null}
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
        <label className="dark-label">
          QR payload
          <textarea
            value={checkInDraft.rawPayload}
            onChange={(event) => onCheckInPayloadChange(event.currentTarget.value)}
            placeholder='{"type":"noflake_check_in","event_id":"0x...","reservation_id":"0x...","attendee":"0x..."}'
          />
        </label>
        <div className="confirm-sheet">
          {checkInDraft.reservation ? (
            <>
              <span>{formatShortAddress(checkInDraft.reservation.attendeeAddress)}</span>
              <strong>Refund {checkInDraft.reservation.depositAmount} USDC immediately</strong>
              <small>{checkInDraft.reservation.objectId}</small>
            </>
          ) : (
            <>
              <span>Waiting for valid payload</span>
              <strong>{checkInDraft.error}</strong>
            </>
          )}
          <button className="primary-action" onClick={() => checkInDraft.reservation ? onCheckIn(checkInDraft.reservation) : undefined} disabled={!checkInDraft.reservation}>
            <BadgeCheck size={18} />
            Confirm check-in & refund
          </button>
        </div>
      </section>

      <section className="control-panel settlement-panel">
        <PanelTitle icon={<RefreshCw size={18} />} title="Settlement" />
        <div className="settlement-preview">
          <div>
            <span>Reserved</span>
            <strong>{event.reservedCount}</strong>
          </div>
          <div>
            <span>Checked in</span>
            <strong>{event.checkedInCount}</strong>
          </div>
          <div>
            <span>No-show</span>
            <strong>{noShowCount}</strong>
          </div>
        </div>
        <div className="settlement-line">
          <span>No-show deposits</span>
          <strong>{vaultBalance} USDC</strong>
        </div>
        <div className="settlement-line">
          <span>Already refunded</span>
          <strong>{settlementPreview.checkedInRefundedAmount} USDC</strong>
        </div>
        <div className="settlement-line">
          <span>Distribution</span>
          <strong>{settlementPreview.distributionLabel}</strong>
        </div>
        <button className="secondary-action" onClick={onSettle} disabled={event.status === "settled"}>
          <RefreshCw size={18} />
          {event.status === "settled" ? "Event settled" : "Settle event"}
        </button>
        {settlementResult ? (
          <div className="object-card settlement-result-card">
            <span>Receipt</span>
            <strong><a href={explorerObjectUrl(settlementResult.objectId)} target="_blank" rel="noreferrer">{settlementResult.objectId}</a></strong>
            <span>Digest</span>
            <strong><a href={explorerTransactionUrl(settlementResult.settledDigest)} target="_blank" rel="noreferrer">{settlementResult.settledDigest}</a></strong>
            <span>No-show</span>
            <strong>{settlementResult.totalNoShow}</strong>
            <span>Forfeited</span>
            <strong>{settlementResult.forfeitedAmount} USDC</strong>
            <span>Distributed</span>
            <strong>{settlementResult.distributedAmount} USDC</strong>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DemoControlBar({
  eventId,
  onEventIdChange,
  onLoad,
  onRefresh,
}: {
  eventId: string;
  onEventIdChange: (eventId: string) => void;
  onLoad: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="demo-control-bar">
      <label>
        Manual event id
        <input value={eventId} onChange={(event) => onEventIdChange(event.currentTarget.value)} placeholder="0x..." />
      </label>
      <button className="secondary-action compact-action" onClick={onLoad}>
        <LinkIcon size={16} />
        Load
      </button>
      <button className="secondary-action compact-action" onClick={onRefresh}>
        <RefreshCw size={16} />
        Refresh current
      </button>
    </section>
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
  const qrPayload = buildCheckInPayload({
    eventObjectId: event.objectId,
    reservationObjectId: reservation.objectId,
    attendeeAddress: reservation.attendeeAddress,
  });

  return (
    <div className="reservation-layout">
      <section className="qr-card">
        <div className="qr-frame">
          <QRCodeSVG value={qrPayload} size={196} level="M" bgColor="#f4f1df" fgColor="#20251f" />
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
          <span>QR payload</span>
          <strong>{qrPayload}</strong>
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
