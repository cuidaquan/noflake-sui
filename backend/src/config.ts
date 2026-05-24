import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

export interface BackendConfig {
  databasePath: string;
  host: string;
  packageId: string;
  port: number;
  pollIntervalMs: number;
  suiNetwork: "testnet" | "mainnet" | "devnet" | "localnet";
}

export function loadConfig(envFilePath = ".env"): BackendConfig {
  if (existsSync(envFilePath)) {
    loadEnvFile(envFilePath);
  }

  return parseConfig(process.env);
}

export function parseConfig(env: NodeJS.ProcessEnv): BackendConfig {
  return {
    databasePath: env.NOFLAKE_DB_PATH ?? "noflake-cache.sqlite",
    host: env.HOST ?? "127.0.0.1",
    packageId: env.NOFLAKE_PACKAGE_ID ?? "",
    pollIntervalMs: Number(env.NOFLAKE_POLL_INTERVAL_MS ?? 5_000),
    port: Number(env.PORT ?? 8787),
    suiNetwork: parseNetwork(env.SUI_NETWORK),
  };
}

function parseNetwork(value: string | undefined): BackendConfig["suiNetwork"] {
  if (value === "mainnet" || value === "devnet" || value === "localnet") {
    return value;
  }

  return "testnet";
}
