# 自定义用量功能接入上游：2026-10-08

## 分支与提交

1. 原始功能分支 `feat/custom-usage`：`ae3bfa35695a29fe998d33747a35108c2e4aca28`。本次没有重写其历史。
2. `main` 本地快进到上游 `b0fbcfd6a7e919743856dcd96198897baa92593e`，新增 379 个提交；main 保持纯上游。
3. `develop` 经验证后本地快进到 `93b7b80120cb472b71bdbba173976d0bcb999e3c`；只包含上游、Windows/区域设置测试适配和 [基线验证记录](2026-10-08-upstream.md)。
4. 从原功能分支创建 `sync/custom-usage-20261008-b0fbcfd6`，用正常 merge 接入 develop，合并提交 `4116417ca06ba84830b6e3183747c33df8a0d285`。四处现有生产文件重叠，ort 自动合并无文本冲突；定制领域文件本身与原功能提交一致。
5. 验证通过后才本地快进 `feat/custom-usage` 到临时集成分支；功能未反向合入 main 或 develop。

## 自定义功能的组合验证

- Python 标准库模板：3 项通过；只使用测试用隔离数据，不读取真实用户配置。
- 自定义功能、状态栏、账户设置、Claude 回归等：19 个文件、185 个用例通过，无跳过。
- 相对 main 的 changed-code quality：43 个受检文件，新问题数均为 0；包括类型感知、React Doctor、设计系统。
- `pnpm build` 通过：Node/Web/CLI TypeScript、relay、Electron、Web、Mobile Web 和 Windows 原生阶段。
- 恢复 Electron 原生运行时后重编译隔离 CDP 夹具，隐藏窗口中验证设置草稿测试、保存后即时启用、真实 Python stdout、左下角统一 Usage、详细/紧凑及 +1 折叠、设置跳转、禁用。
- 测试窗口 `show:false`，实际记录 `visible:false` / `focused:false`，无 show/focus 事件，不使用 computer-use、真实用户资料或原生文件选择器。当前未安装 `$electron` skill，按仓库约束直接使用 Playwright CDP；不是完整桌面产品、真实 SSH 或移动端现场验收。

## 本地日志与边界

- `.git/fork-sync-20261008-feature-python.log`
- `.git/fork-sync-20261008-feature-tests.log`
- `.git/fork-sync-20261008-feature-quality.log`
- `.git/fork-sync-20261008-feature-build.log`
- `.git/fork-sync-20261008-feature-cdp.log` 和 `.git/fork-sync-20261008-cdp/` 中的截图及隐藏窗口状态

本次只请求上游同步、合并和编译；不推送 origin/upstream，不签名发布，不替换用户已安装软件，也不触碰真实用户账号及手机配对数据。

上游 `package.json` 版本仍为 `1.4.214`；此前 `dist/win-unpacked/Orca.exe` 是 2026-10-04 打出的旧目录，`pnpm build` 更新 `out/`，**不会刷新这个免安装桌面程序**。若以后需要 Oct 8 源码对应的 `Orca.exe`，须另执行并验证打包。
