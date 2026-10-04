# Orca 定制开发入口

本目录保存 RiverHorseLee/orca 的维护规则、开发技能和功能方案；不属于上游产品功能。

## 阅读顺序

1. [开发与同步流程](DEVELOPMENT.md)：分支职责、环境准备、验证和发布边界。
2. [自定义用量统计方案](plans/custom-usage.md)：HTTP + 可替换 Python 适配器，仅方案，尚未实现。
3. [验证记录](VALIDATION.md)：实际安装、编译、测试结果和未验证项。

先遵守仓库根目录的 `AGENTS.md`；本目录只补充 fork 的规则，不覆盖上游约束。

## 分支

```text
upstream/main → origin/main → develop ← feat/* / fix/*
                                ↑
                    sync/upstream-YYYYMMDD
```

- `main`：上游镜像，只快进，不包含本目录或定制代码。
- `develop`：定制版本的长期集成分支。
- `feat/custom-usage`：为自定义用量功能预留的工作分支。
- 不把 `develop` 合回 `main`；给上游的贡献另从纯净 `main` 分支准备。

## Skills

版本源位于 `fork/skills/`，与代码一起维护；不要放入产品自带的根 `skills/`。

- `$orca-fork-feature`：分析复用点、规划和开发功能、验证最小改动。
- `$orca-fork-sync`：预检、快进主线、隔离合并上游、验证并报告结果。

当前 Codex 环境使用 `$CODEX_HOME/skills`（未设置时为 `~/.codex/skills`）。安装只复制以下两个命名目录，已有同名目录先比较，不覆盖第三方内容。

PowerShell，在仓库根目录执行：

```powershell
$skillHome = if ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'skills' } else { Join-Path $HOME '.codex/skills' }
New-Item -ItemType Directory -Path $skillHome -Force | Out-Null
# 首次安装；目录已存在时先查看差异，再有选择地更新。
Copy-Item -LiteralPath 'fork/skills/orca-fork-feature' -Destination $skillHome -Recurse
Copy-Item -LiteralPath 'fork/skills/orca-fork-sync' -Destination $skillHome -Recurse
```

macOS / Linux：

```sh
skill_home="${CODEX_HOME:-$HOME/.codex}/skills"
mkdir -p "$skill_home"
# 首次安装；已有同名目录时不要直接覆盖。
cp -R fork/skills/orca-fork-feature "$skill_home/"
cp -R fork/skills/orca-fork-sync "$skill_home/"
```

使用采用 `.agents/skills` 发现规则的 Codex 客户端时，可将这两个目录复制到仓库的 `.agents/skills/`；该路径已被上游忽略，不必修改 `.gitignore`。选择客户端支持的一处安装，避免同名重复安装。新建会话后检查技能是否可见。

这些 skill 会先检查当前仓库是否存在本入口；在纯净 `main` 上，会通过 `git show develop:fork/README.md`（或已确认的 `origin/develop`）读取规则，不会把维护文件写入 main。不能在其他项目中自动采用这里的分支规则。

示例：

```text
使用 $orca-fork-feature，按 fork/plans/custom-usage.md 开始 M1，只实现数据契约和测试。
使用 $orca-fork-sync，检查上游差异并完成本地同步；先不要推送。
```

安装副本不是版本源。更新技能时先修改 `fork/skills/`，验证后再同步到安装位置。
