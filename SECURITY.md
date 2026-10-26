# Security

Report vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/akispho/edgeever-web-clipper/security/advisories/new).
Do not disclose suspected vulnerabilities, private captures or browser data in a public issue.

Do not post API Tokens, private captures or browser storage in public issues. Revoke a leaked Token in EdgeEver immediately.

The destination Token is persistent in extension-origin IndexedDB. Content scripts cannot read that origin’s IndexedDB, but browser-profile access is outside this protection. API redirects are rejected; image downloads never carry the EdgeEver Token.
