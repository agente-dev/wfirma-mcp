import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(root, "coverage-manifest.json"), "utf8"));
const source = readFileSync(resolve(root, "src/tools.ts"), "utf8");

describe("wFirma coverage manifest", () => {
  it("keeps every shipped operation read-only and tied to source and tests", () => {
    expect(manifest.tools).toHaveLength(9);
    expect(manifest.tools.every((tool: any) => tool.risk === "read")).toBe(true);
    for (const tool of manifest.tools) {
      expect(source).toContain(tool.name.startsWith("wfirma_list_") ? "wfirma_list_" : "wfirma_get_");
      expect(existsSync(resolve(root, tool.sourceTest))).toBe(true);
    }
  });

  it("states excluded mutation categories explicitly", () => {
    expect(manifest.unsupportedOfficialApiCategories.some((item: any) => item.category.includes("add, edit, and delete"))).toBe(true);
    expect(manifest.unsupportedOfficialApiCategories.some((item: any) => item.category.includes("KSeF"))).toBe(true);
  });
});
