import { describe, expect, it } from "vitest";
import { createInitialEventState, readInitialEventId, readLastEventId, saveLastEventId } from "./event-state";

describe("event state", () => {
  it("starts without a placeholder event snapshot", () => {
    expect(createInitialEventState()).toBeNull();
  });

  it("stores and reads the last real event id without creating placeholder state", () => {
    const storage = new Map<string, string>();
    const testStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    saveLastEventId(" 0xevent ", testStorage);

    expect(readLastEventId(testStorage)).toBe("0xevent");
    expect(createInitialEventState()).toBeNull();
  });

  it("prefers the URL event id when resolving the initial event id", () => {
    const storage = {
      getItem: () => "0xstored",
      setItem: () => undefined,
    };

    expect(readInitialEventId("?event=0xurl", storage, "0xdemo")).toBe("0xurl");
  });

  it("uses the saved event id before the static demo event id", () => {
    const storage = {
      getItem: () => " 0xstored ",
      setItem: () => undefined,
    };

    expect(readInitialEventId("", storage, "0xdemo")).toBe("0xstored");
  });

  it("uses the static demo event id when no URL or saved event id exists", () => {
    const storage = {
      getItem: () => null,
      setItem: () => undefined,
    };

    expect(readInitialEventId("", storage, " 0xdemo ")).toBe("0xdemo");
  });
});
