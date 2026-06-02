import { describe, expect, it } from "vitest";
import { createDatabase } from "../db";
import type { SuiEvent, SuiEventClient } from "../sui-client";
import { pollNoFlakeEvents } from "./event-poller";

const packageId = "0xpackage";

describe("NoFlake event poller", () => {
  it("updates event counters and settlement status from indexed events", async () => {
    const db = createDatabase(":memory:");
    const client = clientWithEvents([
      event("EventCreated", "digest-1", "0", {
        event_id: "0xevent",
        vault_id: "0xvault",
        host: "0xhost",
        title: "Sui Builder Dinner",
        start_ms: "1000",
        end_ms: "2000",
        deposit_amount: "20",
        seat_count: "3",
        settlement_mode: "1",
      }),
      event("ReservationCreated", "digest-2", "0", {
        event_id: "0xevent",
        reservation_id: "0xreservation-a",
        attendee: "0xa",
        deposit_amount: "20",
      }),
      event("ReservationCreated", "digest-3", "0", {
        event_id: "0xevent",
        reservation_id: "0xreservation-b",
        attendee: "0xb",
        deposit_amount: "20",
      }),
      event("CheckedInAndRefunded", "digest-4", "0", {
        event_id: "0xevent",
        reservation_id: "0xreservation-a",
        attendee: "0xa",
        refund_amount: "20",
      }),
      event("EventSettled", "digest-5", "0", {
        event_id: "0xevent",
        receipt_id: "0xreceipt",
        total_reserved: "2",
        total_checked_in: "1",
        total_no_show: "1",
        forfeited_amount: "0",
        distributed_amount: "20",
      }),
    ]);

    expect(await pollNoFlakeEvents({ client, db, packageId })).toBe(5);
    expect(db.getEvent("0xevent")).toMatchObject({
      reservedCount: 2,
      checkedInCount: 1,
      startMs: 1_000,
      endMs: 2_000,
      status: "settled",
    });
    expect(db.getReservation("0xreservation-a")?.status).toBe("checked_in_refunded");
    expect(db.getSettlementForEvent("0xevent")).toMatchObject({
      objectId: "0xreceipt",
      totalReserved: 2,
      totalCheckedIn: 1,
      totalNoShow: 1,
    });

    db.close();
  });

  it("does not process duplicate events twice", async () => {
    const db = createDatabase(":memory:");
    const events = [
      event("EventCreated", "digest-1", "0", {
        event_id: "0xevent",
        vault_id: "0xvault",
        host: "0xhost",
        title: "Sui Builder Dinner",
        start_ms: "1000",
        end_ms: "2000",
        deposit_amount: "20",
        seat_count: "3",
        settlement_mode: "0",
      }),
      event("ReservationCreated", "digest-2", "0", {
        event_id: "0xevent",
        reservation_id: "0xreservation",
        attendee: "0xa",
        deposit_amount: "20",
      }),
    ];
    const client = clientWithEvents(events);

    expect(await pollNoFlakeEvents({ client, db, packageId })).toBe(2);
    expect(await pollNoFlakeEvents({ client, db, packageId })).toBe(0);
    expect(db.getEvent("0xevent")?.reservedCount).toBe(1);

    db.close();
  });

  it("processes multiple pages and saves the final cursor", async () => {
    const db = createDatabase(":memory:");
    const eventA = createdEvent("0xevent-a", "digest-a");
    const eventB = createdEvent("0xevent-b", "digest-b");
    const client = clientWithPages({
      EventCreated: [[eventA], [eventB]],
    });

    expect(await pollNoFlakeEvents({ client, db, packageId })).toBe(2);
    expect(db.getEvent("0xevent-a")).toBeDefined();
    expect(db.getEvent("0xevent-b")).toBeDefined();
    expect(db.getEventCursor("EventCreated")).toEqual({ txDigest: "digest-b", eventSeq: "0" });

    db.close();
  });

  it("stops after twenty pages and continues from the saved cursor on the next poll", async () => {
    const db = createDatabase(":memory:");
    const pages = Array.from({ length: 21 }, (_, index) => [
      createdEvent(`0xevent-${index + 1}`, `digest-${index + 1}`),
    ]);
    const client = clientWithPages({ EventCreated: pages });

    expect(await pollNoFlakeEvents({ client, db, packageId })).toBe(20);
    expect(db.getEvent("0xevent-20")).toBeDefined();
    expect(db.getEvent("0xevent-21")).toBeUndefined();

    expect(await pollNoFlakeEvents({ client, db, packageId })).toBe(1);
    expect(db.getEvent("0xevent-21")).toBeDefined();

    db.close();
  });

  it("advances the cursor past malformed events", async () => {
    const db = createDatabase(":memory:");
    const malformed = event("EventCreated", "digest-malformed", "0", undefined);
    const client = clientWithPages({ EventCreated: [[malformed]] });

    expect(await pollNoFlakeEvents({ client, db, packageId })).toBe(0);
    expect(db.getEventCursor("EventCreated")).toEqual({ txDigest: "digest-malformed", eventSeq: "0" });

    db.close();
  });
});

function event(eventName: string, txDigest: string, eventSeq: string, parsedJson?: Record<string, unknown>): SuiEvent {
  return {
    id: { txDigest, eventSeq },
    type: `${packageId}::noflake::${eventName}`,
    parsedJson,
  };
}

function createdEvent(eventObjectId: string, txDigest: string): SuiEvent {
  return event("EventCreated", txDigest, "0", {
    event_id: eventObjectId,
    vault_id: `${eventObjectId}-vault`,
    host: "0xhost",
    title: "Sui Builder Dinner",
    start_ms: "1000",
    end_ms: "2000",
    deposit_amount: "20",
    seat_count: "3",
    settlement_mode: "0",
  });
}

function clientWithEvents(events: SuiEvent[]): SuiEventClient {
  return {
    async queryEvents(input) {
      const eventName = input.query.MoveEventType.split("::").at(-1);
      const data = events.filter((item) => item.type.endsWith(`::${eventName}`));
      return {
        data,
        nextCursor: data.at(-1)?.id ?? null,
        hasNextPage: false,
      };
    },
  };
}

function clientWithPages(pagesByEventName: Partial<Record<string, SuiEvent[][]>>): SuiEventClient {
  return {
    async queryEvents(input) {
      const eventName = input.query.MoveEventType.split("::").at(-1) ?? "";
      const pages = pagesByEventName[eventName] ?? [];
      const pageIndex = input.cursor
        ? pages.findIndex((page) => page.at(-1)?.id.txDigest === input.cursor?.txDigest && page.at(-1)?.id.eventSeq === input.cursor?.eventSeq) + 1
        : 0;
      const data = pages[pageIndex] ?? [];
      return {
        data,
        nextCursor: data.at(-1)?.id ?? null,
        hasNextPage: pageIndex + 1 < pages.length,
      };
    },
  };
}
