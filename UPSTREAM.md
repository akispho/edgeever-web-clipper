# Upstream provenance

Based on https://github.com/obsidianmd/obsidian-clipper, upstream package version 1.7.1. Main-branch archive retrieved on 2026-10-26. Archive SHA-256: `8afe151f3861ffd666c06bde37b6d7ecd87a26cc9541900f887446d9b1b48cbb`. The archive is not a Git checkout, so no unverified commit SHA is claimed.

Original source is MIT, copyright 2024 Obsidian; the original LICENSE is preserved. Obsidian trademarks, app icons and store/marketing assets are excluded from the upstream source license. This fork removes the original assets and native Safari wrapper and uses a newly drawn E/page icon. It is not affiliated with Obsidian or EdgeEver.

EdgeEver https://github.com/tianma-if/edgeever was read to identify REST contracts. Its AGPL source is not vendored into this MIT fork. The EdgeEver-specific adapter is newly written.

The retained extraction and template engine depend on their original packages. The new CommonMark image parser uses MIT mdast-util-from-markdown. Dependency licenses and transitive notices remain available through the package lock and installed packages; conduct a full distribution license review before a public release.
