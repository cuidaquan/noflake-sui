import { afterEach, describe, expect, it, vi } from "vitest";
import { createSuiClient } from "./sui-client";

describe("Sui event client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes event cursors to JSON-RPC and returns pagination metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          data: [],
          nextCursor: { txDigest: "digest-2", eventSeq: "8" },
          hasNextPage: true,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSuiClient({ suiNetwork: "testnet" }).queryEvents({
      query: { MoveEventType: "0xpackage::noflake::EventCreated" },
      cursor: { txDigest: "digest-1", eventSeq: "7" },
      limit: 50,
      order: "ascending",
    });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { params: unknown[] };
    expect(request.params).toEqual([
      { MoveEventType: "0xpackage::noflake::EventCreated" },
      { txDigest: "digest-1", eventSeq: "7" },
      50,
      false,
    ]);
    expect(result).toEqual({
      data: [],
      nextCursor: { txDigest: "digest-2", eventSeq: "8" },
      hasNextPage: true,
    });
  });
});
