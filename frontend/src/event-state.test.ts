import { describe, expect, it } from "vitest";
import { createInitialEventState } from "./event-state";

describe("event state", () => {
  it("starts without a placeholder event snapshot", () => {
    expect(createInitialEventState()).toBeNull();
  });
});
