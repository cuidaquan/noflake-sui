import { describe, expect, it } from "vitest";
import { publicAssetUrl } from "./public-assets";

describe("public asset urls", () => {
  it("uses the Vite base path for GitHub Pages project assets", () => {
    expect(publicAssetUrl("noflake-logo.png", "/noflake-sui/")).toBe("/noflake-sui/noflake-logo.png");
  });

  it("keeps root deployment asset paths rooted at slash", () => {
    expect(publicAssetUrl("noflake-logo.png", "/")).toBe("/noflake-logo.png");
  });
});
