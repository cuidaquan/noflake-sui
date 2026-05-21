# NoFlake on Sui

NoFlake is a programmable RSVP deposit settlement layer for small community events on Sui.

This repository contains the initial project skeleton for:

- a Sui Move package under `contracts/`
- a React + TypeScript frontend under `frontend/`

## Repository Layout

```text
noflake-sui/
  contracts/
    Move.toml
    sources/
    tests/
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

- Sui CLI
- Node.js
- npm
- TypeScript
- React
- Vite

## Next Steps

1. Implement the Move modules in `contracts/sources/`.
2. Add unit tests in `contracts/tests/`.
3. Build the event creation, reservation, and check-in flows in `frontend/src/`.
4. Add Sui wallet integration and transaction helpers.
