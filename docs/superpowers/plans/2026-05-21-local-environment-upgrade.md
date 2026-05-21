# Local Environment Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the NoFlake local development environment to the latest stable frontend and Sui toolchain versions, then verify builds still pass.

**Architecture:** Keep the repo structure unchanged. Update the frontend workspace dependencies to current stable releases, align the Move toolchain manifest with the latest Sui release line, and then reinstall dependencies so the lockfiles reflect the new versions.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, Sui mainnet-v1.72.2 toolchain

---

### Task 1: Update frontend dependency manifests

**Files:**
- Modify: `package.json`
- Modify: `frontend/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Update the dependency ranges**

```json
{
  "dependencies": {
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "@types/react": "^19.2.15",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.2",
    "typescript": "^5.9.3",
    "vite": "^8.0.13"
  }
}
```

- [ ] **Step 2: Reinstall workspace dependencies**

Run: `npm install`
Expected: `frontend/package-lock.json` is refreshed and the workspace resolves without peer dependency errors.

### Task 2: Update Sui Move toolchain metadata

**Files:**
- Modify: `contracts/Move.toml`
- Modify: `contracts/Move.lock`

- [ ] **Step 1: Update the Move toolchain version metadata**

```toml
[move.toolchain-version]
compiler-version = "1.72.2"
edition = "2024.beta"
flavor = "sui"
```

- [ ] **Step 2: Refresh the Move lockfile**

Run: `sui move build`
Expected: `contracts/Move.lock` is regenerated against the newer toolchain line and the package still compiles.

### Task 3: Verify the upgraded environment

**Files:**
- None

- [ ] **Step 1: Verify frontend build**

Run: `npm run build`
Expected: Vite + TypeScript build succeeds.

- [ ] **Step 2: Verify Move build**

Run: `sui move build`
Expected: Sui Move compilation succeeds.

- [ ] **Step 3: Commit**

```bash
git add package.json frontend/package.json package-lock.json contracts/Move.toml contracts/Move.lock
git commit -m "chore: upgrade local dev environment"
```