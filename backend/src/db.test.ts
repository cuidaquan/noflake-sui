import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "./db";

describe("database cache", () => {
  it("upserts event, reservation, and settlement snapshots", () => {
    const db = createDatabase(":memory:");

    db.upsertEvent({
      objectId: "0xevent",
      vaultObjectId: "0xvault",
      hostAddress: "0xhost",
      title: "Sui Builder Dinner",
      startMs: 1_000,
      endMs: 2_000,
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
    expect(db.getEvent("0xevent")).toMatchObject({ startMs: 1_000, endMs: 2_000 });
    expect(db.getReservationsForEvent("0xevent")).toHaveLength(1);
    expect(db.getSettlementForEvent("0xevent")?.forfeitedAmount).toBe("20");
  });

  it("adds event time columns to an existing cache database", () => {
    const directory = mkdtempSync(join(tmpdir(), "noflake-cache-"));
    const path = join(directory, "cache.sqlite");
    const legacyDb = new Database(path);
    legacyDb.exec(`
      create table events (
        object_id text primary key,
        host_address text not null,
        vault_object_id text not null,
        title text not null,
        deposit_amount text not null,
        seat_count integer not null,
        reserved_count integer not null,
        checked_in_count integer not null,
        settlement_mode text not null,
        status text not null,
        updated_digest text not null
      );
    `);
    legacyDb.close();

    const db = createDatabase(path);
    db.close();

    const migratedDb = new Database(path);
    const columns = migratedDb.prepare("pragma table_info(events)").all() as Array<{ name: string }>;
    migratedDb.close();
    rmSync(directory, { recursive: true, force: true });

    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining(["start_ms", "end_ms"]));
  });
});
