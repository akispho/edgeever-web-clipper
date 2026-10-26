# Validation record — 2026-10-26

## Confirmed locally

- Upstream baseline: 214 tests pass in the fixture’s expected America/Los_Angeles timezone; the original Shanghai-timezone run failed only the fixed-date YouTube template timestamp expectation.
- Adapted project: 242 tests pass across 22 files. New coverage includes URL normalization and credential boundaries, all six save behaviors, ambiguous titles across pagination, stale notebook IDs, version conflicts, partial image transfer, image authentication isolation, CommonMark image references/code examples, and destination settings UI recovery.
- `npm run typecheck`: pass.
- `npm run build:chrome`: pass. Three inherited webpack bundle-size/performance warnings remain; they are not suppressed.
- `npm run verify:build`: pass. Checks MV3 identity, required entry files, the root MIT license, absence of Obsidian URI saving in browser bundles, credential database isolation to the background bundle, and status UI.
- ZIP inspected: root manifest, MIT license and provenance present; no `.ts`, `.map`, logs, `.git`, `.DS_Store` or `node_modules` entries.
- Local static settings layout inspected in the in-app browser. JavaScript behavior is covered by jsdom settings tests; the static preview is not installed-extension acceptance.
- Real browser IndexedDB roundtrip passed with synthetic connection data, no network requests and no real credentials. This validates the transaction logic, not cross-browser extension-origin policies.

## Not yet verified

- Installation of this custom extension into the user’s actual Edge/Chrome profile.
- Authentication, write behavior and image rendering against the user’s real EdgeEver instance and its deployed version.
- Full live-page capture across websites, cookie-protected/CDN images, Firefox or Safari.
- Optional AI provider calls and remote provider-catalog refresh.
- Linux GitHub Actions CI execution, public repository publishing, marketplace submission or signed distributions.

## Implementation decisions

- New independent Git repository and feature branch: the starting sources were archives, not an existing user checkout.
- Added MIT CommonMark parser for position-aware image rewrites, rather than vendoring AGPL EdgeEver implementation code or using a fragile regex.
- Credentials live in extension-origin IndexedDB because retained highlighter content scripts need `storage.local`; no credentials are included in sync/export.
- Vitest fixes the upstream fixture timezone; production daily notes use the browser’s local calendar date.
- Removed native Obsidian launch, legacy URI, inert beta and official store controls. Saving stays in the extension with a visible status. Original copy/download/reader/template/highlighter functionality is retained.
- Image fetches omit cookies and reject redirects. Unavailable Markdown images keep their original URL and report partial success. Inline HTML image URLs remain source-linked in this preview.
- Explicit overwrite templates set EdgeEver’s overwrite flag, while retaining exact-title resolution and revision/session guards.

These are limits of this preview, not claims that the untested platforms or deployment versions work.

## Independent review and fix pass

A fresh reviewer checked the full adaptation against the upstream baseline. Four necessary findings were reproduced with regression tests and fixed: rich-text-only body protection for append/prepend, immutable save operation snapshots, reference-definition collision isolation, and Token workspace-switch selection recovery. The final suite is 242/242 green. A notebook-label ambiguity was treated as a destination correctness issue and resolved by reusing hierarchical labels. No minor findings remain deferred.

Conservative behavior: append/prepend into a note with meaningful contentJson but empty contentMarkdown is refused, rather than converting or erasing its existing rich-text content. Explicit overwrite remains an intentional replacement. Installed extension messaging, quick-clip timing, actual extension-origin storage isolation, proxy/auth behavior, rendered attachments and responsive behavior remain live acceptance items.

## Publication preparation

The local `main` branch is a clean, single-commit source snapshot for eventual publication; the local `work/edgeever-clipper` branch preserves development/review history. Publish only `main`, not all local branches: the development baseline included upstream marketing/native-wrapper assets that are excluded from the released source snapshot. No Git remote has been configured and no push has occurred.
