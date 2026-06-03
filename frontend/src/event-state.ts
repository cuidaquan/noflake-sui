import type { EventSnapshot } from "./api/client";

export type EventState = EventSnapshot | null;

export function createInitialEventState(): EventState {
  return null;
}
