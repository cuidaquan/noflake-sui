# NoFlake on Sui

NoFlake is a Sui-native programmable RSVP deposit settlement layer for small community events.

Free event RSVPs are easy to make and easy to abandon. NoFlake turns RSVP into a refundable on-chain commitment: attendees reserve a seat with a stablecoin deposit, hosts check them in on site, and the deposit is refunded immediately at check-in. No-show deposits are settled by transparent Move rules.

Primary hackathon track: `DeFi & Payments`

## Submission Quick Links

- Live demo: https://cuidaquan.github.io/noflake-sui/
- Demo video: https://youtu.be/CmTM3TNDl-8
- Hackathon submission guide: [SUBMISSION.md](SUBMISSION.md)
- Source repository: https://github.com/cuidaquan/noflake-sui
- Sui testnet package: `0x7d0b8b3e9b655e5dfe28592009a87f67f667fc6619319c89d786251d45150f5c`

## MVP Flow

1. Host creates a deposit-backed event.
2. Attendee reserves a seat with Circle testnet USDC.
3. The deposit is held in an event-specific Move vault.
4. Attendee receives a reservation object and a check-in QR payload.
5. Host scans, uploads, or pastes the QR payload, reviews a confirmation screen, and signs check-in.
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
  - Browser-side Sui event indexing

Sui Move package
  - Event object
  - EventVault<T>
  - Reservation object
  - SettlementReceipt object
  - EventCreated / ReservationCreated / CheckedInAndRefunded / EventCancelled / EventSettled events
```

The deployed app has no backend. The frontend rebuilds event snapshots directly from Sui RPC package events, and all RSVP, refund, and settlement authority remains in the Move package.

## Repository Layout

```text
noflake-sui/
  contracts/
    Move.toml
    Published.toml
    sources/
    tests/
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
- Vitest 4
- jsQR 1.4.0 for browser-side QR image decoding

## Testnet Deployment

Network:

```text
Sui testnet
```

Callable package ID:

```text
0x7d0b8b3e9b655e5dfe28592009a87f67f667fc6619319c89d786251d45150f5c
```

Original package / event namespace:

```text
0xd4936b362763713dd61fe8bb17fb6c80857ab8a96e91f132ab3f57970ebd37ef
```

Publish transaction digest:

```text
AuH5BAga1jGQgPH7tMhNSx7JrAcFetLboCcrXw7Rz4Tp
```

Upgrade transaction digest:

```text
9usm64stFzcfef4DTtpe38oLKLHxyjgNEzpxid6HeksU
```

Circle testnet USDC coin type:

```text
0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
```

## Environment

Frontend variables:

```bash
VITE_NOFLAKE_PACKAGE_ID=0x7d0b8b3e9b655e5dfe28592009a87f67f667fc6619319c89d786251d45150f5c
VITE_NOFLAKE_EVENT_PACKAGE_ID=0xd4936b362763713dd61fe8bb17fb6c80857ab8a96e91f132ab3f57970ebd37ef
VITE_NOFLAKE_COIN_TYPE=0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
```

Zero-cost frontend deployment variables:

```bash
VITE_BASE_PATH=/noflake-sui/
VITE_NOFLAKE_DEMO_EVENT_ID=0xa68fa833ceaa8fb6af92d6e91914e4c4849fb138ea1823d1a96dfce85672a056
VITE_NOFLAKE_PACKAGE_ID=0x7d0b8b3e9b655e5dfe28592009a87f67f667fc6619319c89d786251d45150f5c
VITE_NOFLAKE_EVENT_PACKAGE_ID=0xd4936b362763713dd61fe8bb17fb6c80857ab8a96e91f132ab3f57970ebd37ef
VITE_NOFLAKE_COIN_TYPE=0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
```

Set `VITE_NOFLAKE_STATIC_DEMO=true` only when you want to force the bundled `frontend/public/demo-event.json` snapshot instead of reading live package events from Sui RPC.

## Local Development

Install dependencies:

```bash
npm install
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
npm run lint -w frontend
npx vitest run
powershell -ExecutionPolicy Bypass -File scripts/sui.ps1 move test --path contracts
```

## Deployment

Recommended zero-cost deployment:

1. Enable GitHub Pages for this repository with source `GitHub Actions`.
2. Run the `Deploy frontend to GitHub Pages` workflow, or push to `main`.
3. Submit the GitHub Pages URL, for example:

```text
https://cuidaquan.github.io/noflake-sui/
```

The Pages workflow builds the Vite app as a static site. The app first tries to rebuild the event snapshot from Sui RPC package events, then falls back to `frontend/public/demo-event.json` if RPC indexing is unavailable. Judges can view the complete settled demo with no server, database, or sleeping free-tier backend.

## Demo Script

Recommended demo:

1. Create `Sui Builder Dinner`.
2. Set `20 USDC` deposit, `3` seats, `Party Mode`.
3. Reserve seats from attendee wallets.
4. Open the reservation page and show the QR payload.
5. Host scans, uploads, or pastes the QR payload in check-in mode.
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
- Camera-based QR scanning with JS decoder fallback, QR image upload, and manual paste fallback
- Host check-in confirmation
- Immediate check-in refund
- Attendee reservation cancellation and host event cancellation refund flows
- Final settlement
- Frontend Sui event indexing
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
- Camera QR scanning first uses browser-native detection when available, then falls back to JS frame decoding. If camera scanning is unreliable, hosts can upload a QR screenshot or paste the payload manually.
- Duplicate reservation prevention is enforced on-chain, and attendees can rejoin after a cancel.
- Settlement is gated by the event end time, so hosts cannot settle early.

## Why Sui

NoFlake uses Sui objects to model real payment commitments:

- `Event` stores event configuration and counters.
- `EventVault<T>` holds deposits under Move rules.
- `Reservation` represents the attendee's RSVP commitment.
- `SettlementReceipt` records final settlement.
- PTBs combine payment, state change, and object transfer into wallet-confirmable flows.
