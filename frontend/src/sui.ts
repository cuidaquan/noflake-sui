import { Transaction } from "@mysten/sui/transactions";

export type SettlementMode = "strict" | "party";
export type EventStatus = "open" | "full" | "settled" | "cancelled";
export type ReservationStatus = "reserved" | "cancelled" | "checked_in_refunded" | "no_show" | "forfeited";

export interface ReservationSnapshot {
  objectId: string;
  eventObjectId: string;
  attendeeAddress: string;
  depositAmount: string;
  status: ReservationStatus;
  updatedDigest: string;
}

export interface CoinSnapshot {
  coinObjectId: string;
  coinType: string;
  balance: string;
  digest: string;
  version: string;
}

export interface SettlementSnapshot {
  objectId: string;
  eventObjectId: string;
  totalReserved: number;
  totalCheckedIn: number;
  totalNoShow: number;
  forfeitedAmount: string;
  distributedAmount: string;
  settledDigest: string;
}

export interface EventSnapshot {
  objectId: string;
  vaultObjectId: string;
  hostAddress: string;
  title: string;
  startMs: number;
  endMs: number;
  depositAmount: string;
  seatCount: number;
  reservedCount: number;
  checkedInCount: number;
  settlementMode: SettlementMode;
  status: EventStatus;
  updatedDigest: string;
  reservations: ReservationSnapshot[];
  settlement: SettlementSnapshot | null;
}

export interface NoFlakeTxConfig {
  packageId: string;
  coinType: string;
  gasBudget?: number;
}

export interface CreatedEventRefs {
  eventObjectId: string;
  vaultObjectId: string;
}

export interface TransactionResultLike {
  events?: Array<{
    type?: string;
    parsedJson?: unknown;
  }>;
  objectChanges?: Array<{
    type?: string;
    objectId?: string;
    objectType?: string;
    owner?: unknown;
  }>;
}

export interface CheckInPayloadInput {
  eventObjectId: string;
  reservationObjectId: string;
  attendeeAddress: string;
}

export type CheckInPrecheckResult =
  | { ok: true; reservation: ReservationSnapshot }
  | { ok: false; reason: string };

export type SettleEventPrecheckResult = { ok: true } | { ok: false; reason: string };

export interface SettlementPreview {
  noShowCount: number;
  vaultBalance: string;
  distributionLabel: string;
  checkedInRefundedAmount: string;
}

const SUI_CLOCK_OBJECT_ID = "0x6";

const DEFAULT_GAS_BUDGET = 100_000_000;
export const USDC_DECIMALS = 6;
const USDC_SCALE = 10n ** BigInt(USDC_DECIMALS);
const INVALID_USDC_AMOUNT_MESSAGE = "Enter a valid USDC amount with up to 6 decimal places.";

export function parseUsdcAmountToAtomicUnits(displayAmount: string): string {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(displayAmount.trim());
  if (!match) throw new Error(INVALID_USDC_AMOUNT_MESSAGE);

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(USDC_DECIMALS, "0"));
  const atomicAmount = whole * USDC_SCALE + fraction;
  if (atomicAmount <= 0n) throw new Error(INVALID_USDC_AMOUNT_MESSAGE);
  return atomicAmount.toString();
}

export function formatUsdcAmountFromAtomicUnits(atomicAmount: string | bigint | number): string {
  const amount = BigInt(atomicAmount);
  const whole = amount / USDC_SCALE;
  const fraction = (amount % USDC_SCALE).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function buildDefaultCreateEventTimes(now = new Date()): { startLocal: string; endLocal: string } {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 3);
  return { startLocal: formatDateTimeLocal(start), endLocal: formatDateTimeLocal(end) };
}

export function settlementModeLabel(mode: SettlementMode): string {
  return mode === "party" ? "Party Mode" : "Strict Mode";
}

export function eventStatusLabel(status: EventStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "full":
      return "Full";
    case "settled":
      return "Settled";
    case "cancelled":
      return "Cancelled";
  }
}

export function explorerObjectUrl(objectId: string, network = "testnet"): string {
  return `https://suiexplorer.com/object/${objectId}?network=${network}`;
}

export function explorerTransactionUrl(digest: string, network = "testnet"): string {
  return `https://suiexplorer.com/txblock/${digest}?network=${network}`;
}

export function reservationStatusLabel(status: ReservationStatus): string {
  return status.replace(/_/g, " ");
}

export function buildCreateEventTransaction(
  config: NoFlakeTxConfig,
  input: {
    title: string;
    startMs: bigint | number;
    endMs: bigint | number;
    depositAmount: bigint | number | string;
    seatCount: bigint | number;
    settlementMode: SettlementMode;
  },
): Transaction {
  const tx = new Transaction();
  tx.setGasBudget(config.gasBudget ?? DEFAULT_GAS_BUDGET);
  tx.moveCall({
    package: config.packageId,
    module: "noflake",
    function: "create_event",
    typeArguments: [config.coinType],
    arguments: [
      tx.pure.string(input.title),
      tx.pure.u64(input.startMs),
      tx.pure.u64(input.endMs),
      tx.pure.u64(input.depositAmount),
      tx.pure.u64(input.seatCount),
      tx.pure.u8(input.settlementMode === "party" ? 1 : 0),
    ],
  });
  return tx;
}

export function extractCreatedEventRefs(result: TransactionResultLike | unknown): CreatedEventRefs | null {
  const data = transactionResultLike(result);
  if (!data) return null;

  for (const event of data.events ?? []) {
    if (!event.type?.endsWith("::noflake::EventCreated")) continue;
    const parsed = event.parsedJson;
    if (!parsed || typeof parsed !== "object") continue;

    const data = parsed as Record<string, unknown>;
    const eventObjectId = stringValue(data.event_id);
    const vaultObjectId = stringValue(data.vault_id);
    if (eventObjectId && vaultObjectId) {
      return { eventObjectId, vaultObjectId };
    }
  }

  let eventObjectId = "";
  let vaultObjectId = "";
  for (const change of data.objectChanges ?? []) {
    if (change.type !== "created" || !change.objectId || !change.objectType) continue;
    if (change.objectType.endsWith("::noflake::Event")) {
      eventObjectId = change.objectId;
    }
    if (change.objectType.includes("::noflake::EventVault<")) {
      vaultObjectId = change.objectId;
    }
  }

  return eventObjectId && vaultObjectId ? { eventObjectId, vaultObjectId } : null;
}

export function extractReservationId(result: TransactionResultLike | unknown): string | null {
  const data = transactionResultLike(result);
  if (!data) return null;

  for (const event of data.events ?? []) {
    if (!event.type?.endsWith("::noflake::ReservationCreated")) continue;
    const parsed = event.parsedJson;
    if (!parsed || typeof parsed !== "object") continue;

    const reservationId = stringValue((parsed as Record<string, unknown>).reservation_id);
    if (reservationId) return reservationId;
  }

  for (const change of data.objectChanges ?? []) {
    if (change.type === "created" && change.objectType?.endsWith("::noflake::Reservation") && change.objectId) {
      return change.objectId;
    }
  }

  return null;
}

export function extractSettlementSnapshot(result: TransactionResultLike | unknown, settledDigest: string): SettlementSnapshot | null {
  const data = transactionResultLike(result);
  if (!data) return null;

  for (const event of data.events ?? []) {
    if (!event.type?.endsWith("::noflake::EventSettled")) continue;
    const parsed = event.parsedJson;
    if (!parsed || typeof parsed !== "object") continue;

    const eventData = parsed as Record<string, unknown>;
    const objectId = stringValue(eventData.receipt_id);
    const eventObjectId = stringValue(eventData.event_id);
    if (!objectId || !eventObjectId) return null;

    return {
      objectId,
      eventObjectId,
      totalReserved: numberValue(eventData.total_reserved),
      totalCheckedIn: numberValue(eventData.total_checked_in),
      totalNoShow: numberValue(eventData.total_no_show),
      forfeitedAmount: stringField(eventData.forfeited_amount),
      distributedAmount: stringField(eventData.distributed_amount),
      settledDigest,
    };
  }

  return null;
}

export function buildCheckInPayload(input: CheckInPayloadInput): string {
  return JSON.stringify({
    type: "noflake_check_in",
    event_id: input.eventObjectId,
    reservation_id: input.reservationObjectId,
    attendee: input.attendeeAddress,
  });
}

export function parseCheckInPayload(payload: string): CheckInPayloadInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("QR payload is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("QR payload is not a NoFlake check-in payload.");
  }

  const data = parsed as Record<string, unknown>;
  if (data.type !== "noflake_check_in") {
    throw new Error("QR payload is not a NoFlake check-in payload.");
  }

  const eventObjectId = stringValue(data.event_id);
  const reservationObjectId = stringValue(data.reservation_id);
  const attendeeAddress = stringValue(data.attendee);
  if (!eventObjectId || !reservationObjectId || !attendeeAddress) {
    throw new Error("QR payload is missing required fields.");
  }

  return { eventObjectId, reservationObjectId, attendeeAddress };
}

export function validateCheckInPayloadForEvent(payload: CheckInPayloadInput, event: EventSnapshot): CheckInPrecheckResult {
  if (payload.eventObjectId !== event.objectId) {
    return { ok: false, reason: "QR payload belongs to a different event." };
  }

  const reservation = event.reservations.find((item) => item.objectId === payload.reservationObjectId);
  if (!reservation) {
    return { ok: false, reason: "Reservation was not found in the current event cache." };
  }

  if (reservation.attendeeAddress !== payload.attendeeAddress) {
    return { ok: false, reason: "QR attendee does not match the reservation attendee." };
  }

  if (reservation.status !== "reserved") {
    return { ok: false, reason: `Reservation is ${reservationStatusLabel(reservation.status)}, not reserved.` };
  }

  if (event.status !== "open" && event.status !== "full") {
    return { ok: false, reason: `Event is ${eventStatusLabel(event.status)}, so check-in is closed.` };
  }

  return { ok: true, reservation };
}

export function buildReserveTransaction(
  config: NoFlakeTxConfig,
  input: {
    eventObjectId: string;
    vaultObjectId: string;
    depositCoinObjectId: string;
    depositCoinBalance: bigint | number | string;
    depositAmount: bigint | number | string;
    attendeeAddress: string;
  },
): Transaction {
  const tx = new Transaction();
  tx.setGasBudget(config.gasBudget ?? DEFAULT_GAS_BUDGET);

  const depositAmount = BigInt(input.depositAmount);
  const depositCoinBalance = BigInt(input.depositCoinBalance);
  if (depositCoinBalance < depositAmount) {
    throw new Error("Deposit coin balance is lower than the required deposit amount.");
  }

  const depositCoin =
    depositCoinBalance === depositAmount
      ? tx.object(input.depositCoinObjectId)
      : tx.splitCoins(tx.object(input.depositCoinObjectId), [input.depositAmount])[0];

  tx.moveCall({
    package: config.packageId,
    module: "noflake",
    function: "reserve",
    typeArguments: [config.coinType],
    arguments: [
      tx.object(input.eventObjectId),
      tx.object(input.vaultObjectId),
      depositCoin,
    ],
  });
  return tx;
}

export function buildCheckInTransaction(
  config: NoFlakeTxConfig,
  input: {
    eventObjectId: string;
    vaultObjectId: string;
    reservationObjectId: string;
  },
): Transaction {
  const tx = new Transaction();
  tx.setGasBudget(config.gasBudget ?? DEFAULT_GAS_BUDGET);
  tx.moveCall({
    package: config.packageId,
    module: "noflake",
    function: "check_in",
    typeArguments: [config.coinType],
    arguments: [
      tx.object(input.eventObjectId),
      tx.object(input.vaultObjectId),
      tx.object(input.reservationObjectId),
    ],
  });
  return tx;
}

export function buildSettleEventTransaction(
  config: NoFlakeTxConfig,
  input: {
    eventObjectId: string;
    vaultObjectId: string;
  },
): Transaction {
  const tx = new Transaction();
  tx.setGasBudget(config.gasBudget ?? DEFAULT_GAS_BUDGET);
  tx.moveCall({
    package: config.packageId,
    module: "noflake",
    function: "settle_event",
    typeArguments: [config.coinType],
    arguments: [tx.object(input.eventObjectId), tx.object(input.vaultObjectId), tx.object(SUI_CLOCK_OBJECT_ID)],
  });
  return tx;
}

export function canSettleEvent(event: Pick<EventSnapshot, "endMs">, nowMs = Date.now()): SettleEventPrecheckResult {
  if (nowMs < event.endMs) {
    return { ok: false, reason: "Settle event: wait until the event end time." };
  }
  return { ok: true };
}

export function formatShortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

export function deriveNoShowCount(event: EventSnapshot): number {
  return Math.max(0, event.reservedCount - event.checkedInCount);
}

export function deriveSeatSummary(event: EventSnapshot): string {
  const noShowCount = deriveNoShowCount(event);
  const noShowLabel = noShowCount === 1 ? "no-show" : "no-shows";
  if (event.status === "settled") {
    return `${noShowCount} ${noShowLabel} settled`;
  }
  return `${noShowCount} ${noShowLabel} remain in vault`;
}

export function deriveSettlementPreview(event: EventSnapshot): SettlementPreview {
  const noShowCount = event.status === "settled" && event.settlement ? event.settlement.totalNoShow : deriveNoShowCount(event);
  const depositAmount = BigInt(event.depositAmount);
  const vaultBalance = event.status === "settled" ? 0n : BigInt(noShowCount) * depositAmount;
  return {
    noShowCount,
    vaultBalance: formatUsdcAmountFromAtomicUnits(vaultBalance),
    distributionLabel: event.settlementMode === "party" ? "Checked-in attendees" : "Host",
    checkedInRefundedAmount: formatUsdcAmountFromAtomicUnits(BigInt(event.checkedInCount) * depositAmount),
  };
}

export function selectReserveCoin(coins: CoinSnapshot[], coinType: string, depositAmount: bigint | number | string): CoinSnapshot | null {
  const required = BigInt(depositAmount);
  return (
    coins
      .filter((coin) => coin.coinType === coinType && BigInt(coin.balance) >= required)
      .sort((left, right) => BigInt(left.balance) > BigInt(right.balance) ? 1 : -1)[0] ?? null
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "0");
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function formatDateTimeLocal(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function transactionResultLike(value: unknown): TransactionResultLike | null {
  if (!value || typeof value !== "object") return null;
  const data = value as TransactionResultLike;
  return Array.isArray(data.events) || Array.isArray(data.objectChanges) ? data : null;
}
