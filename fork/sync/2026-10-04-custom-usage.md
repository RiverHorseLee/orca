# 自定义用量功能接入上游：2026-10-04

## 顺序与分支

1. 先将功能提交 `52cb3cbf0cd86a7b9dbbb1bf60b6a6b218b9b114` 推送到 origin/feat/custom-usage，保护已有工作。
2. 拉取 upstream/main 的 `ea6a6d60774ac2b74bb6692d1798e3ab13b99ae0`，main 只快进；共接入 31 个上游提交。
3. 通过临时分支验证上游，并把 develop 推进到 `583213a457a27f2e582924af6ac74cf0060bc062`；见 [上游同步报告](2026-10-04-upstream.md)。
4. 从原功能分支创建 `sync/custom-usage-20261004-ea6a6d60`，合并已验证的 develop；合并提交为 `927c3fabd725642d2fd8ecd38316c729218e9700`，没有文本冲突。
5. 功能验证通过后才快进 feat/custom-usage，并以普通 push 更新远端；不 squash、不 rebase、不强推。

main 保持纯上游，develop 只接入上游和 Windows 测试兼容修正。自定义功能没有反向合入 develop/main，仍保留在功能分支。

## 结果

- 自定义功能与关联设置/Usage 回归：16 个文件，123 个用例全部通过，无跳过；包括真实 Python 路径和终止测试。
- Python 标准库模板：3 个用例通过。
- 相对 main 的完整 fork 增量质量：代码质量、类型感知、React Doctor、设计系统、断言检查均通过。
- 完整 `pnpm build` 成功：包含类型检查、Electron/CLI/Web/Mobile Web 和本机原生构建。
- 重新构建隐藏 Electron 测试入口并通过 CDP 检查：草稿测试、保存即启用、左下角统一 Usage、详细/紧凑、+N 折叠、设置导航、关闭功能。
- 隔离窗口 `visible=false`、`focused=false`，没有 show/focus 事件；未使用 computer-use，也未触及真实用户配置或凭据。
- 合并后的 custom-usage 源码与已推送功能提交保持一致；上游没有直接改动这些领域文件。

所有测试/应用验证均设置 `ORCA_BACKGROUND_LAUNCH=1`。当前没有 `$electron` skill，沿用直接 Playwright CDP 的隔离夹具；其他提供商服务和外壳被替换，不能把它当成完整用户会话或真实 SSH/手机验收。

## 本地证据

- `.git/fork-sync-feature-tests.log`
- `.git/fork-sync-python-tests.log`
- `.git/fork-sync-feature-quality.log`
- `.git/fork-sync-feature-build.log`
- `.git/fork-sync-feature-cdp.log`
- `.git/custom-usage-v2-ui/window-state.json` 和同目录截图

上游验证另外通过 274 个回归用例。Windows sftp 测试的 POSIX 文件夹具问题已修正，没有跳过测试或改变产品逻辑；跨架构打包守卫所需依赖按 install:release 政策补齐。

## 边界

- 本次上游 main 的包版本仍为 `1.4.214`；不会仅为了匹配本机 1.4.220 而伪造版本号。
- 未替换本机安装、迁移用户数据、关闭官方更新、构建签名安装包或发布软件版本。
- 临时同步分支保留用于审阅；不自动删除分支。
- 本报告记录验证时的 SHA；最终功能分支顶端还包含本报告提交，以 Git 历史为准。
