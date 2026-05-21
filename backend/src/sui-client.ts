import type { BackendConfig } from "./config";

export interface SuiEvent {
  id: { txDigest: string; eventSeq: string };
  type: string;
  parsedJson?: unknown;
}

export interface SuiEventClient {
  queryEvents(input: {
    query: { MoveEventType: string };
    limit: number;
    order: "ascending" | "descending";
  }): Promise<{ data: SuiEvent[] }>;
}

export function createSuiClient(config: Pick<BackendConfig, "suiNetwork">): SuiEventClient {
  const url = fullnodeUrl(config.suiNetwork);

  return {
    async queryEvents(input) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [input.query, null, input.limit, input.order === "descending"],
        }),
      });

      if (!response.ok) {
        throw new Error(`Sui RPC request failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        error?: { message?: string };
        result?: { data?: SuiEvent[] };
      };

      if (payload.error) {
        throw new Error(payload.error.message ?? "Sui RPC request failed");
      }

      return { data: payload.result?.data ?? [] };
    },
  };
}

function fullnodeUrl(network: BackendConfig["suiNetwork"]): string {
  if (network === "mainnet") return "https://fullnode.mainnet.sui.io:443";
  if (network === "devnet") return "https://fullnode.devnet.sui.io:443";
  if (network === "localnet") return "http://127.0.0.1:9000";
  return "https://fullnode.testnet.sui.io:443";
}
