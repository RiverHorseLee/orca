# 自定义用量：左下角 Usage 集成与 Python 脚本

状态：已按用户修订的交互要求实施。分支 `feat/custom-usage`。本文件取代首轮“右侧独立控件 + Python HTTP 服务”方案。

## 1. 用户体验

- 设置 → AI 提供商账户增加 Custom（自定义）区块。
- 配置显示名称、Python 解释器绝对路径、`.py` 脚本绝对路径、刷新间隔。
- 用户必须确认信任才可测试或启用；更换任一路径须重新确认。
- 测试当前草稿只预览数据，不保存、不启用。保存后已打开的左下角 Usage 区实时更新。
- 自定义摘要与 Claude/Codex 等共享左下角入口和同一个 Usage 弹层，没有右侧独立按钮。
- 参与详细/紧凑模式、已用/剩余偏好、统一刷新、窄窗口 +N 折叠；只有自定义配置时也不被官方账号空态挡住。
- 点击自定义行跳转 `accounts-custom`；原有管理账户和历史统计入口保留。

使用说明：[Python 模板与设置](../adapters/custom-usage/README.md)。

## 2. 已复用的实现

| 原实现                                                            | 用途                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `StatusBarSurface.tsx`                                            | 现有左下角摘要和统一弹层组合                                              |
| `UsageRosterPanel.tsx`                                            | 通过可选 `additionalRows` 扩展位加入自定义行，保留原有行和管理动作        |
| `StatusBarProviderSegment.tsx`                                    | 复用 MiniBar；OverflowChip 增加可选额外摘要，不改 ProviderRateLimits 枚举 |
| `status-bar-usage-collapse.ts`                                    | 沿用已有 data-usage 标记、测量、收起算法                                  |
| `AccountsPane.tsx` / `settings-navigation-capability-sections.ts` | 接入独立设置区块，支持搜索和定位                                          |
| `SettingsFormControls.NumberField`                                | 有界数字草稿编辑与提交                                                    |
| `src/shared/child-process/run-process.ts`                         | Windows 隐藏进程、argv、输出限额、超时、取消和进程树终止                  |
| canonical userData / bounded file reader / secure JSON writer     | 独立用户配置，不写仓库、不扩大全局设置                                    |
| renderer lifetime abort                                           | 关闭/导航时取消测试并移除订阅                                             |

不是将账号快照接入 `usage-provider-contract.ts` 的会话历史扫描器，也不把自定义脚本伪装成现有 Claude/Codex 账号。

## 3. 架构

```text
设置中明确选定、确认信任的 Python 脚本
    ↓ 由 runProcess 后台执行，固定 argv，不经 shell
stdout 单个 JSON 快照 → 校验 → 单来源缓存/轮询
    ↓ 独立本机 IPC / window.orcaCustomUsage
现有左下角 Usage 摘要 + 统一弹层
```

Python 内部可以通过 HTTP 获取真实用量；当前 `usage_sample.py` 只返回固定演示值。Orca 不安装 Python、构造任意 shell 命令或启动常驻 HTTP 服务，不扫描仓库寻找脚本。

后台状态与设置预览共用串行 runner。预览最多一个；保存会取消正在运行的预览，禁用/换源/退出会取消旧采集；迟到响应不能覆盖新源。退出时将 runner 的终止完成 Promise 加入现有的退出等待，不能只发取消信号就让主进程结束。

## 4. 数据契约 v1

沿用首版规范化快照：

```json
{
  "schemaVersion": 1,
  "source": { "id": "sample-account", "label": "自定义用量示例", "scope": "account" },
  "observedAt": "2026-10-04T08:00:00Z",
  "metrics": [
    {
      "id": "monthly",
      "label": "本月额度",
      "kind": "quota",
      "used": 42.5,
      "limit": 100,
      "unit": "USD"
    },
    { "id": "window", "label": "当前窗口", "kind": "percentage", "usedPercent": 35 },
    { "id": "tokens", "label": "累计用量", "kind": "amount", "value": 123456, "unit": "tokens" }
  ]
}
```

- 只接受支持的 schemaVersion；已知字段严格校验，额外字段不传给 UI。
- source/metric id 稳定、metric id 不重复；最多 32 指标。
- percentage 是已用的 0–100 标度，允许超额；quota 的 limit 必须大于 0；amount 可表示负余额。
- 数值必须有限且处于 JS 安全数值范围；拒绝字符串数值、NaN/Infinity、非法日期等。
- 日期带时区；可选 resetsAt 不伪造倒计时；未来超过一分钟的 observedAt 视为时钟异常。
- 原始消耗量保留；图形/摘要按既有百分比函数转换，不能把普通数值当成配额。
- 输出上限 256 KiB，label 80 字符、unit 16 字符；只显示文本，不解释 HTML/脚本。
- stdout 不含日志；stderr 不直接展示到 UI，避免意外泄露提供商凭据。

## 5. 生命周期与配置

- 默认禁用且不信任；无采集进程、无轮询定时器。
- 已挂载的展示区可以保留轻量配置订阅，用于在设置保存后即时启用；订阅本身不执行脚本。
- 只有启用且有展示订阅时自动轮询。隐藏状态栏/卸载最后订阅者时取消采集。
- 默认 60 秒轮询、5 秒超时；失败保留旧快照、标为陈旧并退避。手动刷新不绕过节流。
- 设置测试只处理当前草稿，不污染正式缓存；用户不必启用就能在确认信任后测试。
- 设置经窄 IPC 校验后安全保存到 canonical userData/custom-usage.json。路径必须绝对，禁止批处理/PowerShell 作为解释器入口。
- 原生文件选择器只由用户点击触发，接受固定的解释器/脚本类型，不能让 renderer 传任意对话框选项或 shell 参数。
- 不进行目录监听；设置保存主动重读并广播。手工修改文件可通过统一刷新或重启加载。

## 6. 主机和兼容性边界

首版固定为 desktop-local / account-wide：在 SSH/WSL 工作区展示时明确为本机自定义账号，不是远端凭据或会话归因。

配置和执行走独立本机桥，不通过可能路由到远端的 window.api。可信桌面主 frame 才可读取路径、保存、选择文件或执行预览。Web/Mobile/旧能力缺失客户端不提供本机执行。

没有新增远程 RPC、stream opcode、官方 provider 枚举、Agent 状态或历史数据库。将来支持远端脚本须单独设计执行主机所有权和能力协商，不能加静默本机 fallback。

文件夹工作区和 Git worktree 使用同一账号快照；采集不依赖 Git 元数据。

## 7. 侵入范围与撤销

现有生产文件共 8 个接入点：主 IPC 注册、preload 初始化、退出等待、StatusBarSurface、UsageRosterPanel、StatusBarProviderSegment、AccountsPane、settings-navigation-capability-sections。原有注册测试增加一处 mock。其余功能、配置、采集与测试均新增在 custom-usage 领域文件中。

不改变既有 UI 原语样式，不新增 npm 包，不更改全局 store 和官方认证。新增的可选 UI props 在不传入时保持旧行为。

第一层撤销：关闭并保存，取消采集并移除摘要。第二层：撤销这些小接线和新增领域模块；不删除用户脚本和供应商凭据。

## 8. 验收

- DTO 边界、错误 JSON、输出上限、时间戳、非法路径、未信任脚本。
- 真实 Python 包含空格/中文/& 路径，超时和进程终止；执行使用共享 wrapper。
- 配置草稿、测试不保存、保存即更新、切换路径撤销信任、取消预览、搜索定位。
- 统一 Usage 弹层和 +N、无官方账号的自定义单独展示、模式/百分比偏好。
- 旧数据/迟到结果、取消、卸载、Web/远程浏览器降级和不可信 IPC 拒绝。
- 类型、增量质量和完整构建；后台隐藏 CDP 验证，禁止激活测试窗口。

本机验证与未验收项记录在 [验证记录](../VALIDATION.md)。真实供应商 HTTP 对接、真实 SSH 主机执行、安装包签名和多平台桌面验收不属于本轮。
