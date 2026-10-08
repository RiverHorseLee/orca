# 初始化与环境补齐验证记录

> 2026-10-08 本地同步和完整编译已验证，详见 [上游基线记录](sync/2026-10-08-upstream.md) 与 [自定义功能集成记录](sync/2026-10-08-custom-usage.md)。本页其余内容保留各阶段当时的验证事实，不能代替最新集成记录。

日期：2026-10-04（Asia/Shanghai）。本记录描述本次实际检查，不宣称将来仍是最新上游。

最新提交与同步验证见 [上游同步记录](sync/2026-10-04-upstream.md) 和 [自定义功能集成记录](sync/2026-10-04-custom-usage.md)。下文保留各阶段当时的验证状态。

## Git 和改动范围

- 上游基线：`2b1acd0d0e686a5a59627920d62153a95ecf8fa7`。
- 原始克隆基线：`5df67eff3e`；同步了 2 个上游提交。
- `main` 保持纯上游；定制维护材料仅新增在 `fork/`。
- 初始化长期分支 `develop`，另准备 `feat/custom-usage`；最终远端状态以本次任务结果和 `git branch -vv` 为准。
- 初始化维护结构时没有改动应用源码；自定义用量首版的改动与验证见后文。包清单、锁文件、原生补丁、官方发布配置和上游忽略规则保持不变。
- 当前已实现 Python stdout 样例、AI 提供商账户中的自定义设置及左下角统一 Usage 展示；没有配置真实供应商 API 或为真实用户启用功能。

## 环境

- Windows x64；Node v24.12.0；项目指定 pnpm 12.8.1。
- pnpm shim 位于本 worktree 的 Git 私有目录 `fork-tools`，没有修改全局 Node 安装或为 pnpm 持久化 PATH。
- 根工程与独立 `mobile/` 工程均使用 `pnpm install --frozen-lockfile`，未更新锁文件。
- Skill 校验使用 Git 私有目录内的 Python venv 和 PyYAML，不修改用户全局 Python 包。
- 所有测试和 agent 启动的程序都设置 `ORCA_BACKGROUND_LAUNCH=1`，未打开 Orca 可见窗口。

## 执行结果

| 检查                                     | 结果         | 说明                                                                                     |
| ---------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| 根依赖安装                               | 通过         | 包含 Electron 下载和本机原生依赖安装                                                     |
| mobile 独立依赖安装                      | 通过         | 完整 build 的 Mobile Web 阶段需要，根 install 不会代装                                   |
| 类型检查                                 | 通过         | 完整构建中的 node/web/cli typecheck 已成功                                               |
| Relay 构建                               | 通过，有提示 | Windows relay 缺少专用预构建进程表模块，现有构建器提示其回退路径；没有声称该运行时已验证 |
| CLI / Electron main / preload / renderer | 通过         | `out/` 下生成对应产物                                                                    |
| 内置 skills CLI 校验                     | 通过         | 644 closure files、5 commands                                                            |
| Web 投影                                 | 通过         | 投影并通过现有校验                                                                       |
| Mobile Web                               | 通过         | 123 assets，7,918,357 bytes，现有 bundle 校验成功                                        |
| Windows native CLI launcher              | 通过         | 补齐 Rust/Cargo 后实际完成 release 编译，生成 Windows x64 `orca.exe`                     |
| 完整 `pnpm build`                        | **通过**     | 2026-10-04 重跑退出码 0，包含此前缺少 Cargo 的 `build:native` 阶段                       |
| Skill 结构校验                           | 通过         | 两个 SKILL.md 通过 skill-creator 的 quick_validate.py                                    |
| Git 工作流演练                           | 通过         | 5 个本地 fixture 场景，未修改真实上游仓库                                                |

历史：首次 build 因未安装 mobile 依赖而失败；安装该独立工程后，第二次完成桌面/Web 阶段，停在 Cargo 缺失处。当时的 Rust 安装命令被执行环境策略拦截，该次任务没有绕过限制或跳过 native 阶段。

2026-10-04 用户明确要求补齐 Rust/Cargo 后，通过官方 rustup 完成安装并重跑完整构建。此前阻塞已解除；这里的通过结果不是以 `build:desktop` 代替完整 `pnpm build`。

## Rust/Cargo 环境补齐（2026-10-04）

- 官方 `rustup-init.exe` 下载文件与同源发布的 SHA-256 一致；安装进程在后台隐藏运行。
- 安装 `minimal` profile：rustc 1.99.0、cargo 1.99.0、rust-std；默认工具链 `stable-x86_64-pc-windows-msvc`。这是本机验证版本，不是项目新增的最低版本要求。
- 工具位于当前用户的 `~/.cargo/bin`，工具链位于 `~/.rustup`；复用已有的 Visual Studio 2022 MSVC 环境。
- 用户级 PATH 仅追加 Cargo 目录，原有条目保持原样；未修改系统级 PATH。现有应用/终端进程可能仍持有旧环境，需要重新打开。
- `rustc --version`、`cargo --version`、`rustup show active-toolchain` 均成功。
- 原样运行完整 `pnpm build`，退出码 0；没有修改依赖版本、锁文件、源码、原生补丁或伪造缓存。
- 原生 launcher 完成实际 release 编译，生成 `native/windows-cli-launcher/.build/orca.exe`（367,104 bytes）；构建器的 PE 动态 VC runtime 导入检查也通过。
- 仍有既有 CSS 优化、混合静态/动态导入、bundle 大小和 Windows relay 预构建提示；没有为消除这些提示修改上游代码。
- 本轮仅更新这份本地验证记录，未提交或推送；应用安装、签名和可见 UI 验收仍不在本轮范围内。

## 技能和 Git 安全验证

Git fixture 位于 Git 私有目录，验证了：

1. main 可快进到上游，且没有定制文件。
2. sync 分支保留真实合并祖先、上游修复和 fork 功能；验证前 develop 不前进。
3. 验证后可通过快进将 sync 结果接入 develop，不 squash。
4. 真实冲突停留在 sync 分支，develop 保持上一次验证的 SHA。
5. main 混入定制提交时祖先预检失败，不 reset、不强推。

这是分支命令流程的 fixture 演练，不是对未来所有冲突的保证，也不是另一个模型实际调用 skill 的端到端评估。

## 回归与质量检查

- `pnpm test src/main/claude/claude-structured-prompt-ownership.test.ts src/main/managed-data-accounts/profile-removal-recovery.test.ts`：2 个文件通过，32 个用例通过，2 个按上游 `skipIf(win32)` 跳过的文件符号链接用例；退出码 0。
- `pnpm exec oxfmt --write fork`：只格式化新增的 8 个文件；退出码 0。
- `ORCA_CODE_QUALITY_BASE=main pnpm run check:code-quality:changed`：退出码 0，报告没有变更的 JS/TS；这是文档改动的通过结果，不代表做了全量 lint。
- 两个 skill 的 frontmatter/结构通过 quick_validate.py；已安装到当前 `$CODEX_HOME/skills`，安装副本与版本源的 SHA-256 一致。
- `pnpm run build:desktop`：单独重跑成功，退出码 0；不包含 Cargo 的 native launcher 阶段。
- `pnpm run ensure:electron-runtime`：测试后恢复/检查 Electron 原生运行时，退出码 0。
- 文档校验：6 个 Markdown 文件、4 个本地链接、2 个 skill UI metadata，以及纯 main 上的规则读取路径通过。

## 自定义用量首轮原型（2026-10-04，已由下节修订替代）

### 改动范围

- 当前工作分支仍为 `feat/custom-usage`；未提交、推送或合并到 develop/main。
- 现有生产源码仅 3 处接线：主 IPC 注册、preload 初始化、状态栏组合；另在已有注册测试中添加 1 处 mock。
- 新代码按领域分离：版本化 DTO、用户级配置、有限 loopback HTTP reader、单实例订阅服务、本机桥、React 展示及相应测试。
- 没有改变 provider 枚举、账号登录、历史用量扫描、全局 store、远程 RPC/stream 或包依赖。
- Python 模板只返回固定 quota / percentage / amount，每次生成样例时间戳；Orca 不执行或管理 Python。
- 保留本文件之前的 Rust/Cargo 环境验证记录，没有覆盖用户其他改动。

### 本轮验证

| 项目                    | 结果                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Python 模板 unittest    | 4 个通过，标准库环境，无 pip 依赖                                                                                        |
| 新功能与原 IPC 注册回归 | 8 个文件、71 个测试全部通过                                                                                              |
| Typecheck               | `pnpm tc` 通过；最终完整 build 也重新检查 node/web/cli                                                                   |
| 增量代码质量            | 相对 develop 的 code-quality / casts / focused plugins / type-aware / React Doctor / design-system / SAFETY 均无新增问题 |
| 完整构建                | `pnpm build` 退出码 0，包含 Electron、CLI、Web、Mobile Web 和 Windows native launcher                                    |
| 隐藏 Electron CDP       | 真实 Python → HTTP → main IPC → preload → React 链路通过；亮色/暗色/服务不可用截图；禁用配置后控件和订阅移除             |
| 隐藏和焦点约束          | BrowserWindow 使用 `show:false`，记录为 `visible:false, focused:false`，无 show/focus 事件；没有 computer-use            |

后台运行均设置 `ORCA_BACKGROUND_LAUNCH=1`。CDP 使用独立临时 userData、假口令和重新编译的 main/preload，未读真实用户配置或账号。当前环境没有 `$electron` skill，因此使用项目依赖中的 Playwright 直接连接隐藏 Electron CDP，并明确保留这一技能可用性限制。

CDP 验证的是独立组件与真实本机数据链路，不等同于完整 Orca 用户会话、跨平台桌面或真实 SSH/WSL 的端到端验收。Web/Mobile/旧 bridge 降级、迟到响应、订阅清理、非法响应和限流由本轮单测覆盖。

本地证据（均不进 Git）：

- `.git/custom-usage-tests.log`、`.git/custom-usage-typecheck.log`、`.git/custom-usage-quality.log`
- `.git/custom-usage-build.log`
- `.git/custom-usage-ui/check.log`、`.git/custom-usage-ui/window-state.json`
- `.git/custom-usage-ui/usage-light.png`、`usage-dark.png`、`usage-unavailable.png`

启用说明：[Python 模板和用户配置](adapters/custom-usage/README.md)。首次启用/更换进程环境需重启 Orca；已有控件的刷新可重读配置，不声称存在文件自动监听。

## 左下角 Usage 与设置修订版（2026-10-04）

此节为当前实现；上节 HTTP 服务/右侧控件描述只保留作历史，不再是使用方法。

### 当前行为与最小接入

- 移除右侧独立入口和常驻 Python HTTP 模板；配置位于 AI 提供商账户的 Custom（自定义）区块。
- 可选择解释器/脚本绝对路径、显示名称、刷新间隔；确认信任后可测试，测试草稿不保存。
- 保存立即通知已有左下角 Usage 区；只配置自定义时也会显示，不受官方账号空态阻挡。
- 共用现有 Usage 弹层、刷新、详细/紧凑模式、已用/剩余偏好、+N 折叠和管理账户导航。
- 新采集使用共享 runProcess，固定 argv、输出上限、超时、取消和退出等待。设置预览与轮询串行执行，禁用/换源/退出不会让旧结果覆盖新状态。
- 现有生产源码只接入 8 个文件：IPC 注册、preload、退出等待、3 个状态栏展示文件、AccountsPane 和 settings-navigation-capability-sections；另补 1 处原注册测试 mock。没有修改官方 provider 枚举、全局 store、账号认证、远程协议或依赖。
- 复用原有 MiniBar、UsageOverflowChip、NumberField、SettingsSectionStack、原子安全写入和路径工具，不另建并行 UI 系统。

### 验证结果

| 检查                   | 结果                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Typecheck / 完整 build | `pnpm tc`、`pnpm build` 成功；包含 Windows native launcher 阶段                                                         |
| 功能与回归测试         | 15 个文件，118 个测试通过，无跳过；包含真实 Python、超时、设置草稿、路径、取消、退出等待及原设置/Usage 回归             |
| Python 模板            | 标准库 unittest 3 个通过，stdout 为单个 JSON                                                                            |
| 代码质量               | 相对 develop 的代码质量、类型感知、React Doctor、设计系统及断言检查均无新增问题                                         |
| 隐藏 CDP 操作          | 填写路径 → 确认信任 → 测试草稿 → 保存启用 → 左下角摘要 → 统一 Usage 菜单 → 紧凑模式 → 窄窗口 +1 → 返回设置 → 禁用均通过 |
| 焦点与隔离             | `show:false`、visible=false、focused=false，无 show/focus 事件；临时 userData、假配置，不改真实用户数据                 |

CDP 使用真实 StatusBarSurface / UsageRosterPanel / 密度测量、真实自定义设置组件、main IPC/preload 和 Python 进程；其他提供商/非本功能状态栏服务及设置外壳在隔离夹具中替换。它不是完整生产应用会话或跨平台验收。

当前没有 `$electron` skill；按仓库后台规则使用 Playwright 直接连接隐藏 Electron CDP。未使用 computer-use，未打开原生文件选择器；文件选择 IPC 的类型/信任边界通过单测，原生交互留给人工或隔离桌面。

日志与截图（仅本地）：

- `.git/custom-usage-revision-all-tests.log`、`.git/custom-usage-revision-tc.log`
- `.git/custom-usage-revision-quality.log`、`.git/custom-usage-revision-build.log`
- `.git/custom-usage-v2-ui/check.log`、`.git/custom-usage-v2-ui/window-state.json`
- `.git/custom-usage-v2-ui/settings-test.png`
- `.git/custom-usage-v2-ui/left-usage-light.png`、`left-usage-dark.png`、`left-usage-collapsed.png`

代码仍在 feat/custom-usage，未提交/推送。保留之前的 Rust/Cargo 验证和用户未提交改动。功能 skill 的版本源及已匹配的安装副本已同步到本修订的脚本/统一展示流程。

## 本地日志

日志不进 Git，也不应包含真实账号凭据：

- `.git/fork-install.log`、`.git/fork-mobile-install.log`
- `.git/fork-build.log`：第一次构建，缺少 mobile 依赖。
- `.git/fork-build-complete.log`：第二次构建，最终缺少 Cargo。
- `.git/fork-build-desktop.log`：独立桌面构建成功；`.git/fork-electron-runtime.log`：原生运行时检查成功。
- `.git/fork-rustup.stdout.log`、`.git/fork-rustup.stderr.log`：官方 Rust 安装日志。
- `.git/fork-build-rust-ready.stdout.log`、`.git/fork-build-rust-ready.stderr.log`：补齐 Rust 后完整构建成功的日志。
- `.git/fork-regression-tests.log`、`.git/fork-code-quality.log`
- `.git/fork-workflow-check.log`：5 个 Git fixture 场景。

Git worktree 中应使用 `git rev-parse --git-path <文件名>` 定位对应私有路径，不照抄其他 worktree 的绝对路径。

## 未验收事项

- Windows 安装包、签名、自动更新和真实安装/启动（Windows x64 native 编译已通过）。
- macOS/Linux 原生运行，真实 SSH/WSL，Web/Mobile 配对运行。
- 全量测试套件、真实 Claude CLI 账号测试、可见 UI 或 CDP 截图；本次 fork 没有 UI/运行时代码变更。
- 真实供应商 HTTP 接口和凭据对接；固定 Python stdout 模板、设置和左下角统一展示已验证。
