import { describe, expect, it, vi } from "vitest";
import { registerWfirmaTools } from "../src/tools.js";
import type { RawRequestInput } from "../src/client.js";

function fakeServer() {
  const tools = new Map<string, { definition: any; handler: Function }>();
  return {
    tools,
    registerTool(name: string, definition: any, handler: Function) {
      tools.set(name, { definition, handler });
    },
  };
}

const env = {
  WFIRMA_ACCESS_KEY: "access",
  WFIRMA_SECRET_KEY: "secret",
  WFIRMA_APP_KEY: "app",
};

describe("wFirma tools", () => {
  it("registers only the nine reviewed read tools", () => {
    const server = fakeServer();
    registerWfirmaTools(server as any, { env });
    expect([...server.tools.keys()].sort()).toEqual([
      "wfirma_get_contractor",
      "wfirma_get_expense",
      "wfirma_get_invoice",
      "wfirma_get_payment",
      "wfirma_list_companies",
      "wfirma_list_contractors",
      "wfirma_list_expenses",
      "wfirma_list_invoices",
      "wfirma_list_payments",
    ]);
    for (const { definition } of server.tools.values()) {
      expect(definition.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
  });

  it("discovers companies without company_id", async () => {
    const server = fakeServer();
    const rawRequest = vi.fn(async (_input: RawRequestInput) => ({
      statusCode: 200,
      body: JSON.stringify({
        user_companies: { "0": { company: { id: "7654321", name: "Client", nip: "1111111111" } } },
        status: { code: "OK" },
      }),
    }));
    registerWfirmaTools(server as any, { env, rawRequest });
    const result = await server.tools.get("wfirma_list_companies")!.handler({});
    expect(rawRequest.mock.calls[0][0].url.searchParams.has("company_id")).toBe(false);
    expect(JSON.parse(result.content[0].text)).toEqual({
      status: "OK",
      companies: [{ id: "7654321", name: "Client", nip: "1111111111" }],
    });
  });

  it.each([
    ["wfirma_list_invoices", { companyId: "7654321", page: 2, limit: 25 }, "/invoices/find"],
    ["wfirma_get_invoice", { companyId: "7654321", id: "11" }, "/invoices/get/11"],
    ["wfirma_list_contractors", { companyId: "7654321" }, "/contractors/find"],
    ["wfirma_get_contractor", { companyId: "7654321", id: "12" }, "/contractors/get/12"],
    ["wfirma_list_expenses", { companyId: "7654321" }, "/expenses/find"],
    ["wfirma_get_expense", { companyId: "7654321", id: "13" }, "/expenses/get/13"],
    ["wfirma_list_payments", { companyId: "7654321" }, "/payments/find"],
    ["wfirma_get_payment", { companyId: "7654321", id: "14" }, "/payments/get/14"],
  ])("%s pins the explicit company id and reviewed endpoint", async (toolName, args, endpoint) => {
    const server = fakeServer();
    const rawRequest = vi.fn(async (_input: RawRequestInput) => ({
      statusCode: 200,
      body: JSON.stringify({ status: { code: "OK" } }),
    }));
    registerWfirmaTools(server as any, { env, rawRequest });
    await server.tools.get(toolName)!.handler(args);
    const request = rawRequest.mock.calls[0][0];
    expect(request.url.pathname).toBe(endpoint);
    expect(request.url.searchParams.get("company_id")).toBe("7654321");
  });
});
