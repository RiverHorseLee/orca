# 自定义用量统计：最小侵入方案

状态：设计阶段，尚未接入 Orca 运行时或真实 HTTP 服务。

工作分支：`feat/custom-usage`。本方案不把“开发准备完成”表述为“功能已实现”。

## 1. 用户目标

在 Orca 中展示自己定义的用量：已用百分比、已用/总量、余额或计数。数据来源可能是不同 HTTP 接口，接口、鉴权和字段映射应能通过修改外部 Python 脚本调整，不重新编译 Orca。

首版只做账号级快照展示，不实现逐会话计费、消费归因、历史数据库、自动登录、自动购买、告警平台或通用脚本执行器。

## 2. 现有实现调查

以初始化基线 `2b1acd0d0e` 为依据，实施前重新检查：

| 现有入口                                                                | 结论                                                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/main/usage/usage-provider-contract.ts`                             | 面向扫描 worktree 后得到 sessions/dailyAggregates；不是任意账号额度快照，不能为了复用而捏造会话记录                   |
| `src/shared/rate-limit-types.ts`                                        | ProviderRateLimits 绑定现有提供商及 session/weekly 等窗口；塞入 custom 会扩大 provider union、状态和认证链修改范围    |
| `src/renderer/src/components/status-bar/InlineProviderUsage.tsx`        | 依赖 ProviderRateLimits 和登录动作；可研究布局，但不直接复制旧样式或强行伪装 provider                                 |
| `src/renderer/src/components/status-bar/StatusBarSurface.tsx`           | 已组合多个独立 segment，是首版 UI 接线候选；实施时确认条件渲染和折叠策略                                              |
| `src/renderer/src/components/ui/`                                       | 复用 Progress、Popover、Tooltip、Button、Badge 等原语和 main.css tokens                                               |
| `src/shared/plugins/plugin-manifest.ts`、`plugin-extension-registry.ts` | 已有 panels/commands/events 等能力，但目前未发现现成的账号快照/状态栏贡献点；不能仅因出现 plugin 类型就假定支持该功能 |

决策：新增独立的 custom-usage 领域模块，少量入口接线。暂不扩展官方提供商枚举、历史用量扫描器或整个插件系统。如果上游后来提供合适扩展点，优先采用它。

## 3. 推荐架构

```text
提供商 HTTP API
    │ Python 持有凭据，处理字段映射、单位、剩余/已用转换
    ▼
用户独立运行的 Python 适配器
    │ GET http://127.0.0.1:<port>/v1/usage，固定 JSON 契约
    ▼
Orca 桌面本机 custom-usage reader
    │ 超时、限流、校验、缓存、去重；只传规范化快照
    ▼
窄 IPC / preload 桥
    ▼
CustomUsageStatusSegment + 详情弹层
```

Python 不由 Orca 启动、安装或保活。这样不引入任意命令执行、虚拟环境管理、每次轮询起进程、Windows 转义和后台进程回收问题。用户自行启动适配器；停用时 Orca 只显示不可用，不自动执行脚本。

替代方案：Orca 周期性调用 Python 并解析 stdout。虽然少一个 HTTP 服务，却让 Orca 负责解释器、子进程、安全授权和跨平台生命周期，首版不采用。直接由 renderer 请求提供商 API 也不采用，避免凭据进入 UI、CORS 和提供商耦合。

## 4. 职责

### Python 适配器

- `fetch_provider_usage()`：请求用户指定接口，鉴权、分页、处理 HTTP 状态及 Retry-After。
- `normalize_usage()`：将提供商 JSON 转为下面的版本化快照，统一百分比和单位。
- HTTP 服务：只读 `/v1/usage`，返回规范化快照；默认仅监听 loopback，不暴露提供商原始响应。
- API token、账号 cookie 等只存在环境变量或用户自己的私有配置中，不存进仓库、不传给 renderer。
- 对上游请求设置超时、大小限制、退避和并发去重；不能每个本地 GET 都无条件重新调用计费接口。
- `observedAt` 只在成功取得新数据时更新，读取缓存不能伪造“刚刚更新”。
- 建议首版使用 Python 标准库 urllib/json 等；HTTP server 仅作受保护的本地适配层，不作为公网生产服务。

适配器后续放在 `fork/adapters/custom-usage/`，示例只含假数据/占位符；真实供应商脚本和凭据放在仓库外。此目录目前不创建空占位文件。

### Orca reader

- 只读取明确启用的本机来源；不读取内置 Claude/Codex 的登录资料。
- 校验 JSON，生成不可变快照；UI 不接收原始响应、URL 参数里的秘密或请求头。
- 统一管理轮询、手动刷新、并发去重、最后成功快照和订阅生命周期。
- 不计算价格、不猜提供商字段、不从错误里推断剩余额度为 0。

### Renderer

- 展示百分比、量值、单位、重置时间、数据来源和更新时间。
- 展示 loading / stale / unavailable 等用量状态，不混用 agent 进程存活状态。
- 不 fetch 提供商 API、不执行 Python、不管理 token、不自行创建第二套轮询定时器。

## 5. HTTP 数据契约 v1（拟定）

成功：`200 application/json; charset=utf-8`。示例为假数据：

```json
{
  "schemaVersion": 1,
  "source": {
    "id": "custom-account",
    "label": "自定义账户",
    "scope": "account"
  },
  "observedAt": "2026-10-04T08:00:00Z",
  "refreshAfterSeconds": 60,
  "metrics": [
    {
      "id": "monthly-budget",
      "label": "本月额度",
      "kind": "quota",
      "used": 42.5,
      "limit": 100,
      "unit": "USD",
      "resetsAt": "2026-11-01T00:00:00Z"
    },
    {
      "id": "rolling-window",
      "label": "当前窗口",
      "kind": "percentage",
      "usedPercent": 35
    },
    {
      "id": "total-tokens",
      "label": "累计用量",
      "kind": "amount",
      "value": 123456,
      "unit": "tokens"
    }
  ]
}
```

契约约束：

- `schemaVersion` 必须为支持的版本；未知版本显示不支持，不静默解释。v1 可忽略额外字段，但必须校验已知字段。
- `source.id` 和 metric `id` 稳定且唯一；来源是账号级，不填写虚构 repo/worktree/session 身份。
- 用 `kind` 做判别联合；percentage 使用 **0–100 的已用百分比**，绝不自动猜 0–1 或“剩余百分比”。Python 负责转换。
- quota 的 used >= 0、limit > 0，允许 used > limit：文本展示真实超额值，进度条绘制 clamp 到 100%。limit=0、缺少值或无限额不能假装为 0%；无限额按 amount 展示。
- percentage 同样允许超过 100 表示超额，但不接受负数；amount 的 value 可带符号（如欠费余额），UI 不自动施加额度颜色。
- 所有数字必须有限；计数超过 JS 安全整数范围的高精度扩展另设计，不静默四舍五入。拒绝 NaN/Infinity、数字字符串和非法时间。
- 时间为带时区的 RFC 3339，重置时间可省略，不伪造倒计时。过于超前的 observedAt 显示时钟异常，不当作新鲜数据。
- quota 不再附带另一份 percent，避免相互矛盾；百分比展示由 used/limit 的通用规则计算。
- 单位是文本，货币建议 ISO 代码；不要把 USD/CNY 或 tokens/requests 混加。不同窗口不是可相加的指标。
- 拟定上限：响应 256 KiB、32 个指标、label 80 字符、unit 16 字符。文本不可作为 HTML、Markdown、脚本或远程图片渲染。

失败：非 2xx，响应可以包含安全的机器码，例如：

```json
{
  "schemaVersion": 1,
  "error": { "code": "provider-unavailable", "message": "Usage temporarily unavailable" }
}
```

Orca 映射为固定错误类别，不向 UI 透传请求头、token、上游原始错误堆栈。部分成功首版不支持：只有完整有效的快照替换最后成功值。

## 6. 配置与安全边界

首版采用桌面用户级配置文件，不放在仓库或 worktree 的设置文件中，避免打开不可信项目就触发请求。路径通过现有用户数据路径工具解析，不硬编码操作系统目录。

拟定配置：

```json
{
  "enabled": false,
  "endpoint": "http://127.0.0.1:8765/v1/usage",
  "tokenEnv": "ORCA_CUSTOM_USAGE_TOKEN",
  "pollSeconds": 60,
  "timeoutMs": 5000,
  "staleAfterSeconds": 180
}
```

- 无配置/关闭时不创建 reader、订阅或定时器，不显示空控件；不改变官方用量行为。
- 第一阶段 endpoint 只允许 `http` + 字面量 `127.0.0.1` / `[::1]`，禁止 userinfo、fragment、query、其他主机、DNS 主机名和重定向；校验端口与固定路径。不继承代理把 loopback 请求转发出去。
- 外部提供商 HTTPS 由 Python 访问并验证证书；不提供“跳过 TLS 校验”。
- 本地适配器也使用随机 bearer token。Orca main 从指定环境变量读取，Python 同样读取；未提供 token 时默认拒绝连接，不回退无认证。
- Python 只监听 loopback，校验 Host，禁用跨域开放；loopback 不等于可信，也不能让网页通过 DNS rebinding 读取额度。
- 不允许 renderer 提交任意 URL/headers 让 main 代为请求。IPC 只提供读取状态、订阅、刷新等窄操作，并沿用现有发送方校验。
- 关闭服务后不自动重启，不后台扫描 Python 文件，不执行从 HTTP 返回的任何命令。

## 7. 轮询、缓存与错误表现

- 默认 60 秒轮询、5 秒超时；最终间隔至少 15 秒，并遵守可信本地配置的更大间隔及合理的服务端刷新建议。
- 429/服务不可用指数退避并带抖动，尊重 Retry-After；手动刷新也去重，不能绕过限流无限触发请求。
- 同一来源每个桌面主进程最多一个在途请求和一个调度器。没有订阅者时释放定时器；切换来源、禁用和退出时取消请求并丢弃旧 generation 的迟到响应。
- 首次加载不显示伪造的 0%；成功后保留最后快照。断网、非法 JSON、鉴权错误不清零，不把失败请求的时间当作成功更新时间。
- observedAt 超过 staleAfterSeconds 后明确标注陈旧；首次从未成功则显示不可用及可操作的诊断提示。
- `receivedAt` 可用于本地诊断，但不得替代 observedAt。远端已缓存很久的数据刚被下载仍是陈旧数据。
- 首版不落库、不做历史曲线；进程重启后重新获取。

## 8. UI 与现有行为

拟增加独立 CustomUsageStatusSegment，与官方 provider 控件并列，不伪装账号登录入口。

- 紧凑区只显示一个选定指标；点击打开 Popover，展示全部指标、源标签、更新时间、刷新按钮及诊断状态。
- quota：量值文字 + Progress；percentage：百分比 + Progress；amount：量值 + 单位，不强行画进度条。
- 首版明确写“已用”，不悄悄受官方提供商“已用/剩余”偏好影响；如果产品验收要求共用偏好，复用既有转换函数而非复制算法。
- 有意义的 accessible label、键盘操作和文本错误状态；颜色不能是唯一状态信号。
- 遵守 `docs/STYLEGUIDE.md` 和现有 UI 原语；不新增品牌色、阴影层级或臆造字号。过长 label 截断但可查看全文。
- 现有 provider 展示、折叠、空态提示和状态栏隐藏行为需要回归；不因为 custom 可用就假装官方账号已登录。
- 配置编辑器非首版必要项，先用明确的用户配置入口。不能为了几个设置字段重构全局设置页。

## 9. SSH / WSL / Web / Mobile

首版是 **desktop-local / account-wide** 来源，与当前工作区无关：

- 桌面切到 SSH 或 WSL 工作区时，仍只能标记为“本机自定义账户”；不能声称它是 SSH 主机账号或该工作区的消耗。
- 远程主机拥有自己的凭据和执行信息。用户若要求远端账号数据，属于后续 host-scoped 来源，必须在执行主机上获取，不能悄悄用桌面账号代替。
- Web、移动端及远程 runtime 的旧版本缺少本机桥时隐藏/标记不支持；不访问浏览器所在设备的 127.0.0.1，不把桌面 token 传给远端。
- 首版不新增 RPC 方法、stream opcode、协议枚举或 relay 行为。接线必须区分 Electron 本机 bridge 与可路由 runtime facade；仅检查属性存在不足以证明主机身份。
- 后续需要远程来源时先更新方案，遵循 `docs/reference/ssh-execution-boundary.md` 和 `remote-wire-compatibility.md`，做能力协商及新旧版本双向测试。
- 文件夹工作区、无 Git 工作区同样可展示；不需要 git 元数据，也不扫描工作树。

## 10. 预计代码落点与入侵预算

以下是实施候选，不表示文件已经存在：

| 新模块                                      | 职责                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `src/shared/custom-usage-contract.ts`       | 规范化 DTO、校验及错误类型，不依赖 Electron                           |
| `src/main/custom-usage/`                    | 配置读取、受限 HTTP reader、刷新/缓存生命周期、IPC 注册；按领域拆文件 |
| `src/preload/api/custom-usage-bridge.ts`    | 桌面本机窄桥                                                          |
| `src/renderer/src/components/custom-usage/` | typed hook、状态栏控件和详情展示                                      |
| `fork/adapters/custom-usage/`               | 用户可编辑的 Python 示例及 fixture 测试，不随 Orca 自动执行           |

现有接线候选：main 的 IPC/退出生命周期入口、preload 组装及类型、StatusBarSurface。实施 M1 时先定位真实入口；若发现需要到处修改 provider/store/RPC/认证代码，暂停复核边界。

目标是将已有源码修改限制在必要接线；不机械限定文件数，不通过堆进一个超长文件达标。每个被修改的现有文件在 PR 里解释必要性。默认不增加 npm 依赖，不改官方 provider union、持久化数据库或代理执行链。

## 11. 实施里程碑

1. **M1 契约与 fixture**：确认真实接口的脱敏成功/失败样本；完成 v1 DTO、校验测试和静态展示 fixture。不依赖真实凭据。
2. **M2 Python 适配器**：实现独立的本地 HTTP 示例、鉴权、超时及脱敏映射；替换字段映射后无需改 Orca。先不启动 Orca。
3. **M3 桌面 reader**：默认关闭、只读用户配置、本机 IPC、缓存与生命周期；用本地 mock HTTP 测试，不读真实账号。
4. **M4 展示**：复用原语，接入状态栏和详情，覆盖启用/关闭、无数据/陈旧/超额等状态。
5. **M5 集成**：完整 build、相关回归、隐藏 renderer CDP 截图、跨平台和远程降级验证；确认后再合入 develop。

真实 API 地址、鉴权方式、请求/响应样本、指标单位、已用/剩余语义、时间窗口和更新频率尚待用户提供。缺少这些不阻碍 fixture/契约工作，但不能据此声称已接通真实服务。

## 12. 验收与撤销

必须覆盖：

- percentage 0/100/>100、quota 超额/零总额、amount 负余额、空列表、重复 id、非法数字/版本/时间及超大响应。
- HTTP 401/403/429/500、超时、重定向、错误类型、token 缺失、服务未启动；不得泄密或清零历史成功数据。
- 多订阅者和手动刷新不重复请求；禁用/关闭/换源后没有定时器、请求或旧响应覆盖。
- 修改 Python 映射后，Orca 不重新编译即可展示新数据；Python 不可用时主应用照常工作。
- SSH/WSL 切换仍明确为本机账号；无 Git 文件夹可用；Web/Mobile/旧 runtime 不触发 localhost 请求或方法不存在错误。
- 新 UI 遵守设计规则；默认关闭时界面和请求数与上游一致。
- `pnpm tc`、相关测试、质量检查和 `pnpm build` 通过；UI 只在后台隐藏窗口用 CDP 验证，不抢焦点。

第一层撤销是关闭配置，应立即取消读数和隐藏控件；第二层是 revert 本功能提交，移除少量接线和新增领域模块。Python 脚本和 token 不由 Orca 删除；不要顺带重置用户配置或清理其他服务。
