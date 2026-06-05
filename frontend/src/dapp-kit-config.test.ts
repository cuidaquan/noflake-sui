import { describe, expect, it } from "vitest";
import { shouldEnableBurnerWallet } from "./dapp-kit-config";

describe("dApp Kit config", () => {
  it("disables the burner wallet for production builds by default", () => {
    expect(shouldEnableBurnerWallet("production")).toBe(false);
  });

  it("keeps the burner wallet available during local development", () => {
    expect(shouldEnableBurnerWallet("development")).toBe(true);
  });

  it("allows the burner wallet to be explicitly enabled for a demo build", () => {
    expect(shouldEnableBurnerWallet("production", "true")).toBe(true);
  });
});
