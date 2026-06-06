import { describe, expect, it } from "vitest";
import { fetchEventSnapshotFromSuiEvents, type SuiEvent, type SuiEventClient } from "./sui-events";

function event(type: string, txDigest: string, parsedJson: Record<string, unknown>): SuiEvent {
  return {
    id: { txDigest, eventSeq: "0" },
    type: `0xpackage::noflake::${type}`,
    parsedJson,
  };
}

describe("Sui event snapshot indexer", () => {
  it("rebuilds an event snapshot from NoFlake move events", async () => {
    const targetEventId = "0xevent";
    const client = fakeEventClient({
      EventCreated: [
        event("EventCreated", "create-digest", {
          event_id: targetEventId,
          vault_id: "0xvault",
          host: "0xhost",
          title: "Sui Builder Dinner",
          start_ms: "10",
          end_ms: "20",
          deposit_amount: "20000000",
          seat_count: "3",
          settlement_mode: 1,
        }),
      ],
      ReservationCreated: [
        event("ReservationCreated", "reserve-a", {
          event_id: targetEventId,
          reservation_id: "0xreservation-a",
          attendee: "0xattendee-a",
          deposit_amount: "20000000",
        }),
        event("ReservationCreated", "reserve-b", {
          event_id: targetEventId,
          reservation_id: "0xreservation-b",
          attendee: "0xattendee-b",
          deposit_amount: "20000000",
        }),
        event("ReservationCreated", "reserve-other", {
          event_id: "0xother",
          reservation_id: "0xother-reservation",
          attendee: "0xother-attendee",
          deposit_amount: "20000000",
        }),
      ],
      CheckedInAndRefunded: [
        event("CheckedInAndRefunded", "checkin-a", {
          event_id: targetEventId,
          reservation_id: "0xreservation-a",
          attendee: "0xattendee-a",
          refund_amount: "20000000",
        }),
      ],
      EventSettled: [
        event("EventSettled", "settle-digest", {
          event_id: targetEventId,
          receipt_id: "0xreceipt",
          total_reserved: "2",
          total_checked_in: "1",
          total_no_show: "1",
          forfeited_amount: "0",
          distributed_amount: "20000000",
        }),
      ],
    });

    await expect(fetchEventSnapshotFromSuiEvents({
      eventId: targetEventId,
      packageId: "0xpackage",
      client,
    })).resolves.toEqual({
      objectId: targetEventId,
      vaultObjectId: "0xvault",
      hostAddress: "0xhost",
      title: "Sui Builder Dinner",
      startMs: 10,
      endMs: 20,
      depositAmount: "20000000",
      seatCount: 3,
      reservedCount: 2,
      checkedInCount: 1,
      settlementMode: "party",
      status: "settled",
      updatedDigest: "settle-digest",
      reservations: [
        {
          objectId: "0xreservation-a",
          eventObjectId: targetEventId,
          attendeeAddress: "0xattendee-a",
          depositAmount: "20000000",
          status: "checked_in_refunded",
          updatedDigest: "checkin-a",
        },
        {
          objectId: "0xreservation-b",
          eventObjectId: targetEventId,
          attendeeAddress: "0xattendee-b",
          depositAmount: "20000000",
          status: "reserved",
          updatedDigest: "reserve-b",
        },
      ],
      settlement: {
        objectId: "0xreceipt",
        eventObjectId: targetEventId,
        totalReserved: 2,
        totalCheckedIn: 1,
        totalNoShow: 1,
        forfeitedAmount: "0",
        distributedAmount: "20000000",
        settledDigest: "settle-digest",
      },
    });
  });

  it("returns null when the target event was not created by the package", async () => {
    const client = fakeEventClient({
      EventCreated: [
        event("EventCreated", "create-other", {
          event_id: "0xother",
          vault_id: "0xvault",
          host: "0xhost",
          title: "Other Event",
          start_ms: 10,
          end_ms: 20,
          deposit_amount: "20000000",
          seat_count: 3,
          settlement_mode: 1,
        }),
      ],
    });

    await expect(fetchEventSnapshotFromSuiEvents({
      eventId: "0xmissing",
      packageId: "0xpackage",
      client,
    })).resolves.toBeNull();
  });

  it("marks an event cancelled from EventCancelled move events", async () => {
    const targetEventId = "0xevent";
    const client = fakeEventClient({
      EventCreated: [
        event("EventCreated", "create-digest", {
          event_id: targetEventId,
          vault_id: "0xvault",
          host: "0xhost",
          title: "Sui Builder Dinner",
          start_ms: "10",
          end_ms: "20",
          deposit_amount: "20000000",
          seat_count: "3",
          settlement_mode: 0,
        }),
      ],
      EventCancelled: [
        event("EventCancelled", "cancel-digest", {
          event_id: targetEventId,
          host: "0xhost",
          reserved_count: "2",
        }),
      ],
    });

    await expect(fetchEventSnapshotFromSuiEvents({
      eventId: targetEventId,
      packageId: "0xpackage",
      client,
    })).resolves.toMatchObject({
      objectId: targetEventId,
      status: "cancelled",
      reservedCount: 2,
      updatedDigest: "cancel-digest",
    });
  });
});

function fakeEventClient(eventsByName: Partial<Record<string, SuiEvent[]>>): SuiEventClient {
  return {
    async queryEvents(input) {
      const eventTypeParts = input.query.MoveEventType.split("::");
      const eventName = eventTypeParts[eventTypeParts.length - 1] ?? "";
      return {
        data: eventsByName[eventName] ?? [],
        nextCursor: null,
        hasNextPage: false,
      };
    },
  };
}
