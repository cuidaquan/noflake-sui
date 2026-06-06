# NoFlake Sui Overflow 2026 Submission

## Project

NoFlake is a Sui-native programmable RSVP deposit settlement layer for small community events.

Free RSVPs are easy to abandon. NoFlake turns an RSVP into a refundable on-chain commitment: attendees reserve a seat with Circle testnet USDC, the deposit is held in an event-specific Move vault, and check-in immediately refunds the attendee. No-show deposits are settled by transparent Move rules.

## Track

Primary track: DeFi & Payments

NoFlake fits this track because it builds a real-world payment workflow on Sui: programmable deposits, immediate refunds, object-based receipts, and automatic no-show settlement.

## Links

- Live demo: https://cuidaquan.github.io/noflake-sui/
- Demo video: https://youtu.be/CmTM3TNDl-8
- DeepSurge project: https://www.deepsurge.xyz/projects/3c9d48b4-d0c4-4a4f-904a-4a6e91e7bd23
- Source code: https://github.com/cuidaquan/noflake-sui
- Sui Overflow 2026: https://overflow.sui.io/

## Testnet Proof

- Network: Sui testnet
- Package ID: `0xd4936b362763713dd61fe8bb17fb6c80857ab8a96e91f132ab3f57970ebd37ef`
- Publish digest: `AuH5BAga1jGQgPH7tMhNSx7JrAcFetLboCcrXw7Rz4Tp`
- Demo event ID: `0xa68fa833ceaa8fb6af92d6e91914e4c4849fb138ea1823d1a96dfce85672a056`
- Settlement receipt ID: `0x06c46a4492fa7bf1124bc351cfc8e299a2d4c108e6dd7e331490e024d25e16e1`
- Circle testnet USDC coin type: `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC`

Explorer links:

- Package: https://suiscan.xyz/testnet/object/0xd4936b362763713dd61fe8bb17fb6c80857ab8a96e91f132ab3f57970ebd37ef
- Demo event: https://suiscan.xyz/testnet/object/0xa68fa833ceaa8fb6af92d6e91914e4c4849fb138ea1823d1a96dfce85672a056
- Settlement receipt: https://suiscan.xyz/testnet/object/0x06c46a4492fa7bf1124bc351cfc8e299a2d4c108e6dd7e331490e024d25e16e1
- Settlement transaction: https://suiscan.xyz/testnet/tx/6RQYPonMU5hPDZVSC6w42dKh4SKNvYy6UFp1FmJeUFRB

## What It Does

- Lets a host create a deposit-backed event.
- Lets attendees reserve a seat with stablecoin deposits.
- Holds deposits in a Move vault instead of a backend-controlled account.
- Gives attendees reservation objects and QR check-in payloads.
- Lets the host check in attendees and refund deposits immediately.
- Settles no-show deposits after the event using either Strict Mode or Party Mode.
- Shows object IDs, transaction digests, and Sui Explorer links for verification.

## How It Works

The app has no backend. The deployed frontend is a static GitHub Pages site that reads Sui RPC events directly in the browser and rebuilds the event snapshot from package events. If public RPC indexing is unavailable during judging, it falls back to a bundled demo snapshot so the settled demo remains viewable.

The Move package owns the payment rules:

- `Event` stores event configuration and counters.
- `EventVault<T>` holds all deposits.
- `Reservation` represents an attendee's RSVP commitment.
- `SettlementReceipt` records the final settlement.
- Move events expose `EventCreated`, `ReservationCreated`, `CheckedInAndRefunded`, and `EventSettled`.

## Demo Video Structure

Target length: 2-3 minutes.

1. Problem: free RSVPs create unreliable attendance and wasted seats.
2. Solution: NoFlake uses refundable deposits on Sui to turn RSVP into a credible commitment.
3. Architecture: static React frontend, Sui Move vault, browser-side Sui event indexing, no backend cost.
4. Demo flow: create event, reserve seats, show QR payload, check in and refund, settle no-show deposit.
5. Proof: show Sui Explorer links for the package, demo event, settlement receipt, and transaction digest.
6. Close: NoFlake is a small but real payment primitive for communities, workshops, dinners, and meetups.

## Suggested Voiceover Script

Hi, this is NoFlake, a Sui-native RSVP deposit system for real-world community events.

Free RSVPs are convenient, but they are easy to abandon. Hosts overbook, seats go unused, and reliable attendees get a worse experience. NoFlake fixes that by turning an RSVP into a refundable on-chain commitment.

Here is the flow. A host creates an event with a seat count, a USDC deposit, and a settlement mode. Attendees reserve a seat by paying the deposit into an event-specific Move vault. The app creates a reservation object and a QR check-in payload.

At the event, the host checks in the attendee. The check-in transaction immediately refunds the attendee's deposit from the vault. If someone does not show up, the host settles after the event. In Strict Mode, no-show deposits go to the host. In Party Mode, no-show deposits are distributed to attendees who actually checked in.

This demo is fully on Sui testnet. The frontend is deployed as a zero-cost static GitHub Pages app. There is no backend server and no database. The browser rebuilds the event state from Sui package events, and the Move contract remains the source of truth for deposits, refunds, and settlement.

Now I will show the live demo. This event has three reserved seats, two checked-in attendees, and one no-show. You can see the reservation objects, the settlement receipt, and the transaction digest. Each item links to Sui Explorer so judges can verify the on-chain state directly.

NoFlake is intentionally focused: programmable RSVP deposits, immediate refunds, transparent no-show settlement, and a simple interface that community hosts can actually use.

## What We Built With

- Sui Move 2024 edition
- Sui testnet
- Circle testnet USDC
- React 19
- Vite 8
- TypeScript 5.9
- Mysten dApp Kit React
- Mysten Sui SDK
- GitHub Pages

## Challenges

- Keeping the settlement logic simple enough to demo while still using real Move vault custody.
- Making a static frontend reliable without a backend indexer.
- Producing a settled demo state that judges can inspect quickly without waiting for a live event timeline.
- Keeping the QR check-in flow demo-friendly while preserving wallet-confirmed transactions.

## Accomplishments

- Published a Sui testnet Move package.
- Implemented deposit-backed reservations and immediate check-in refunds.
- Implemented Party Mode settlement where no-show deposits reward checked-in attendees.
- Removed the backend and deployed the app with zero server cost.
- Added browser-side Sui event indexing with a static demo fallback.

## Next Steps

- Add a camera-based QR scanner in addition to manual payload paste.
- Add sponsor-funded event modes.
- Add optional organizer analytics.
- Add batch settlement support for larger events.
- Explore recurring event templates for communities.

## Submission Checklist

- [x] Public source repository
- [x] Working live demo
- [x] Sui testnet package ID
- [x] On-chain demo event and settlement receipt
- [x] Zero-cost frontend deployment
- [x] Demo video script
- [x] Final recorded demo video URL: https://youtu.be/CmTM3TNDl-8
- [x] Final Sui Overflow submission form: https://www.deepsurge.xyz/projects/3c9d48b4-d0c4-4a4f-904a-4a6e91e7bd23
