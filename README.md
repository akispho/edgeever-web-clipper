# EdgeEver Web Clipper

A community fork of **Obsidian Web Clipper** that saves directly to **EdgeEver**.

保留 Obsidian Clipper 的正文抽取、模板、变量、过滤器、划线、阅读模式、侧栏和剪藏预览；保存为 EdgeEver 中可阅读编辑的笔记，图片上传到笔记附件库。

**Preview / 开发预览版**:Chromium 构建与 Edge 安装已验收;Firefox、Safari 和完整跨站验收尚未完成。它不是 Obsidian 或 EdgeEver 官方扩展,没有官方商店发布。

## 安装与配置

1. 解压构建 ZIP，或从源码运行以下命令生成 `dist/`。
2. 打开 `edge://extensions` 或 `chrome://extensions`，开启开发者模式，加载已解压的扩展，选择包含 `manifest.json` 的目录。
3. 打开扩展设置，填写 EdgeEver 实例地址和 API Token，点击 **连接并保存**。
4. 连接成功后选择默认笔记本，再次点击保存。重新打开剪藏窗口即可使用。
5. 在网页上打开扩展，预览正文，选择模板和笔记本，点击 **保存到 EdgeEver**。

详见 [中文安装与配置](docs/安装与配置.md)。

## Build / 开发

Requires Node.js **22.12+** (or Node.js 24+) and npm. Lockfile installs are reproducible with `npm ci`.

```sh
npm ci
npm test
npm run typecheck
npm run build:chrome
npm run verify:build
```

`dist/` is the unpacked Chromium extension. `builds/edgeever-web-clipper-0.1.3-chrome.zip` is the installable unpacked archive. Build output and credentials are not committed.

Firefox build metadata is retained for follow-up work, but Firefox installation and behavior are not verified. Safari app packaging is not included; this fork does not claim Safari support.

## Destination mapping / 保存规则

| Clipper concept | EdgeEver behavior |
| --- | --- |
| Vault | Notebook, bound by its ID |
| Destination | Saves directly to the selected notebook. Enable “New sub-notebook” and enter a name only when you want to create a child notebook. Existing template paths are not applied automatically. |
| Create | New editable Markdown memo, tagged `web-clip` |
| Append / prepend | Find the unique exact title within the selected notebook; create it if absent |
| Daily note | Local calendar date `YYYY-MM-DD` in the selected notebook |
| Overwrite | Explicitly replace the unique matching note, with revision and edit-session guards |
| Images | Copy up to 30 images, 20 MiB each, 60 MiB total, with a transfer time budget |
| Copy / download | Original local actions remain available |

Append/prepend refuses rich-text-only targets whose Markdown body is empty, protecting the existing rich-text document. Resolve/convert such notes in EdgeEver before appending. Template frontmatter remains in the Markdown. Note tags currently include `web-clip`; YAML properties are preserved as content, not mapped into extra EdgeEver metadata fields. Imported Obsidian templates may need their destination rebound to an EdgeEver notebook.

Images blocked by their source site, redirects, unsupported MIME types, expired URLs, inline HTML images or size/time limits may remain remote; a partial-save message reports the outcome for parsed Markdown images. This preview does not bypass site authentication or copy videos as attachments. Uploads completed before a version conflict may remain as note attachments; it never deletes the note automatically to undo an error.

## Privacy / 数据流

The EdgeEver Token is stored in the extension origin’s IndexedDB, separate from `storage.local` used by highlighting content scripts. It is not returned to UI pages, synced, exported, logged or sent with image downloads. This is local browser storage, **not encrypted secret storage**; anyone with access to the browser profile can access it.

Authenticated EdgeEver requests refuse redirects. Image downloads carry no EdgeEver Token and omit cookies. Page captures are sent only when you use the save action. Optional AI Interpreter requests follow the upstream feature and use the provider you configure. The retained provider preset catalog is fetched from the upstream public GitHub URL.

The extension retains broad webpage access for upstream reading/highlighting and cross-origin image capture. Do not install it into a browser profile you do not trust.

## Open source / 开源

MIT. Original copyright and license are retained in [LICENSE](LICENSE). See [upstream provenance](UPSTREAM.md), [contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md).

The public source repository is [akispho/edgeever-web-clipper](https://github.com/akispho/edgeever-web-clipper). Only the `main` snapshot is published; internal development branches are not part of the public repository. CI only tests and builds and does not publish automatically.
