import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(__dirname, "styles.css"), "utf8");
const appSource = readFileSync(resolve(__dirname, "App.tsx"), "utf8");

describe("frontend styles", () => {
  it("wraps long reservation detail values inside the card", () => {
    expect(styles).toMatch(/\.detail-list strong\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/s);
  });

  it("keeps the live scanner camera preview visible while scanning", () => {
    expect(styles).toMatch(/\.scanner\.active video\s*\{[^}]*opacity:\s*1;/s);
    expect(styles).toMatch(/\.scan-bars\s*\{[^}]*rgba\(255,\s*221,\s*88,\s*0\.12\)/s);
    expect(appSource).toContain("className=\"scanner-status\"");
    expect(styles).toMatch(/\.scanner-status\s*\{[^}]*display:\s*block;/s);
  });

  it("renders reservation QR codes large enough for camera scanning", () => {
    expect(appSource).toContain("<QRCodeSVG value={qrPayload} size={288} level=\"L\"");
  });

  it("offers QR image upload as a stable check-in fallback", () => {
    expect(appSource).toContain("Upload QR image");
    expect(appSource).toContain("accept=\"image/*\"");
    expect(styles).toMatch(/\.upload-action input\s*\{[^}]*display:\s*none;/s);
  });
});
