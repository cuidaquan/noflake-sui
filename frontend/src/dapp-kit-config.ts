export function shouldEnableBurnerWallet(
  mode = import.meta.env.MODE,
  override = import.meta.env.VITE_ENABLE_BURNER_WALLET,
): boolean {
  if (override === "true") return true;
  if (override === "false") return false;
  return mode !== "production";
}
