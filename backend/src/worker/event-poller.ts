import type { NoFlakeDatabase } from "../types";
import type { SuiEvent, SuiEventClient } from "../sui-client";

export interface EventPollerOptions {
  client: SuiEventClient;
  db: NoFlakeDatabase;
  packageId: string;
}

export async function pollNoFlakeEvents({ client, db, packageId }: EventPollerOptions): Promise<number> {
  if (!packageId) {
    return 0;
  }

  const eventTypes = [
    "EventCreated",
    "ReservationCreated",
    "ReservationCancelled",
    "CheckedInAndRefunded",
    "EventSettled",
  ];

  let processed = 0;
  for (const eventName of eventTypes) {
    const result = await client.queryEvents({
      query: { MoveEventType: `${packageId}::noflake::${eventName}` },
      limit: 50,
      order: "ascending",
    });

    for (const event of result.data) {
      processed += applyEvent(db, event);
    }
  }

  return processed;
}

function applyEvent(db: NoFlakeDatabase, event: SuiEvent): number {
  const parsed = event.parsedJson;
  if (!parsed || typeof parsed !== "object") {
    return 0;
  }

  const data = parsed as Record<string, unknown>;
  const type = event.type.split("::").at(-1);
  const digest = event.id.txDigest;

  if (type === "ReservationCreated") {
    db.upsertReservation({
      objectId: stringField(data, "reservation_id"),
      eventObjectId: stringField(data, "event_id"),
      attendeeAddress: stringField(data, "attendee"),
      depositAmount: stringField(data, "deposit_amount"),
      status: "reserved",
      updatedDigest: digest,
    });
    return 1;
  }

  if (type === "ReservationCancelled") {
    const reservationId = stringField(data, "reservation_id");
    const existing = db.getReservation(reservationId);
    if (!existing) return 0;
    db.upsertReservation({ ...existing, status: "cancelled", updatedDigest: digest });
    return 1;
  }

  if (type === "CheckedInAndRefunded") {
    const reservationId = stringField(data, "reservation_id");
    const existing = db.getReservation(reservationId);
    if (!existing) return 0;
    db.upsertReservation({ ...existing, status: "checked_in_refunded", updatedDigest: digest });
    return 1;
  }

  if (type === "EventSettled") {
    db.upsertSettlement({
      objectId: stringField(data, "receipt_id"),
      eventObjectId: stringField(data, "event_id"),
      totalReserved: numberField(data, "total_reserved"),
      totalCheckedIn: numberField(data, "total_checked_in"),
      totalNoShow: numberField(data, "total_no_show"),
      forfeitedAmount: stringField(data, "forfeited_amount"),
      distributedAmount: stringField(data, "distributed_amount"),
      settledDigest: digest,
    });
    return 1;
  }

  return 0;
}

function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : String(value ?? "");
}

function numberField(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}
