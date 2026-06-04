import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(__dirname, "styles.css"), "utf8");

describe("frontend styles", () => {
  it("wraps long reservation detail values inside the card", () => {
    expect(styles).toMatch(/\.detail-list strong\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/s);
  });
});
