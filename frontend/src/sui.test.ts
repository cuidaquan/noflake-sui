import { describe, expect, it } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import {
  buildCheckInTransaction,
  buildCreateEventTransaction,
  buildReserveTransaction,
  buildSettleEventTransaction,
  buildCheckInPayload,
  explorerObjectUrl,
  explorerTransactionUrl,
  extractCreatedEventRefs,
  extractReservationId,
  parseCheckInPayload,
  selectReserveCoin,
  validateCheckInPayloadForEvent,
  deriveNoShowCount,
  deriveSettlementPreview,
  eventStatusLabel,
  extractSettlementSnapshot,
  formatShortAddress,
  reservationStatusLabel,
  settlementModeLabel,
} from "./sui";

const config = {
  packageId: "0x0000000000000000000000000000000000000000000000000000000000001234",
  coinType: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
};

const eventObjectId = "0x00000000000000000000000000000000000000000000000000000000000000e1";
const vaultObjectId = "0x00000000000000000000000000000000000000000000000000000000000000a1";
const reservationObjectId = "0x00000000000000000000000000000000000000000000000000000000000000r1";
const coinObjectId = "0x00000000000000000000000000000000000000000000000000000000000000c1";

describe("NoFlake transaction builders", () => {
  it("builds create event calls with the configured package and coin type", () => {
    const tx = buildCreateEventTransaction(config, {
      title: "Sui Builder Dinner",
      startMs: 1_700_000_000_000,
      endMs: 1_700_000_360_000,
      depositAmount: 20,
      seatCount: 30,
      settlementMode: "party",
    });

    expect(tx.getData().commands[0]).toMatchObject({
      MoveCall: {
        package: config.packageId,
        module: "noflake",
        function: "create_event",
        typeArguments: [config.coinType],
      },
    });
  });

  it("builds reserve, check-in, and settle calls", () => {
    expect(
      buildReserveTransaction(config, {
        eventObjectId,
        vaultObjectId,
        depositCoinObjectId: coinObjectId,
        depositCoinBalance: "20",
        depositAmount: "20",
        attendeeAddress: "0x0000000000000000000000000000000000000000000000000000000000000abc",
      }),
    ).toBeInstanceOf(Transaction);

    expect(
      buildCheckInTransaction(config, {
        eventObjectId,
        vaultObjectId,
        reservationObjectId,
      }),
    ).toBeInstanceOf(Transaction);

    expect(
      buildSettleEventTransaction(config, {
        eventObjectId,
        vaultObjectId,
      }),
    ).toBeInstanceOf(Transaction);
  });

  it("formats labels and counters for the dashboard", () => {
    expect(settlementModeLabel("party")).toBe("Party Mode");
    expect(eventStatusLabel("settled")).toBe("Settled");
    expect(reservationStatusLabel("checked_in_refunded")).toBe("checked in refunded");
    expect(formatShortAddress("0x1234567890abcdef")).toBe("0x123456...cdef");
    expect(
      deriveNoShowCount({
        objectId: "0xevent",
        vaultObjectId: "0xvault",
        hostAddress: "0xhost",
        title: "Event",
        depositAmount: "20",
        seatCount: 3,
        reservedCount: 3,
        checkedInCount: 1,
        settlementMode: "party",
        status: "open",
        updatedDigest: "digest",
        reservations: [],
        settlement: null,
      }),
    ).toBe(2);
  });

  it("builds Sui Explorer URLs for testnet objects and transactions", () => {
    expect(explorerObjectUrl(eventObjectId)).toBe(`https://suiexplorer.com/object/${eventObjectId}?network=testnet`);
    expect(explorerTransactionUrl("digest")).toBe("https://suiexplorer.com/txblock/digest?network=testnet");
  });

  it("derives settlement preview amounts for the dashboard", () => {
    expect(
      deriveSettlementPreview({
        objectId: "0xevent",
        vaultObjectId: "0xvault",
        hostAddress: "0xhost",
        title: "Event",
        depositAmount: "20",
        seatCount: 3,
        reservedCount: 3,
        checkedInCount: 2,
        settlementMode: "party",
        status: "open",
        updatedDigest: "digest",
        reservations: [],
        settlement: null,
      }),
    ).toEqual({
      noShowCount: 1,
      vaultBalance: 20,
      distributionLabel: "Checked-in attendees",
      checkedInRefundedAmount: 40,
    });
  });

  it("selects the smallest usable reserve coin of the target type", () => {
    expect(
      selectReserveCoin(
        [
          { coinObjectId: "0x1", coinType: config.coinType, balance: "15", digest: "d1", version: "1" },
          { coinObjectId: "0x2", coinType: config.coinType, balance: "25", digest: "d2", version: "1" },
          { coinObjectId: "0x3", coinType: "0xother::coin::COIN", balance: "100", digest: "d3", version: "1" },
        ],
        config.coinType,
        "20",
      )?.coinObjectId,
    ).toBe("0x2");
  });

  it("extracts created event and vault refs from EventCreated parsedJson", () => {
    expect(
      extractCreatedEventRefs({
        events: [
          {
            type: `${config.packageId}::noflake::EventCreated`,
            parsedJson: {
              event_id: eventObjectId,
              vault_id: vaultObjectId,
            },
          },
        ],
        objectChanges: [],
      }),
    ).toEqual({ eventObjectId, vaultObjectId });
  });

  it("extracts created event and vault refs from object changes when events are unavailable", () => {
    expect(
      extractCreatedEventRefs({
        events: [],
        objectChanges: [
          {
            type: "created",
            objectId: eventObjectId,
            objectType: `${config.packageId}::noflake::Event`,
            owner: { Shared: { initial_shared_version: 1 } },
          },
          {
            type: "created",
            objectId: vaultObjectId,
            objectType: `${config.packageId}::noflake::EventVault<${config.coinType}>`,
            owner: { Shared: { initial_shared_version: 1 } },
          },
        ],
      }),
    ).toEqual({ eventObjectId, vaultObjectId });
  });

  it("extracts reservation id from ReservationCreated parsedJson", () => {
    expect(
      extractReservationId({
        events: [
          {
            type: `${config.packageId}::noflake::ReservationCreated`,
            parsedJson: {
              event_id: eventObjectId,
              reservation_id: reservationObjectId,
              attendee: "0xabc",
            },
          },
        ],
      }),
    ).toBe(reservationObjectId);
  });

  it("extracts settlement receipt data from EventSettled parsedJson", () => {
    expect(
      extractSettlementSnapshot(
        {
          events: [
            {
              type: `${config.packageId}::noflake::EventSettled`,
              parsedJson: {
                event_id: eventObjectId,
                receipt_id: "0xreceipt",
                total_reserved: "3",
                total_checked_in: "2",
                total_no_show: "1",
                forfeited_amount: "0",
                distributed_amount: "20",
              },
            },
          ],
        },
        "settleDigest",
      ),
    ).toEqual({
      objectId: "0xreceipt",
      eventObjectId,
      totalReserved: 3,
      totalCheckedIn: 2,
      totalNoShow: 1,
      forfeitedAmount: "0",
      distributedAmount: "20",
      settledDigest: "settleDigest",
    });
  });

  it("builds a stable check-in QR payload", () => {
    expect(
      buildCheckInPayload({
        eventObjectId,
        reservationObjectId,
        attendeeAddress: "0xabc",
      }),
    ).toBe(
      JSON.stringify({
        type: "noflake_check_in",
        event_id: eventObjectId,
        reservation_id: reservationObjectId,
        attendee: "0xabc",
      }),
    );
  });

  it("parses a valid check-in QR payload", () => {
    expect(
      parseCheckInPayload(
        JSON.stringify({
          type: "noflake_check_in",
          event_id: eventObjectId,
          reservation_id: reservationObjectId,
          attendee: "0xabc",
        }),
      ),
    ).toEqual({
      eventObjectId,
      reservationObjectId,
      attendeeAddress: "0xabc",
    });
  });

  it("rejects malformed check-in QR payloads", () => {
    expect(() => parseCheckInPayload("{bad json")).toThrow("QR payload is not valid JSON.");
    expect(() => parseCheckInPayload(JSON.stringify({ type: "wrong" }))).toThrow("QR payload is not a NoFlake check-in payload.");
    expect(() => parseCheckInPayload(JSON.stringify({ type: "noflake_check_in" }))).toThrow("QR payload is missing required fields.");
  });

  it("validates check-in payload against the current event and reservation state", () => {
    const event = {
      objectId: eventObjectId,
      vaultObjectId,
      hostAddress: "0xhost",
      title: "Event",
      depositAmount: "20",
      seatCount: 3,
      reservedCount: 1,
      checkedInCount: 0,
      settlementMode: "party" as const,
      status: "open" as const,
      updatedDigest: "digest",
      reservations: [
        {
          objectId: reservationObjectId,
          eventObjectId,
          attendeeAddress: "0xabc",
          depositAmount: "20",
          status: "reserved" as const,
          updatedDigest: "digest",
        },
      ],
      settlement: null,
    };

    expect(
      validateCheckInPayloadForEvent(
        {
          eventObjectId,
          reservationObjectId,
          attendeeAddress: "0xabc",
        },
        event,
      ),
    ).toEqual({ ok: true, reservation: event.reservations[0] });
  });

  it("returns local precheck errors before check-in signing", () => {
    const event = {
      objectId: eventObjectId,
      vaultObjectId,
      hostAddress: "0xhost",
      title: "Event",
      depositAmount: "20",
      seatCount: 3,
      reservedCount: 1,
      checkedInCount: 0,
      settlementMode: "party" as const,
      status: "open" as const,
      updatedDigest: "digest",
      reservations: [
        {
          objectId: reservationObjectId,
          eventObjectId,
          attendeeAddress: "0xabc",
          depositAmount: "20",
          status: "checked_in_refunded" as const,
          updatedDigest: "digest",
        },
      ],
      settlement: null,
    };

    expect(
      validateCheckInPayloadForEvent(
        {
          eventObjectId: "0xwrong",
          reservationObjectId,
          attendeeAddress: "0xabc",
        },
        event,
      ),
    ).toEqual({ ok: false, reason: "QR payload belongs to a different event." });
    expect(
      validateCheckInPayloadForEvent(
        {
          eventObjectId,
          reservationObjectId,
          attendeeAddress: "0xabc",
        },
        event,
      ),
    ).toEqual({ ok: false, reason: "Reservation is checked in refunded, not reserved." });
  });

  it("passes an exact deposit coin to reserve and transfers the returned reservation", () => {
    const attendeeAddress = "0x0000000000000000000000000000000000000000000000000000000000000abc";
    const tx = buildReserveTransaction(config, {
      eventObjectId,
      vaultObjectId,
      depositCoinObjectId: coinObjectId,
      depositCoinBalance: "20",
      depositAmount: "20",
      attendeeAddress,
    });

    expect(tx.getData().commands).toHaveLength(2);
    expect(tx.getData().commands[0]).toMatchObject({
      MoveCall: {
        package: config.packageId,
        module: "noflake",
        function: "reserve",
      },
    });
    expect(tx.getData().commands[0].MoveCall?.arguments[2]).toMatchObject({ Input: 0, type: "object" });
    expect(tx.getData().commands[1]).toMatchObject({
      TransferObjects: {
        objects: [{ Result: 0 }],
      },
    });
  });

  it("splits an oversized deposit coin before reserve and transfers the returned reservation", () => {
    const attendeeAddress = "0x0000000000000000000000000000000000000000000000000000000000000abc";
    const tx = buildReserveTransaction(config, {
      eventObjectId,
      vaultObjectId,
      depositCoinObjectId: coinObjectId,
      depositCoinBalance: "100",
      depositAmount: "20",
      attendeeAddress,
    });

    expect(tx.getData().commands).toHaveLength(3);
    expect(tx.getData().commands[0]).toMatchObject({
      SplitCoins: {
        coin: { Input: 0, type: "object" },
        amounts: [{ Input: 1, type: "pure" }],
      },
    });
    expect(tx.getData().commands[1]).toMatchObject({
      MoveCall: {
        package: config.packageId,
        module: "noflake",
        function: "reserve",
        arguments: [
          { Input: 2, type: "object" },
          { Input: 3, type: "object" },
          { NestedResult: [0, 0] },
        ],
      },
    });
    expect(tx.getData().commands[2]).toMatchObject({
      TransferObjects: {
        objects: [{ Result: 1 }],
      },
    });
  });
});
