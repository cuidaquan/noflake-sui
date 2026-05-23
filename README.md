# NoFlake on Sui

NoFlake is a programmable RSVP deposit settlement layer for small community events on Sui.

This repository contains the initial project skeleton for:

- a Sui Move package under `contracts/`
- a Fastify + SQLite cache backend under `backend/`
- a React + TypeScript frontend under `frontend/`

## Repository Layout

```text
noflake-sui/
  contracts/
    Move.toml
    sources/
    tests/
  backend/
    src/
  frontend/
    public/
    src/
  README.md
```

## Development Scope

The initial scaffold is intentionally minimal. It is set up to support the first implementation steps:

- define the Move objects and entry functions for events, reservations, and settlement
- build the host dashboard and attendee reservation/check-in flow
- wire the frontend to Sui testnet and Circle testnet USDC later

## Tooling

- Sui CLI 1.72.2
- Node.js 22.x
- npm
- TypeScript 5.9
- Fastify 5
- SQLite via better-sqlite3
- React 19
- Vite 8

Use `npm run move:build` to compile the Move package with the local Sui CLI pinned under `.local-tools/`.

## Local Development

Install dependencies:

```bash
npm install
```

Run verification:

```bash
npm run build
npm run test:backend
powershell -ExecutionPolicy Bypass -File scripts/sui.ps1 move test --path contracts
```

Start the backend cache API:

```bash
npm run dev:backend
```

Start the frontend:

```bash
npm run dev
```

The frontend reads `VITE_NOFLAKE_API_URL` when a deployed backend is available. Without a query-string `event` value, it renders a built-in demo state for local UI work.

## Testnet Configuration

The MVP targets Sui testnet and Circle testnet USDC:

```text
0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
```

The current NoFlake testnet package is:

```text
0x27e93520a24d483475c32e477ee723c815f4abd5403072597b1bbeb9748eef7c
```

Publish transaction digest:

```text
4r1nE8ckvtZ9bfaeFHT2haCGEgBbbzTHpQvw8fUJXsQ4
```

Backend environment variables are documented in `backend/.env.example`. Set `NOFLAKE_PACKAGE_ID` to the package ID above. The frontend should set:

```bash
VITE_NOFLAKE_PACKAGE_ID=0x27e93520a24d483475c32e477ee723c815f4abd5403072597b1bbeb9748eef7c
VITE_NOFLAKE_COIN_TYPE=0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
VITE_NOFLAKE_API_URL=http://127.0.0.1:8787
```

## Next Steps

1. Start the backend event poller from `backend/src/index.ts`.
2. Implement the real create-event flow in the host dashboard.
3. Complete the reserve-to-QR, check-in, and settlement demo flows.
4. Record the hackathon demo flow.
