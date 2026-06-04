import { describe, expect, it } from "vitest";
import { createInitialEventState, readLastEventId, saveLastEventId } from "./event-state";

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
});
