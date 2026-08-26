# Security policy

wFirma MCP handles an access/secret/app key triplet that can read every
company granted to those keys in your wFirma account. Treat those
credentials as high-sensitivity secrets.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through
[GitHub Security Advisories](https://github.com/agente-dev/wfirma-mcp/security/advisories/new).
If private advisories are unavailable, contact `security@agente.dev` and do
not include live credentials or customer data in the report.

Do not report credential exposure, authentication bypasses, or other security
issues in a public issue before maintainers have had a chance to investigate.

## Handling credentials safely

- Keep `WFIRMA_ACCESS_KEY`, `WFIRMA_SECRET_KEY`, and `WFIRMA_APP_KEY` outside
  source control and outside issue or PR text.
- Use test doubles for automated tests. This repository's test suite must not
  contact a live wFirma account.
- If a credential may have been exposed, revoke the keys in your wFirma panel
  immediately and then report the incident privately.
