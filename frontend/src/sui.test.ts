import { describe, expect, it } from "vitest";
import {
  buildCheckInTransaction,
  buildCreateEventTransaction,
  buildReserveTransaction,
  buildSettleEventTransaction,
  deriveNoShowCount,
  eventStatusLabel,
  formatShortAddress,
  reservationStatusLabel,
  settlementModeLabel,
} from "./sui";

const config = {
  packageId: "0x1234",
  coinType: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
};

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
        package: "0x1234",
        module: "noflake",
        function: "create_event",
        typeArguments: [config.coinType],
      },
    });
  });

  it("builds reserve, check-in, and settle calls", () => {
    expect(buildReserveTransaction(config, {
      eventObjectId: "0xevent",
      vaultObjectId: "0xvault",
      depositCoinObjectId: "0xcoin",
    }).getData().commands[0]).toMatchObject({
      MoveCall: { function: "reserve" },
    });

    expect(buildCheckInTransaction(config, {
      eventObjectId: "0xevent",
      vaultObjectId: "0xvault",
      reservationObjectId: "0xreservation",
    }).getData().commands[0]).toMatchObject({
      MoveCall: { function: "check_in" },
    });

    expect(buildSettleEventTransaction(config, {
      eventObjectId: "0xevent",
      vaultObjectId: "0xvault",
    }).getData().commands[0]).toMatchObject({
      MoveCall: { function: "settle_event" },
    });
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
});
