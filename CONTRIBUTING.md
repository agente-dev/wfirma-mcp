# Contributing to wFirma MCP

Thanks for helping improve this unofficial connector.

## Before opening a change

1. Read the [security policy](SECURITY.md) and do not include credentials
   or customer data in issues, PRs, or test fixtures.
2. For API behavior changes, cite the relevant page of the official
   documentation at [doc.wfirma.pl](https://doc.wfirma.pl/) or describe the
   live-account evidence needed for follow-up. Keep undocumented assumptions
   explicit in code comments.
3. Preserve the compatibility identifiers unless the change includes a
   migration plan: `wfirma-mcp` package/CLI, `wfirma_*` tools, and
   `WFIRMA_*` environment variables.
4. Keep the surface read-only. New tools must be listed in
   `coverage-manifest.json` (with endpoint, risk class, and the test that
   proves them) — the coverage test enforces this.

## Local checks

Use Node.js 20 or newer and pnpm:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

The tests mock all HTTP traffic. Do not add tests that require a live
account.
