import type { NoFlakeDatabase } from "../types";
import type { SuiEvent, SuiEventClient } from "../sui-client";

const EVENT_PAGE_SIZE = 50;
const MAX_PAGES_PER_POLL = 20;

export interface EventPollerOptions {
  client: SuiEventClient;
  db: NoFlakeDatabase;
  packageId: string;
}

export interface EventPollerLoopOptions extends EventPollerOptions {
  intervalMs: number;
  log?: {
    error(error: unknown): void;
    info(message: string): void;
  };
}

export interface EventPollerLoop {
  stop(): void;
}

export function startNoFlakeEventPoller(options: EventPollerLoopOptions): EventPollerLoop {
  if (!options.packageId) {
    options.log?.info("NoFlake event poller disabled: NOFLAKE_PACKAGE_ID is not set.");
    return { stop() {} };
  }

  let stopped = false;
  let running = false;
  let timer: NodeJS.Timeout | undefined;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const processed = await pollNoFlakeEvents(options);
      if (processed > 0) {
        options.log?.info(`NoFlake event poller processed ${processed} events.`);
      }
    } catch (error) {
      options.log?.error(error);
    } finally {
      running = false;
      if (!stopped) {
        timer = setTimeout(tick, options.intervalMs);
      }
    }
  };

  void tick();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
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
  let pagesProcessed = 0;
  for (const eventName of eventTypes) {
    const cursorKey = `${packageId}:${eventName}`;
    let cursor = db.getEventCursor(cursorKey) ?? null;
    while (pagesProcessed < MAX_PAGES_PER_POLL) {
      const result = await client.queryEvents({
        query: { MoveEventType: `${packageId}::noflake::${eventName}` },
        cursor,
        limit: EVENT_PAGE_SIZE,
        order: "ascending",
      });
      pagesProcessed += 1;

      for (const event of result.data) {
        const eventKey = `${event.id.txDigest}:${event.id.eventSeq}`;
        if (db.hasProcessedEvent(eventKey)) {
          continue;
        }

        const applied = applyEvent(db, event);
        if (applied > 0) {
          db.markProcessedEvent(eventKey);
          processed += applied;
        }
      }

      if (result.nextCursor) {
        db.setEventCursor(cursorKey, result.nextCursor);
        cursor = result.nextCursor;
      }

      if (!result.hasNextPage || !result.nextCursor) break;
    }

    if (pagesProcessed >= MAX_PAGES_PER_POLL) break;
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
    const eventObjectId = stringField(data, "event_id");
    db.upsertReservation({
      objectId: stringField(data, "reservation_id"),
      eventObjectId,
      attendeeAddress: stringField(data, "attendee"),
      depositAmount: stringField(data, "deposit_amount"),
      status: "reserved",
      updatedDigest: digest,
    });
    updateEvent(db, eventObjectId, digest, (event) => ({
      ...event,
      reservedCount: Math.min(event.seatCount, event.reservedCount + 1),
      status: event.reservedCount + 1 >= event.seatCount ? "full" : event.status,
      updatedDigest: digest,
    }));
    return 1;
  }

  if (type === "EventCreated") {
    db.upsertEvent({
      objectId: stringField(data, "event_id"),
      vaultObjectId: stringField(data, "vault_id"),
      hostAddress: stringField(data, "host"),
      title: stringField(data, "title"),
      startMs: numberField(data, "start_ms"),
      endMs: numberField(data, "end_ms"),
      depositAmount: stringField(data, "deposit_amount"),
      seatCount: numberField(data, "seat_count"),
      reservedCount: 0,
      checkedInCount: 0,
      settlementMode: numberField(data, "settlement_mode") === 1 ? "party" : "strict",
      status: "open",
      updatedDigest: digest,
    });
    return 1;
  }

  if (type === "ReservationCancelled") {
    const reservationId = stringField(data, "reservation_id");
    const existing = db.getReservation(reservationId);
    if (!existing) return 0;
    db.upsertReservation({ ...existing, status: "cancelled", updatedDigest: digest });
    updateEvent(db, existing.eventObjectId, digest, (event) => ({
      ...event,
      reservedCount: Math.max(0, event.reservedCount - 1),
      status: event.status === "full" ? "open" : event.status,
      updatedDigest: digest,
    }));
    return 1;
  }

  if (type === "CheckedInAndRefunded") {
    const reservationId = stringField(data, "reservation_id");
    const existing = db.getReservation(reservationId);
    if (!existing) return 0;
    db.upsertReservation({ ...existing, status: "checked_in_refunded", updatedDigest: digest });
    updateEvent(db, existing.eventObjectId, digest, (event) => ({
      ...event,
      checkedInCount: event.checkedInCount + 1,
      updatedDigest: digest,
    }));
    return 1;
  }

  if (type === "EventSettled") {
    const eventObjectId = stringField(data, "event_id");
    db.upsertSettlement({
      objectId: stringField(data, "receipt_id"),
      eventObjectId,
      totalReserved: numberField(data, "total_reserved"),
      totalCheckedIn: numberField(data, "total_checked_in"),
      totalNoShow: numberField(data, "total_no_show"),
      forfeitedAmount: stringField(data, "forfeited_amount"),
      distributedAmount: stringField(data, "distributed_amount"),
      settledDigest: digest,
    });
    updateEvent(db, eventObjectId, digest, (event) => ({
      ...event,
      reservedCount: numberField(data, "total_reserved"),
      checkedInCount: numberField(data, "total_checked_in"),
      status: "settled",
      updatedDigest: digest,
    }));
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

function updateEvent(
  db: NoFlakeDatabase,
  eventObjectId: string,
  digest: string,
  update: (event: NonNullable<ReturnType<NoFlakeDatabase["getEvent"]>>) => NonNullable<ReturnType<NoFlakeDatabase["getEvent"]>>,
): void {
  const event = db.getEvent(eventObjectId);
  if (!event) return;
  db.upsertEvent(update({ ...event, updatedDigest: digest }));
}
