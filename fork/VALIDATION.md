# 初始化验证记录

日期：2026-10-04（Asia/Shanghai）。本记录描述本次实际检查，不宣称将来仍是最新上游。

## Git 和改动范围

- 上游基线：`2b1acd0d0e686a5a59627920d62153a95ecf8fa7`。
- 原始克隆基线：`5df67eff3e`；同步了 2 个上游提交。
- `main` 保持纯上游；定制维护材料仅新增在 `fork/`。
- 初始化长期分支 `develop`，另准备 `feat/custom-usage`；最终远端状态以本次任务结果和 `git branch -vv` 为准。
- 没有改动应用源码、包清单、锁文件、原生补丁、官方发布配置或上游忽略规则。
- 用量功能仅完成方案；没有配置真实 API、启动 Python 适配器或实现控件。

## 环境

- Windows x64；Node v24.12.0；项目指定 pnpm 12.8.1。
- pnpm shim 位于本 worktree 的 Git 私有目录 `fork-tools`，没有修改全局 Node 安装或持久化 PATH。
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
| Windows native CLI launcher              | 阻塞         | `spawnSync cargo ENOENT`，本机缺少 Cargo                                                 |
| 完整 `pnpm build`                        | **未通过**   | 已完成桌面构建，但最后 `build:native` 阶段被缺少 Rust 工具链阻断                         |
| Skill 结构校验                           | 通过         | 两个 SKILL.md 通过 skill-creator 的 quick_validate.py                                    |
| Git 工作流演练                           | 通过         | 5 个本地 fixture 场景，未修改真实上游仓库                                                |

首次 build 先因未安装 mobile 依赖而失败；安装该独立工程后，第二次完成全部桌面/Web 阶段，最后停在 Cargo 缺失处。尝试安装 Rust 的命令被执行环境策略拦截，没有换途径绕过、伪造产物指纹或跳过 native 阶段。

不能把 `build:desktop` 成功等同于完整 `pnpm build` 成功。下一步需要用户提供带 Rust/Cargo 的 Windows MSVC 构建环境，然后原样重跑 `pnpm build` 并更新本记录。

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

## 本地日志

日志不进 Git，也不应包含真实账号凭据：

- `.git/fork-install.log`、`.git/fork-mobile-install.log`
- `.git/fork-build.log`：第一次构建，缺少 mobile 依赖。
- `.git/fork-build-complete.log`：第二次构建，最终缺少 Cargo。
- `.git/fork-build-desktop.log`：独立桌面构建成功；`.git/fork-electron-runtime.log`：原生运行时检查成功。
- `.git/fork-regression-tests.log`、`.git/fork-code-quality.log`
- `.git/fork-workflow-check.log`：5 个 Git fixture 场景。

Git worktree 中应使用 `git rev-parse --git-path <文件名>` 定位对应私有路径，不照抄其他 worktree 的绝对路径。

## 未验收事项

- 完整 native 构建、Windows 安装包、签名、自动更新和真实安装/启动。
- macOS/Linux 原生运行，真实 SSH/WSL，Web/Mobile 配对运行。
- 全量测试套件、真实 Claude CLI 账号测试、可见 UI 或 CDP 截图；本次 fork 没有 UI/运行时代码变更。
- 自定义用量的真实 HTTP 对接、Python 服务和控件；待按方案实施。
