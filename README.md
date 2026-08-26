# wFirma MCP

Unofficial, read-only MCP server for the [wFirma](https://wfirma.pl/) API v2
(`api2.wfirma.pl`). Gives MCP-compatible AI assistants typed, read-only access
to company data, invoices, contractors, expenses, and payments — with
credentials that never leave your machine and no commercial middleware between
you and wFirma.

Not affiliated with wFirma. "wFirma" is a trademark of its respective owner.

## Tools (9, all read-only)

| Tool | Endpoint |
|---|---|
| `wfirma_list_companies` | `GET /user_companies/find` |
| `wfirma_list_invoices` | `GET /invoices/find` |
| `wfirma_get_invoice` | `GET /invoices/get/{id}` |
| `wfirma_list_contractors` | `GET /contractors/find` |
| `wfirma_get_contractor` | `GET /contractors/get/{id}` |
| `wfirma_list_expenses` | `GET /expenses/find` |
| `wfirma_get_expense` | `GET /expenses/get/{id}` |
| `wfirma_list_payments` | `GET /payments/find` |
| `wfirma_get_payment` | `GET /payments/get/{id}` |

Every company-scoped tool requires the internal `companyId` returned by
`wfirma_list_companies`. A Polish NIP is **not** accepted as a company id.

## Why read-only

The server intentionally contains no add, edit, delete, send, fiscalization,
KSeF, or payment-mutation operation. The full list of excluded categories,
reviewed against the official documentation at
[doc.wfirma.pl](https://doc.wfirma.pl/), is recorded in
[`coverage-manifest.json`](coverage-manifest.json). If you need writes, use
wFirma's own tooling — not this server.

## Setup

### Credentials

wFirma API keys are created in your wFirma panel (Integrations → API).
Required environment variables:

- `WFIRMA_ACCESS_KEY`
- `WFIRMA_SECRET_KEY`
- `WFIRMA_APP_KEY`

See [`.env.example`](.env.example). Never commit real values.

### Build

```bash
pnpm install
pnpm build      # → dist/index.js (self-contained esbuild bundle)
pnpm test       # all HTTP traffic is mocked; no live account needed
```

### Claude Desktop / any stdio MCP client

```json
{
  "mcpServers": {
    "wfirma": {
      "command": "node",
      "args": ["/absolute/path/to/wfirma-mcp/dist/index.js"],
      "env": {
        "WFIRMA_ACCESS_KEY": "your-access-key",
        "WFIRMA_SECRET_KEY": "your-secret-key",
        "WFIRMA_APP_KEY": "your-app-key"
      }
    }
  }
}
```

### Claude Code / Cursor (scope: project)

```bash
claude mcp add wfirma -- node /absolute/path/to/wfirma-mcp/dist/index.js
```

## Design notes

- **No runtime dependencies beyond the MCP SDK and zod.** The client uses
  Node's stdlib `https` with a hard 20s timeout and a bounded response-size
  guard.
- **Fail-closed error taxonomy.** Missing credentials, non-numeric company
  ids, oversized responses, and auth failures each raise a distinct
  `wfirma_*` error code instead of a generic failure.
- **No PII in logs.** Tool parameters are never logged.
- **Coverage manifest.** `coverage-manifest.json` maps every tool to its
  endpoint, risk class, and the test that proves it; a CI test enforces the
  manifest stays in sync with the source.

## License

[MIT](LICENSE)
