# Contributing

This community fork adapts Obsidian Web Clipper to EdgeEver. Keep extraction, templates, accessibility and source formatting intact when changing the destination adapter.

Run `npm ci`, `npm test`, `npm run typecheck`, `npm run build:chrome` and `npm run verify:build` before submitting a change. Use synthetic fixtures and a disposable notebook; never commit instance URLs, API Tokens, captured private pages, browser profiles or generated bundles.

Put EdgeEver protocol changes in `src/utils/edgeever-client.ts`, save behavior in `edgeever-note-creator.ts`, and source-image handling in `page-images.ts`. Preserve the background message boundary and revision checks.

The default Vitest timezone matches the upstream fixed-date fixture. Production daily notes still use the local browser calendar date.

Report security issues through the private advisory link in `SECURITY.md`. CI tests, type-checks, builds and verifies the Chromium extension, but does not publish automatically.
