import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventSnapshot } from "./client";

const demoEvent: EventSnapshot = {
  objectId: "0xdemo",
  vaultObjectId: "0xvault",
  hostAddress: "0xhost",
  title: "Demo Dinner",
  startMs: 1,
  endMs: 2,
  depositAmount: "20000000",
  seatCount: 3,
  reservedCount: 2,
  checkedInCount: 1,
  settlementMode: "party",
  status: "open",
  updatedDigest: "digest",
  reservations: [],
  settlement: null,
};

describe("frontend api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to the static demo event snapshot when Sui RPC indexing is not configured", async () => {
    vi.stubEnv("VITE_NOFLAKE_PACKAGE_ID", "");
    const { fetchEventSnapshot } = await import("./client");
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(demoEvent));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchEventSnapshot("0xdemo")).resolves.toEqual(demoEvent);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/demo-event.json");
  });

  it("does not use the static demo event for a different event id", async () => {
    const { fetchEventSnapshot } = await import("./client");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(Response.json(demoEvent));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchEventSnapshot("0xother")).rejects.toThrow("Event 0xother was not found");
  });

  it("loads from Sui RPC events without calling a backend", async () => {
    vi.stubEnv("VITE_NOFLAKE_PACKAGE_ID", "0xpackage");
    const { fetchEventSnapshot: fetchSnapshotWithSuiFallback } = await import("./client");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(suiRpcResponse([
        suiEvent("EventCreated", "create-digest", {
          event_id: "0xdemo",
          vault_id: "0xvault",
          host: "0xhost",
          title: "Demo Dinner",
          start_ms: 1,
          end_ms: 2,
          deposit_amount: "20000000",
          seat_count: 3,
          settlement_mode: 1,
        }),
      ]))
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(suiRpcResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSnapshotWithSuiFallback("0xdemo")).resolves.toMatchObject({
      objectId: "0xdemo",
      vaultObjectId: "0xvault",
      title: "Demo Dinner",
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls.every(([input]) => !String(input).includes("/events/"))).toBe(true);
  });

  it("falls back to the static demo snapshot when Sui RPC indexing cannot find the event", async () => {
    vi.stubEnv("VITE_NOFLAKE_PACKAGE_ID", "0xpackage");
    const { fetchEventSnapshot } = await import("./client");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(suiRpcResponse([]))
      .mockResolvedValueOnce(Response.json(demoEvent));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchEventSnapshot("0xdemo")).resolves.toEqual(demoEvent);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(fetchMock).toHaveBeenLastCalledWith("/demo-event.json");
  });

  it("uses the static demo event before Sui RPC when static demo mode is enabled", async () => {
    vi.stubEnv("VITE_NOFLAKE_STATIC_DEMO", "true");
    const { fetchEventSnapshot: fetchStaticEventSnapshot } = await import("./client");
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(demoEvent));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchStaticEventSnapshot("0xdemo")).resolves.toEqual(demoEvent);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/demo-event.json");
  });
});

function suiEvent(type: string, txDigest: string, parsedJson: Record<string, unknown>) {
  return {
    id: { txDigest, eventSeq: "0" },
    type: `0xpackage::noflake::${type}`,
    parsedJson,
  };
}

function suiRpcResponse(data: unknown[]) {
  return Response.json({
    jsonrpc: "2.0",
    id: 1,
    result: {
      data,
      nextCursor: null,
      hasNextPage: false,
    },
  });
}
