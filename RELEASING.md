# Releasing wFirma MCP

This repository separates source readiness from external publication. The
following gates require an explicit maintainer/operator decision and are not
performed by an ordinary code PR:

1. Confirm the public repository description, license, security reporting
   path, and trademark disclaimer.
2. Confirm CI is green from the exact commit to be published.
3. Decide separately whether to publish a registry package, create a
   release, or submit to an MCP registry. The package currently remains
   `private: true` as an accidental-publish guard.
4. Change GitHub visibility to public. This is an administrative cutover
   and must not be hidden in a code change.
5. After the cutover, verify the public clone, CI, package metadata, links,
   and security settings. Record the exact commit and any follow-up issues.
