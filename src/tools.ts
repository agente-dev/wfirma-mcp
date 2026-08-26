import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  extractWfirmaCompanies,
  loadWfirmaCredentials,
  saveWfirmaPortfolio,
  wfirmaRequest,
  type RawRequest,
} from "./client.js";

export interface WfirmaToolDeps {
  env: Record<string, string | undefined>;
  rawRequest?: RawRequest;
}

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const companyIdField = z.string().regex(/^[0-9]+$/).describe(
  "Internal wFirma company id returned by wfirma_list_companies. Never use a NIP here.",
);
const recordIdField = z.string().regex(/^[0-9]+$/).describe("wFirma record id.");
const pageField = z.number().int().min(1).optional().describe("Page number, starting at 1.");
const limitField = z.number().int().min(1).max(100).optional().describe("Records per page, up to 100.");

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function findBody(module: string, page = 1, limit = 50): Record<string, unknown> {
  return { [module]: { parameters: { page, limit } } };
}

export function registerWfirmaTools(server: McpServer, deps: WfirmaToolDeps): void {
  const call = (input: Parameters<typeof wfirmaRequest>[1]) => wfirmaRequest(
    loadWfirmaCredentials(deps.env),
    input,
    deps.rawRequest,
  );

  server.registerTool(
    "wfirma_list_companies",
    {
      title: "List wFirma companies",
      description: "Discover the client companies available to this wFirma accounting-office account. Returns internal company ids and NIPs separately.",
      inputSchema: {},
      annotations: readAnnotations,
    },
    async () => {
      const payload = await call({ module: "user_companies", action: "find" });
      const companies = extractWfirmaCompanies(payload);
      await saveWfirmaPortfolio(deps.env.WFIRMA_PORTFOLIO_PATH, companies);
      return ok({ status: "OK", companies });
    },
  );

  const resources = [
    ["invoices", "invoice"],
    ["contractors", "contractor"],
    ["expenses", "expense"],
    ["payments", "payment"],
  ] as const;

  for (const [module, singular] of resources) {
    server.registerTool(
      `wfirma_list_${module}`,
      {
        title: `List wFirma ${module}`,
        description: `List ${module} for one explicitly selected wFirma client company.`,
        inputSchema: { companyId: companyIdField, page: pageField, limit: limitField },
        annotations: readAnnotations,
      },
      async ({ companyId, page, limit }) => ok(await call({
        module,
        action: "find",
        companyId,
        body: findBody(module, page, limit),
      })),
    );

    server.registerTool(
      `wfirma_get_${singular}`,
      {
        title: `Get wFirma ${singular}`,
        description: `Read one ${singular} from one explicitly selected wFirma client company.`,
        inputSchema: { companyId: companyIdField, id: recordIdField },
        annotations: readAnnotations,
      },
      async ({ companyId, id }) => ok(await call({
        module,
        action: "get",
        companyId,
        id,
      })),
    );
  }
}
