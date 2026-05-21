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

const DEFAULT_GAS_BUDGET = 100_000_000;

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

export function reservationStatusLabel(status: ReservationStatus): string {
  return status.replace(/_/g, " ");
}

export function buildCreateEventTransaction(
  config: NoFlakeTxConfig,
  input: {
    title: string;
    startMs: bigint | number;
    endMs: bigint | number;
    depositAmount: bigint | number;
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

export function buildReserveTransaction(
  config: NoFlakeTxConfig,
  input: {
    eventObjectId: string;
    vaultObjectId: string;
    depositCoinObjectId: string;
  },
): Transaction {
  const tx = new Transaction();
  tx.setGasBudget(config.gasBudget ?? DEFAULT_GAS_BUDGET);
  tx.moveCall({
    package: config.packageId,
    module: "noflake",
    function: "reserve",
    typeArguments: [config.coinType],
    arguments: [
      tx.object(input.eventObjectId),
      tx.object(input.vaultObjectId),
      tx.object(input.depositCoinObjectId),
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
    arguments: [tx.object(input.eventObjectId), tx.object(input.vaultObjectId)],
  });
  return tx;
}

export function formatShortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

export function deriveNoShowCount(event: EventSnapshot): number {
  return Math.max(0, event.reservedCount - event.checkedInCount);
}

export function selectReserveCoin(coins: CoinSnapshot[], coinType: string, depositAmount: bigint | number | string): CoinSnapshot | null {
  const required = BigInt(depositAmount);
  return (
    coins
      .filter((coin) => coin.coinType === coinType && BigInt(coin.balance) >= required)
      .sort((left, right) => BigInt(left.balance) > BigInt(right.balance) ? 1 : -1)[0] ?? null
  );
}
