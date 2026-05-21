import { describe, expect, it } from "vitest";
import { createDatabase } from "./db";

describe("database cache", () => {
  it("upserts event, reservation, and settlement snapshots", () => {
    const db = createDatabase(":memory:");

    db.upsertEvent({
      objectId: "0xevent",
      vaultObjectId: "0xvault",
      hostAddress: "0xhost",
      title: "Sui Builder Dinner",
      depositAmount: "20",
      seatCount: 2,
      reservedCount: 1,
      checkedInCount: 0,
      settlementMode: "strict",
      status: "open",
      updatedDigest: "digest-1",
    });

    db.upsertReservation({
      objectId: "0xreservation",
      eventObjectId: "0xevent",
      attendeeAddress: "0xattendee",
      depositAmount: "20",
      status: "reserved",
      updatedDigest: "digest-2",
    });

    db.upsertSettlement({
      objectId: "0xreceipt",
      eventObjectId: "0xevent",
      totalReserved: 1,
      totalCheckedIn: 0,
      totalNoShow: 1,
      forfeitedAmount: "20",
      distributedAmount: "0",
      settledDigest: "digest-3",
    });

    expect(db.getEvent("0xevent")?.reservedCount).toBe(1);
    expect(db.getEvent("0xevent")?.vaultObjectId).toBe("0xvault");
    expect(db.getReservationsForEvent("0xevent")).toHaveLength(1);
    expect(db.getSettlementForEvent("0xevent")?.forfeitedAmount).toBe("20");
  });
});
