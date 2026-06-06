import type { EventSnapshot, EventStatus, ReservationSnapshot, SettlementSnapshot } from "./client";

const EVENT_PAGE_SIZE = 50;
const MAX_PAGES_PER_EVENT_TYPE = 20;

const EVENT_TYPES = [
  "EventCreated",
  "ReservationCreated",
  "ReservationCancelled",
  "EventCancelled",
  "CheckedInAndRefunded",
  "EventSettled",
] as const;

export interface SuiEvent {
  id: { txDigest: string; eventSeq: string };
  type: string;
  parsedJson?: unknown;
}

export interface EventCursor {
  txDigest: string;
  eventSeq: string;
}

export interface SuiEventClient {
  queryEvents(input: {
    query: { MoveEventType: string };
    cursor?: EventCursor | null;
    limit: number;
    order: "ascending" | "descending";
  }): Promise<{ data: SuiEvent[]; nextCursor: EventCursor | null; hasNextPage: boolean }>;
}

export interface SuiEventSnapshotOptions {
  eventId: string;
  packageId: string;
  client: SuiEventClient;
}

export function createSuiEventClient(
  rpcUrl = import.meta.env.VITE_SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
): SuiEventClient {
  return {
    async queryEvents(input) {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [input.query, input.cursor ?? null, input.limit, input.order === "descending"],
        }),
      });

      if (!response.ok) {
        throw new Error(`Sui RPC request failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        error?: { message?: string };
        result?: { data?: SuiEvent[]; nextCursor?: EventCursor | null; hasNextPage?: boolean };
      };
      if (payload.error) {
        throw new Error(payload.error.message ?? "Sui RPC request failed");
      }

      return {
        data: payload.result?.data ?? [],
        nextCursor: payload.result?.nextCursor ?? null,
        hasNextPage: payload.result?.hasNextPage ?? false,
      };
    },
  };
}

export async function fetchEventSnapshotFromSuiEvents({
  eventId,
  packageId,
  client,
}: SuiEventSnapshotOptions): Promise<EventSnapshot | null> {
  if (!packageId) return null;

  const state = createEmptyIndexState();
  for (const eventName of EVENT_TYPES) {
    let cursor: EventCursor | null = null;
    for (let page = 0; page < MAX_PAGES_PER_EVENT_TYPE; page += 1) {
      const result = await client.queryEvents({
        query: { MoveEventType: `${packageId}::noflake::${eventName}` },
        cursor,
        limit: EVENT_PAGE_SIZE,
        order: "ascending",
      });

      for (const event of result.data) {
        applyEvent(state, eventId, event);
      }

      if (!result.hasNextPage || !result.nextCursor) break;
      cursor = result.nextCursor;
    }
  }

  if (!state.event) return null;

  return {
    ...state.event,
    reservations: [...state.reservations.values()].sort((left, right) => left.objectId.localeCompare(right.objectId)),
    settlement: state.settlement,
  };
}

interface IndexState {
  event: Omit<EventSnapshot, "reservations" | "settlement"> | null;
  reservations: Map<string, ReservationSnapshot>;
  settlement: SettlementSnapshot | null;
}

function createEmptyIndexState(): IndexState {
  return {
    event: null,
    reservations: new Map(),
    settlement: null,
  };
}

function applyEvent(state: IndexState, targetEventId: string, event: SuiEvent): void {
  const parsed = event.parsedJson;
  if (!parsed || typeof parsed !== "object") return;

  const data = parsed as Record<string, unknown>;
  if (stringField(data, "event_id") !== targetEventId) return;

  const eventTypeParts = event.type.split("::");
  const eventType = eventTypeParts[eventTypeParts.length - 1];
  if (eventType === "EventCreated") {
    state.event = {
      objectId: targetEventId,
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
      updatedDigest: event.id.txDigest,
    };
    return;
  }

  if (!state.event) return;

  if (eventType === "EventCancelled") {
    updateEvent(state, {
      reservedCount: numberField(data, "reserved_count"),
      status: "cancelled",
      updatedDigest: event.id.txDigest,
    });
    return;
  }

  if (eventType === "ReservationCreated") {
    const reservation: ReservationSnapshot = {
      objectId: stringField(data, "reservation_id"),
      eventObjectId: targetEventId,
      attendeeAddress: stringField(data, "attendee"),
      depositAmount: stringField(data, "deposit_amount"),
      status: "reserved",
      updatedDigest: event.id.txDigest,
    };
    state.reservations.set(reservation.objectId, reservation);
    updateEvent(state, {
      reservedCount: Math.min(state.event.seatCount, state.event.reservedCount + 1),
      status: state.event.reservedCount + 1 >= state.event.seatCount ? "full" : state.event.status,
      updatedDigest: event.id.txDigest,
    });
    return;
  }

  if (eventType === "ReservationCancelled") {
    const reservation = state.reservations.get(stringField(data, "reservation_id"));
    if (!reservation) return;
    state.reservations.set(reservation.objectId, {
      ...reservation,
      status: "cancelled",
      updatedDigest: event.id.txDigest,
    });
    updateEvent(state, {
      reservedCount: Math.max(0, state.event.reservedCount - 1),
      status: state.event.status === "full" ? "open" : state.event.status,
      updatedDigest: event.id.txDigest,
    });
    return;
  }

  if (eventType === "CheckedInAndRefunded") {
    const reservation = state.reservations.get(stringField(data, "reservation_id"));
    if (!reservation) return;
    state.reservations.set(reservation.objectId, {
      ...reservation,
      status: "checked_in_refunded",
      updatedDigest: event.id.txDigest,
    });
    updateEvent(state, {
      checkedInCount: state.event.checkedInCount + 1,
      updatedDigest: event.id.txDigest,
    });
    return;
  }

  if (eventType === "EventSettled") {
    state.settlement = {
      objectId: stringField(data, "receipt_id"),
      eventObjectId: targetEventId,
      totalReserved: numberField(data, "total_reserved"),
      totalCheckedIn: numberField(data, "total_checked_in"),
      totalNoShow: numberField(data, "total_no_show"),
      forfeitedAmount: stringField(data, "forfeited_amount"),
      distributedAmount: stringField(data, "distributed_amount"),
      settledDigest: event.id.txDigest,
    };
    updateEvent(state, {
      reservedCount: state.settlement.totalReserved,
      checkedInCount: state.settlement.totalCheckedIn,
      status: "settled",
      updatedDigest: event.id.txDigest,
    });
  }
}

function updateEvent(state: IndexState, patch: Partial<Omit<EventSnapshot, "reservations" | "settlement">>): void {
  if (!state.event) return;
  state.event = { ...state.event, ...patch };
}

function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : String(value ?? "");
}

function numberField(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}
