import Database from "better-sqlite3";
import type { CachedEvent, CachedReservation, CachedSettlement, NoFlakeDatabase } from "./types";

type SqliteDatabase = Database.Database;

export function createDatabase(path: string): NoFlakeDatabase {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  migrate(db);

  return {
    close: () => db.close(),
    getEvent: (objectId) => {
      const row = db.prepare("select * from events where object_id = ?").get(objectId) as EventRow | undefined;
      return row ? mapEvent(row) : undefined;
    },
    getReservationsForEvent: (eventObjectId) => {
      const rows = db
        .prepare("select * from reservations where event_object_id = ? order by object_id")
        .all(eventObjectId) as ReservationRow[];
      return rows.map(mapReservation);
    },
    getReservation: (objectId) => {
      const row = db
        .prepare("select * from reservations where object_id = ?")
        .get(objectId) as ReservationRow | undefined;
      return row ? mapReservation(row) : undefined;
    },
    getSettlementForEvent: (eventObjectId) => {
      const row = db
        .prepare("select * from settlements where event_object_id = ?")
        .get(eventObjectId) as SettlementRow | undefined;
      return row ? mapSettlement(row) : undefined;
    },
    upsertEvent: (event) => {
      db.prepare(
        `insert into events (
          object_id, vault_object_id, host_address, title, deposit_amount, seat_count, reserved_count,
          checked_in_count, settlement_mode, status, updated_digest
        ) values (
          @objectId, @vaultObjectId, @hostAddress, @title, @depositAmount, @seatCount, @reservedCount,
          @checkedInCount, @settlementMode, @status, @updatedDigest
        )
        on conflict(object_id) do update set
          vault_object_id = excluded.vault_object_id,
          host_address = excluded.host_address,
          title = excluded.title,
          deposit_amount = excluded.deposit_amount,
          seat_count = excluded.seat_count,
          reserved_count = excluded.reserved_count,
          checked_in_count = excluded.checked_in_count,
          settlement_mode = excluded.settlement_mode,
          status = excluded.status,
          updated_digest = excluded.updated_digest`,
      ).run(event);
    },
    upsertReservation: (reservation) => {
      db.prepare(
        `insert into reservations (
          object_id, event_object_id, attendee_address, deposit_amount, status, updated_digest
        ) values (
          @objectId, @eventObjectId, @attendeeAddress, @depositAmount, @status, @updatedDigest
        )
        on conflict(object_id) do update set
          event_object_id = excluded.event_object_id,
          attendee_address = excluded.attendee_address,
          deposit_amount = excluded.deposit_amount,
          status = excluded.status,
          updated_digest = excluded.updated_digest`,
      ).run(reservation);
    },
    upsertSettlement: (settlement) => {
      db.prepare(
        `insert into settlements (
          object_id, event_object_id, total_reserved, total_checked_in, total_no_show,
          forfeited_amount, distributed_amount, settled_digest
        ) values (
          @objectId, @eventObjectId, @totalReserved, @totalCheckedIn, @totalNoShow,
          @forfeitedAmount, @distributedAmount, @settledDigest
        )
        on conflict(object_id) do update set
          event_object_id = excluded.event_object_id,
          total_reserved = excluded.total_reserved,
          total_checked_in = excluded.total_checked_in,
          total_no_show = excluded.total_no_show,
          forfeited_amount = excluded.forfeited_amount,
          distributed_amount = excluded.distributed_amount,
          settled_digest = excluded.settled_digest`,
      ).run(settlement);
    },
  };
}

function migrate(db: SqliteDatabase): void {
  db.exec(`
    create table if not exists events (
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

    create table if not exists reservations (
      object_id text primary key,
      event_object_id text not null,
      attendee_address text not null,
      deposit_amount text not null,
      status text not null,
      updated_digest text not null
    );

    create table if not exists settlements (
      object_id text primary key,
      event_object_id text not null,
      total_reserved integer not null,
      total_checked_in integer not null,
      total_no_show integer not null,
      forfeited_amount text not null,
      distributed_amount text not null,
      settled_digest text not null
    );
  `);
}

interface EventRow {
  object_id: string;
  vault_object_id: string;
  host_address: string;
  title: string;
  deposit_amount: string;
  seat_count: number;
  reserved_count: number;
  checked_in_count: number;
  settlement_mode: CachedEvent["settlementMode"];
  status: CachedEvent["status"];
  updated_digest: string;
}

interface ReservationRow {
  object_id: string;
  event_object_id: string;
  attendee_address: string;
  deposit_amount: string;
  status: CachedReservation["status"];
  updated_digest: string;
}

interface SettlementRow {
  object_id: string;
  event_object_id: string;
  total_reserved: number;
  total_checked_in: number;
  total_no_show: number;
  forfeited_amount: string;
  distributed_amount: string;
  settled_digest: string;
}

function mapEvent(row: EventRow): CachedEvent {
  return {
    objectId: row.object_id,
    vaultObjectId: row.vault_object_id,
    hostAddress: row.host_address,
    title: row.title,
    depositAmount: row.deposit_amount,
    seatCount: row.seat_count,
    reservedCount: row.reserved_count,
    checkedInCount: row.checked_in_count,
    settlementMode: row.settlement_mode,
    status: row.status,
    updatedDigest: row.updated_digest,
  };
}

function mapReservation(row: ReservationRow): CachedReservation {
  return {
    objectId: row.object_id,
    eventObjectId: row.event_object_id,
    attendeeAddress: row.attendee_address,
    depositAmount: row.deposit_amount,
    status: row.status,
    updatedDigest: row.updated_digest,
  };
}

function mapSettlement(row: SettlementRow): CachedSettlement {
  return {
    objectId: row.object_id,
    eventObjectId: row.event_object_id,
    totalReserved: row.total_reserved,
    totalCheckedIn: row.total_checked_in,
    totalNoShow: row.total_no_show,
    forfeitedAmount: row.forfeited_amount,
    distributedAmount: row.distributed_amount,
    settledDigest: row.settled_digest,
  };
}
