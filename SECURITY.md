# Security

This is a development preview. No public security reporting address has been configured yet; configure GitHub private vulnerability reporting and a security contact before public release.

Do not post API Tokens, private captures or browser storage in public issues. Revoke a leaked Token in EdgeEver immediately.

The destination Token is persistent in extension-origin IndexedDB. Content scripts cannot read that origin’s IndexedDB, but browser-profile access is outside this protection. API redirects are rejected; image downloads never carry the EdgeEver Token.
