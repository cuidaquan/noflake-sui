import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadConfig, parseConfig } from "./config";

describe("parseConfig", () => {
  test("maps environment variables to backend config", () => {
    const config = parseConfig({
      HOST: "0.0.0.0",
      PORT: "9000",
      SUI_NETWORK: "devnet",
      NOFLAKE_PACKAGE_ID: "0xabc",
      NOFLAKE_DB_PATH: "demo.sqlite",
      NOFLAKE_POLL_INTERVAL_MS: "2500",
    });

    expect(config).toEqual({
      databasePath: "demo.sqlite",
      host: "0.0.0.0",
      packageId: "0xabc",
      pollIntervalMs: 2500,
      port: 9000,
      suiNetwork: "devnet",
    });
  });

  test("loads backend config from an env file", () => {
    const directory = mkdtempSync(join(tmpdir(), "noflake-config-"));
    const envFilePath = join(directory, ".env");
    const keys = [
      "HOST",
      "PORT",
      "SUI_NETWORK",
      "NOFLAKE_PACKAGE_ID",
      "NOFLAKE_DB_PATH",
      "NOFLAKE_POLL_INTERVAL_MS",
    ];

    for (const key of keys) {
      delete process.env[key];
    }

    writeFileSync(
      envFilePath,
      [
        "HOST=127.0.0.2",
        "PORT=8788",
        "SUI_NETWORK=testnet",
        "NOFLAKE_PACKAGE_ID=0xenv",
        "NOFLAKE_DB_PATH=env-cache.sqlite",
        "NOFLAKE_POLL_INTERVAL_MS=7500",
      ].join("\n"),
    );

    try {
      const config = loadConfig(envFilePath);

      expect(config.packageId).toBe("0xenv");
      expect(config.databasePath).toBe("env-cache.sqlite");
      expect(config.port).toBe(8788);
    } finally {
      for (const key of keys) {
        delete process.env[key];
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
