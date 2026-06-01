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

const apiBaseUrl = import.meta.env.VITE_NOFLAKE_API_URL ?? "http://127.0.0.1:8787";

export async function fetchEventSnapshot(eventId: string): Promise<EventSnapshot> {
  const response = await fetch(`${apiBaseUrl}/events/${eventId}`);
  if (!response.ok) {
    throw new Error(`Event ${eventId} was not found`);
  }

  return (await response.json()) as EventSnapshot;
}

export async function fetchReservationSnapshot(reservationId: string): Promise<ReservationSnapshot> {
  const response = await fetch(`${apiBaseUrl}/reservations/${reservationId}`);
  if (!response.ok) {
    throw new Error(`Reservation ${reservationId} was not found`);
  }

  return (await response.json()) as ReservationSnapshot;
}
