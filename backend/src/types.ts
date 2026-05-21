export type SettlementMode = "strict" | "party";
export type EventStatus = "open" | "full" | "settled" | "cancelled";
export type ReservationStatus = "reserved" | "cancelled" | "checked_in_refunded" | "no_show" | "forfeited";

export interface CachedEvent {
  objectId: string;
  hostAddress: string;
  title: string;
  depositAmount: string;
  seatCount: number;
  reservedCount: number;
  checkedInCount: number;
  settlementMode: SettlementMode;
  status: EventStatus;
  updatedDigest: string;
}

export interface CachedReservation {
  objectId: string;
  eventObjectId: string;
  attendeeAddress: string;
  depositAmount: string;
  status: ReservationStatus;
  updatedDigest: string;
}

export interface CachedSettlement {
  objectId: string;
  eventObjectId: string;
  totalReserved: number;
  totalCheckedIn: number;
  totalNoShow: number;
  forfeitedAmount: string;
  distributedAmount: string;
  settledDigest: string;
}

export interface NoFlakeDatabase {
  close(): void;
  getEvent(objectId: string): CachedEvent | undefined;
  getReservationsForEvent(eventObjectId: string): CachedReservation[];
  getReservation(objectId: string): CachedReservation | undefined;
  getSettlementForEvent(eventObjectId: string): CachedSettlement | undefined;
  upsertEvent(event: CachedEvent): void;
  upsertReservation(reservation: CachedReservation): void;
  upsertSettlement(settlement: CachedSettlement): void;
}
