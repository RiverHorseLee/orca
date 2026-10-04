# Fork 开发与上游同步

## 1. 目标和边界

保持上游历史完整，让定制功能可独立验证、撤销和迁移。默认以减少长期合并成本为优先，不追求通过重构将上游改成自己的架构。

- `origin`：RiverHorseLee/orca，推送自己的分支。
- `upstream`：stablyai/orca，只用于读取上游代码，不向它推送。
- `main`：纯上游基线，只允许 fast-forward。
- `develop`：定制版本的集成主线；有意与上游保持差异。
- `feat/<主题>`、`fix/<主题>`：从 `develop` 创建，完成后合回 `develop`。
- `sync/upstream-<日期>`：从 `develop` 创建，隔离一次上游集成；重名时加描述性后缀，不复用未知分支。

`develop` 不是临时分支，永远不合回镜像 `main`。本仓库的定制发布从已验证的 `develop` 提交打标签；暂不建立额外 release 分支。

## 2. 已建立的起点

2026-10-04 初始化时，从上游取得 `2b1acd0d0e686a5a59627920d62153a95ecf8fa7`，相比最初克隆的 `5df67eff3e` 多 2 个提交。此处是历史记录，不代表今后的最新版本。

维护材料全部新增在 `fork/`，不修改上游 `AGENTS.md`、README、产品技能目录或忽略规则。实际分支、推送及验证状态见 [验证记录](VALIDATION.md)。

## 3. 新功能工作流

1. 查看 `git status --short --branch`、分支和当前需求。先处理用户未提交内容，不擅自 stash、reset 或覆盖。
2. 从本地 `develop` 创建主题分支；如果是续作，留在原分支，不重复创建。
3. 查找现有组件、服务和扩展点。方案写清：复用点、必要改动文件、数据所有权、远程行为、失败状态、测试和撤销方式。
4. 每次提交只做一件事；新行为集中到领域命名的新文件，现有入口只保留必要的接线。
5. 对照下节验证。先将代码提交到功能分支；PR 的目标是自己的 `develop`，不是自己的 `main` 或上游 `main`。
6. 合并后保留验证证据。功能分支可以 squash；上游同步分支不能 squash。

```sh
git switch develop
git switch -c feat/your-feature
```

如果要向上游贡献：从纯净 `main` 创建另一分支，仅 cherry-pick 可上游化的改动；不直接提交整个定制分支。

## 4. 同步工作流

### 预检

- 工作区必须干净，无 merge/rebase/cherry-pick 进行中。
- 检查 `git worktree list --porcelain`，不能为了切换而进入其他 worktree 修改文件。
- 核对远端 URL；不能仅凭名字推定 `origin` 是自己的仓库。
- 只获取必要分支，不使用全 refs 扫描或逐 ref 扫目录。
- 不自动推送、强推、删除分支或改默认分支；具体授权按当次请求判断。

```sh
git fetch --no-tags origin main develop
git fetch --no-tags upstream main
git rev-list --left-right --count main...origin/main
git rev-list --left-right --count main...upstream/main
git rev-list --left-right --count develop...origin/develop
```

首次数值比较需要远端 `develop` 已存在。任何分叉先报告并分析；`main` 上不做 merge commit、rebase 或硬重置来“修好同步”。

### 快进 main

```sh
git merge-base --is-ancestor main upstream/main
git merge-base --is-ancestor origin/main upstream/main
# 上面两条均返回 0 后，才执行：
git switch main
git merge --ff-only upstream/main
```

祖先检查必须在切换/修改 main 前完成，任何非零退出码都停止并区分“分叉”和命令失败。完成后 main 应等于拉取到的 upstream/main；不能因为 origin/main 可快进就默认可信。

### 隔离接入 develop

若 `develop` 仅落后于 `origin/develop`，先 `git merge --ff-only origin/develop`；有分叉则停止，避免丢失其他协作者改动。

```sh
git switch develop
git switch -c sync/upstream-YYYYMMDD
git merge --no-ff --no-edit main
```

冲突逐文件处理，不能批量 `--ours` / `--theirs`。锁文件优先保留可解释的依赖意图，再用固定的 pnpm 版本验证；不换包管理器、不取消 frozen-lockfile 掩盖漂移。

将验证记录写入 sync 分支并提交；不要把未提交材料带去 develop。验证通过并获准完成集成后：

```sh
git switch develop
git merge --ff-only sync/upstream-YYYYMMDD
```

该快进保留 sync 分支上已有的真正 merge commit。若此时 `develop` 已移动，不强推、不硬重置，重新集成并验证。失败时保留 sync 分支用于排查，`develop` 不动；需要放弃合并时先报告状态，再按授权 `git merge --abort`。

获准发布 Git 分支更新后：

```sh
git push origin main
git push origin develop
```

推送被拒绝则停止并重新获取远端状态，不自动重试强推。上游历史可能被重写时同样停止，由维护者决定迁移方式。

### 节奏

可每周检查上游，按功能里程碑接入 `develop`；重要修复优先评估。更新 `main` 与更新 `develop` 可以分开。首阶段不启用无人值守合并、定时发布或自动处理冲突。

## 5. 工具链与构建

以当前 `package.json`、锁文件和 `pnpm-workspace.yaml` 为准，不能在技能里永久固定旧版本。初始化基线要求 Node 24、pnpm 12.8.1。

若 PATH 中没有 pnpm，且已安装 Corepack，可在当前 worktree 的 Git 私有目录生成 shim，不修改全局 Node 安装。以下路径先通过 `git rev-parse --git-path fork-tools` 确认；不要硬编码另一 worktree 的 `.git`。

PowerShell：

```powershell
$tools = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath((git rev-parse --git-path fork-tools))
New-Item -ItemType Directory -Path $tools -Force | Out-Null
corepack enable pnpm --install-directory $tools
$env:PATH = "$tools;$env:PATH"
$env:ORCA_BACKGROUND_LAUNCH = '1'
pnpm --version
pnpm install --frozen-lockfile
pnpm --dir mobile install --frozen-lockfile
pnpm build
```

macOS / Linux：

```sh
tools="$(git rev-parse --git-path fork-tools)"
mkdir -p "$tools"
corepack enable pnpm --install-directory "$tools"
export PATH="$(cd "$tools" && pwd):$PATH"
export ORCA_BACKGROUND_LAUNCH=1
pnpm --version
pnpm install --frozen-lockfile
pnpm --dir mobile install --frozen-lockfile
pnpm build
```

命令逐条执行，某一步失败就停止。安装需要网络和本机原生构建工具；Windows 的 node-gyp 依赖 Python、MSVC/Windows SDK；完整 `pnpm build` 还会通过 Cargo 编译 Windows 原生 CLI launcher，因此必须安装 Rust MSVC 工具链并让 `cargo` 在 PATH 中可用。先检查 `cargo --version`。不要为了过编译随意删除原生补丁、跳过生命周期或关闭校验。

`mobile/` 有独立工作区和锁文件；根目录 `pnpm install` 不会安装它，而 `pnpm build` 的 Mobile Web 阶段需要这些依赖。完整构建必须分别安装两处，不能通过跳过 Mobile Web 掩盖缺依赖。

普通安装只覆盖当前 OS/CPU；跨架构打包先执行 `pnpm install:release`，遵守上游安装政策。

## 6. 验证基线

所有测试和 agent 启动的应用都设置 `ORCA_BACKGROUND_LAUNCH=1`，使用后台进程；不弹窗抢焦点。

- 日常类型检查：`pnpm tc`，或改动涉及的 `tc:node` / `tc:cli` / `tc:web`。
- 增量质量：`pnpm run check:code-quality:changed`。
- 行为变更：`pnpm test <相关测试路径>`；新增回归测试，不能仅测试成功状态。
- 提交前构建：`pnpm build`，包含桌面类型检查、relay、CLI、Electron/Web/Mobile Web 产物和本机原生构建；不等于安装包签名或跨平台验收。
- UI：遵守 `docs/STYLEGUIDE.md`，用 `$electron` 和 Playwright CDP 检查隐藏 renderer；技能未安装时明确报告，不能用 computer-use 替代。
- 修改 Claude structured-session 时遵守根 `AGENTS.md` 的 real CLI 测试要求；真实凭据不可用时记录未验证，不伪报通过。

`check:code-quality:changed` 默认以 `origin/main` 为基线。功能分支只检查本功能时，用环境变量指定 `develop` 或已更新的 `origin/develop`；做 fork 整体验证时仍对比 `main`。如果正在 `develop` 上检查累计修改，不要把 `develop` 自己当成基线。

```powershell
$env:ORCA_BACKGROUND_LAUNCH = '1'
$env:ORCA_CODE_QUALITY_BASE = 'main'
pnpm run check:code-quality:changed
Remove-Item Env:ORCA_CODE_QUALITY_BASE
```

不全仓格式化无关代码；只格式化本次修改文件。不禁用 max-lines、类型检查或质量规则来制造通过。

## 7. 定制边界与撤销

- 接口/提供商差异放在适配器，不塞进现有 Claude/Codex 认证、额度缓存或历史计费扫描。
- 不将账号级汇总冒充为某个仓库、工作树或 SSH 会话的消耗；数据来自哪个主机必须明确。
- 不在通用流程硬编码 Windows、GitHub、`metaKey` 或本地文件系统。
- 不改变默认关闭功能时的上游行为；验证关闭状态无网络、无定时器、无新增 UI。
- 每项功能记录新增文件和少量接线点，便于撤销；已发布分支用新的修复/revert 提交，不重写历史。

## 8. 发布不在本次自动化范围内

官方 release-cut 工作流只允许 `stablyai/orca`。打包配置的 appId、发布仓库和更新源仍属于官方配置。不得仅移除仓库保护条件就使用官方流程发布 fork。

独立发布前另做应用标识、数据目录、更新源、签名、版本标签、权限与回滚方案。暂不修改 GitHub 默认分支或自动化设置。
