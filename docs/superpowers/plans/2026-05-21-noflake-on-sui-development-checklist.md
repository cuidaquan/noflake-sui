# NoFlake on Sui Development Checklist

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this checklist task-by-task.  
> **Frontend implementation:** use `frontend-design` when building the UI.

**Goal:** Deliver the NoFlake MVP described in the technical plan: Move contract, offchain index/cache backend, and frontend flows for create, reserve, check-in, and settle.

**Architecture:** Build the chain core first, then the backend index/cache service, then the frontend on top. The backend never controls funds; it only watches Sui events, caches state, and serves query APIs. The frontend talks to the backend for reads and to Sui for writes.

**Tech Stack:** Sui Move, Node.js 22, TypeScript, Fastify, SQLite, React 19, Vite 8

---

### Task 1: Move contract MVP

**Files:**
- Create or modify: `contracts/sources/noflake.move`
- Create: `contracts/tests/noflake_tests.move`
- Modify: `contracts/Move.toml`
- Modify: `contracts/Move.lock`

- [ ] **Step 1: Replace the placeholder module with the MVP object model**

Implement `Event`, `EventVault<T>`, `Reservation`, and `SettlementReceipt`, plus the event types needed for indexing.

- [ ] **Step 2: Implement the entry functions**

Implement `create_event`, `reserve`, `cancel_reservation`, `check_in`, `settle_event`, and `cancel_event` with the MVP rules from the technical plan.

- [ ] **Step 3: Add contract tests**

Cover creation, full capacity rejection, reservation cancelation, immediate refund on check-in, and final settlement for strict and party modes.

- [ ] **Step 4: Build and fix warnings**

Run: `npm run move:build`
Expected: the package compiles on Sui 1.72.2 and the lockfile is refreshed.

### Task 2: Backend index and cache service

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/config.ts`
- Create: `backend/src/db.ts`
- Create: `backend/src/sui-client.ts`
- Create: `backend/src/worker/event-poller.ts`
- Create: `backend/src/routes/events.ts`
- Create: `backend/src/routes/reservations.ts`
- Create: `backend/src/routes/settlements.ts`
- Create: `backend/src/types.ts`

- [ ] **Step 1: Scaffold the backend workspace**

Add a Fastify app, a SQLite cache, and a small configuration layer for Sui testnet and the contract package id.

- [ ] **Step 2: Implement event polling**

Poll Sui events for `EventCreated`, `ReservationCreated`, `ReservationCancelled`, `CheckedInAndRefunded`, `EventSettled`, and `EventCancelled`, then persist the latest snapshot into SQLite.

- [ ] **Step 3: Implement read APIs**

Expose endpoints for event detail, reservation status, settlement summary, and a health check.

- [ ] **Step 4: Add backend tests**

Cover event upserts, reservation state transitions, and API responses from cached data.

- [ ] **Step 5: Verify backend startup**

Run: `npm run dev -w backend`
Expected: the server starts cleanly and serves cached reads.

### Task 3: Frontend MVP

**Files:**
- Modify or create: `frontend/src/App.tsx`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/components/*`
- Create: `frontend/src/pages/*`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/package.json`

- [ ] **Step 1: Use `frontend-design` for the UI pass**

Build a distinctive but practical product UI for host and attendee flows. Keep the visual language intentional and not generic.

- [ ] **Step 2: Implement the public event page**

Show event summary, deposit rules, seat availability, wallet connect, and the reserve action.

- [ ] **Step 3: Implement the reservation page**

Show reservation state, refund rules, and the check-in QR for attendees.

- [ ] **Step 4: Implement the host dashboard**

Include event creation, reservation table, check-in mode, refund confirmation, and settlement preview/result.

- [ ] **Step 5: Wire reads to the backend**

Use the backend APIs for event detail, reservation state, and settlement summaries.

- [ ] **Step 6: Wire writes to Sui**

Connect wallet actions to the Move entry functions for create, reserve, check-in, and settle.

- [ ] **Step 7: Verify the frontend build**

Run: `npm run build`
Expected: the Vite + TypeScript build succeeds.

### Task 4: Integration and demo readiness

**Files:**
- Modify: `README.md`
- Create: `docs/testnet-runbook.md` if needed
- Create: `backend/.env.example` if needed

- [ ] **Step 1: Add local run instructions**

Document how to start the backend, frontend, and Move build flow in the right order.

- [ ] **Step 2: Add testnet configuration**

Document the contract package id, Circle testnet USDC address, and required environment variables.

- [ ] **Step 3: Run end-to-end checks**

Verify the full flow: create event, reserve seat, check in with immediate refund, and settle no-shows.

- [ ] **Step 4: Commit each milestone**

Commit after each task once it passes the required build or test command.
