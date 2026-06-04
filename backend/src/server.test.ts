import { describe, expect, it } from "vitest";
import { createDatabase } from "./db";
import { createServer } from "./server";

describe("backend api", () => {
  it("serves cached event state", async () => {
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
      checkedInCount: 1,
      settlementMode: "party",
      status: "open",
      updatedDigest: "digest-1",
    });

    const app = createServer({ db });
    const response = await app.inject({ method: "GET", url: "/events/0xevent" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      objectId: "0xevent",
      title: "Sui Builder Dinner",
      startMs: 1_000,
      endMs: 2_000,
      checkedInCount: 1,
    });

    await app.close();
  });

  it("allows frontend browser requests from another local port", async () => {
    const db = createDatabase(":memory:");
    const app = createServer({ db });
    const response = await app.inject({
      method: "OPTIONS",
      url: "/events/0xevent",
      headers: {
        origin: "http://127.0.0.1:5173",
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["access-control-allow-methods"]).toContain("GET");

    await app.close();
  });
});
