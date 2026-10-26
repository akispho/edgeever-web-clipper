# GitHub 发布

公开仓库:https://github.com/akispho/edgeever-web-clipper
仅发布经过验证的版本,并使用 GitHub Releases 分发安装包和源码包。

- `main`:公开源码和发布基线,包含 MIT 许可证、上游来源、安装说明和测试构建 CI。
- `work/edgeever-clipper`:本地开发与审阅历史。不要使用 `git push --all`;开发基线历史曾包含上游许可排除的品牌/商店资源,当前发布快照已移除这些文件。
- `builds/*-source.zip`:不包含 `.git`、依赖、构建输出或本地浏览器设置的源码包。
- `builds/*-chrome.zip`:加载到 Chromium 浏览器的扩展包。

发布前运行测试、类型检查、构建、产物校验和生产依赖漏洞审计。Release 同时上传 Chromium ZIP、源码 ZIP 和 `SHA256SUMS.txt`;CI 不会自动上传任何产物。
