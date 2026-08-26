import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  extractWfirmaCompanies,
  loadWfirmaCredentials,
  saveWfirmaPortfolio,
  wfirmaRequest,
  type RawRequestInput,
} from "../src/client.js";

const credentials = { accessKey: "access", secretKey: "secret", appKey: "app" };

describe("wFirma client", () => {
  it("loads all three required credentials without exposing them in a URL", async () => {
    expect(loadWfirmaCredentials({
      WFIRMA_ACCESS_KEY: " access ",
      WFIRMA_SECRET_KEY: " secret ",
      WFIRMA_APP_KEY: " app ",
    })).toEqual(credentials);
    const rawRequest = vi.fn(async (_input: RawRequestInput) => ({
      statusCode: 200,
      body: JSON.stringify({ status: { code: "OK" }, invoices: {} }),
    }));
    await wfirmaRequest(credentials, {
      module: "invoices",
      action: "find",
      companyId: "1234567",
    }, rawRequest);
    const input = rawRequest.mock.calls[0][0];
    expect(input.url.toString()).toContain("company_id=1234567");
    expect(input.url.toString()).not.toContain("access");
    expect(input.headers).toMatchObject({ accessKey: "access", secretKey: "secret", appKey: "app" });
  });

  it("fails closed when the API status is not OK even on HTTP 200", async () => {
    await expect(wfirmaRequest(credentials, {
      module: "user_companies",
      action: "find",
    }, async () => ({ statusCode: 200, body: JSON.stringify({ status: { code: "AUTH" } }) })))
      .rejects.toThrow("wfirma_api_AUTH");
    await expect(wfirmaRequest(credentials, {
      module: "user_companies",
      action: "find",
    }, async () => ({ statusCode: 200, body: "AUTH" })))
      .rejects.toThrow("wfirma_api_AUTH");
  });

  it("rejects NIP-like or otherwise invalid company ids before transport", async () => {
    const rawRequest = vi.fn(async (_input: RawRequestInput) => ({ statusCode: 200, body: "{}" }));
    await expect(wfirmaRequest(credentials, {
      module: "invoices",
      action: "find",
      companyId: "PL 1111111111",
    }, rawRequest)).rejects.toThrow("wfirma_company_id_invalid");
    expect(rawRequest).not.toHaveBeenCalled();
  });

  it("normalizes nested user-company records while keeping id and NIP distinct", () => {
    expect(extractWfirmaCompanies({
      user_companies: {
        "0": { user_company: { company: { id: "7654321", name: "Client A", nip: "1111111111" } } },
        "1": { user_company: { company: { id: "7654322", altname: "Client B", nip: "2222222222" } } },
        "2": { user_company: { id: "99", company_id: "7654323", company_name: "Client C", company_nip: "3333333333" } },
      },
      status: { code: "OK" },
    })).toEqual([
      { id: "7654321", name: "Client A", nip: "1111111111" },
      { id: "7654322", altname: "Client B", nip: "2222222222" },
      { id: "7654323", name: "Client C", nip: "3333333333" },
    ]);
  });

  it("persists the discovered portfolio with owner-only file permissions", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "agente-wfirma-portfolio-"));
    try {
      const filePath = path.join(directory, "connectors", "wfirma-portfolio.json");
      await saveWfirmaPortfolio(filePath, [{ id: "7654321", name: "Client", nip: "1111111111" }]);
      expect(JSON.parse(await readFile(filePath, "utf8"))).toMatchObject({
        companies: [{ id: "7654321", name: "Client", nip: "1111111111" }],
      });
      if (process.platform !== "win32") expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
