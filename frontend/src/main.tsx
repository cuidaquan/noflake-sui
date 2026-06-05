import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createDAppKit, DAppKitProvider } from "@mysten/dapp-kit-react";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import App from "./App";
import { shouldEnableBurnerWallet } from "./dapp-kit-config";
import "./styles.css";

const queryClient = new QueryClient();
const dAppKit = createDAppKit({
  networks: ["testnet"],
  defaultNetwork: "testnet",
  enableBurnerWallet: shouldEnableBurnerWallet(),
  createClient: () =>
    new SuiJsonRpcClient({
      network: "testnet",
      url: getJsonRpcFullnodeUrl("testnet"),
    }),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <App dAppKit={dAppKit} />
      </DAppKitProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
