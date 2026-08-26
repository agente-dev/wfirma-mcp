#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerWfirmaTools } from "./tools.js";

async function main(): Promise<void> {
  const server = new McpServer({ name: "wfirma-mcp", version: "1.0.0" });
  registerWfirmaTools(server, { env: process.env });
  await server.connect(new StdioServerTransport());
  console.error("[wfirma-mcp] ready — read-only company, invoice, contractor, expense, and payment tools.");
}

main().catch((error) => {
  console.error(`[wfirma-mcp] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
