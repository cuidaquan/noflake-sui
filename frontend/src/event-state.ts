import type { EventSnapshot } from "./api/client";

export type EventState = EventSnapshot | null;

const LAST_EVENT_ID_STORAGE_KEY = "noflake:last-event-id";

interface EventIdStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createInitialEventState(): EventState {
  return null;
}

export function readLastEventId(storage = browserStorage()): string {
  if (!storage) return "";
  return storage.getItem(LAST_EVENT_ID_STORAGE_KEY)?.trim() ?? "";
}

export function readInitialEventId(
  search = browserSearch(),
  storage = browserStorage(),
  fallbackEventId = "",
): string {
  const eventId = new URLSearchParams(search).get("event")?.trim();
  if (eventId) return eventId;

  const savedEventId = readLastEventId(storage);
  if (savedEventId) return savedEventId;

  return fallbackEventId.trim();
}

export function saveLastEventId(eventId: string, storage = browserStorage()): void {
  const normalized = eventId.trim();
  if (!normalized || !storage) return;
  storage.setItem(LAST_EVENT_ID_STORAGE_KEY, normalized);
}

function browserStorage(): EventIdStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function browserSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}
