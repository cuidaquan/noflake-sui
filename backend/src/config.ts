export interface BackendConfig {
  databasePath: string;
  host: string;
  packageId: string;
  port: number;
  suiNetwork: "testnet" | "mainnet" | "devnet" | "localnet";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  return {
    databasePath: env.NOFLAKE_DB_PATH ?? "noflake-cache.sqlite",
    host: env.HOST ?? "127.0.0.1",
    packageId: env.NOFLAKE_PACKAGE_ID ?? "",
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
