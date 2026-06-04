# NoFlake on Sui

NoFlake is a Sui-native programmable RSVP deposit settlement layer for small community events.

Free event RSVPs are easy to make and easy to abandon. NoFlake turns RSVP into a refundable on-chain commitment: attendees reserve a seat with a stablecoin deposit, hosts check them in on site, and the deposit is refunded immediately at check-in. No-show deposits are settled by transparent Move rules.

Primary hackathon track: `DeFi & Payments`

## MVP Flow

1. Host creates a deposit-backed event.
2. Attendee reserves a seat with Circle testnet USDC.
3. The deposit is held in an event-specific Move vault.
4. Attendee receives a reservation object and a check-in QR payload.
5. Host pastes or scans the payload, reviews a confirmation screen, and signs check-in.
6. Check-in immediately refunds the attendee deposit.
7. Host settles the event and no-show deposits are distributed by the selected mode.
8. The app shows transaction digests, object ids, and Sui Explorer links.

## Architecture

```text
React/Vite frontend
  - Host dashboard
  - Public reservation page
  - Reservation QR page
  - Wallet transactions via Mysten dApp Kit

Fastify backend
  - SQLite event/reservation/settlement cache
  - Sui event poller
  - Dashboard-friendly API responses

Sui Move package
  - Event object
  - EventVault<T>
  - Reservation object
  - SettlementReceipt object
  - EventCreated / ReservationCreated / CheckedInAndRefunded / EventSettled events
```

The backend is an index/cache layer only. It does not control vault funds.

## Repository Layout

```text
noflake-sui/
  contracts/
    Move.toml
    Published.toml
    sources/
    tests/
  backend/
    src/
  frontend/
    public/
    src/
  scripts/
    sui.ps1
```

## Tech Stack

- Sui CLI 1.73.0
- Sui Move 2024 edition
- Node.js 22.x
- npm workspaces
- TypeScript 5.9
- React 19
- Vite 8
- Mysten dApp Kit React 2.0.3
- Mysten Sui SDK 2.17.0
- Fastify 5
- SQLite via better-sqlite3 12
- Vitest 4

## Testnet Deployment

Network:

```text
Sui testnet
```

Package ID:

```text
0xd4936b362763713dd61fe8bb17fb6c80857ab8a96e91f132ab3f57970ebd37ef
```

Publish transaction digest:

```text
AuH5BAga1jGQgPH7tMhNSx7JrAcFetLboCcrXw7Rz4Tp
```

Circle testnet USDC coin type:

```text
0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
```

## Environment

Backend variables are documented in `backend/.env.example`:

```bash
HOST=127.0.0.1
PORT=8787
SUI_NETWORK=testnet
NOFLAKE_PACKAGE_ID=0xd4936b362763713dd61fe8bb17fb6c80857ab8a96e91f132ab3f57970ebd37ef
NOFLAKE_DB_PATH=noflake-cache.sqlite
NOFLAKE_POLL_INTERVAL_MS=5000
```

Frontend variables:

```bash
VITE_NOFLAKE_PACKAGE_ID=0xd4936b362763713dd61fe8bb17fb6c80857ab8a96e91f132ab3f57970ebd37ef
VITE_NOFLAKE_COIN_TYPE=0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
VITE_NOFLAKE_API_URL=http://127.0.0.1:8787
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the backend index/cache API:

```bash
npm run dev:backend
```

Start the frontend:

```bash
npm run dev
```

The Move wrapper requires `sui` on `PATH`. Its version must match
`contracts/Move.toml`; the wrapper stops instead of falling back to a bundled CLI.

Compile the Move package:

```powershell
npm run move:build
```

Run verification:

```powershell
npm run build
npm run test:backend
npm run lint -w frontend
npx vitest run
powershell -ExecutionPolicy Bypass -File scripts/sui.ps1 move test --path contracts
```

## Demo Script

Recommended demo:

1. Create `Sui Builder Dinner`.
2. Set `20 USDC` deposit, `3` seats, `Party Mode`.
3. Reserve seats from attendee wallets.
4. Open the reservation page and show the QR payload.
5. Host pastes the QR payload in check-in mode.
6. Host confirms `Check-in & refund`.
7. Attendee deposit is refunded immediately.
8. Leave one attendee as no-show.
9. Host settles the event.
10. Show `SettlementReceipt`, digest, and Sui Explorer links.

The hackathon demo is intentionally small, usually `3-5` attendees. This keeps settlement readable and avoids batching concerns during judging.

## Settlement Modes

Strict Mode:

- Check-in refunds attendees immediately.
- No-show deposits settle to the host.

Party Mode:

- Check-in refunds attendees immediately.
- No-show deposits are distributed to checked-in attendees.
- Any remainder is sent to the host by the Move contract.

## MVP Boundaries

Included:

- Event creation
- Stablecoin deposit reservation
- Reservation object and QR payload
- Host check-in confirmation
- Immediate check-in refund
- Final settlement
- Backend event indexing/cache
- Demo fallback controls and Explorer links

Excluded from MVP:

- Sponsor Mode
- waitlist
- `undo_check_in`
- ticket resale
- full ticket marketplace
- identity/GPS/photo proof
- batch settlement for large events
- full organizer CRM

## Known Constraints

- Demo events should be small, around `3-5` attendees.
- `undo_check_in` is intentionally not supported. Hosts must verify the confirmation screen before signing.
- The current UI uses manual QR payload paste as the reliable demo path. Scanner integration can be added later.
- Duplicate reservation prevention is enforced on-chain, and attendees can rejoin after a cancel.
- Settlement is gated by the event end time, so hosts cannot settle early.

## Why Sui

NoFlake uses Sui objects to model real payment commitments:

- `Event` stores event configuration and counters.
- `EventVault<T>` holds deposits under Move rules.
- `Reservation` represents the attendee's RSVP commitment.
- `SettlementReceipt` records final settlement.
- PTBs combine payment, state change, and object transfer into wallet-confirmable flows.
