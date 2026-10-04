# 自定义用量：设置、Python 模板与左下角展示

当前实现已复用 Orca **左下角的 Usage 用量区**。不再使用右侧独立控件，也不再需要 Python HTTP 服务、监听端口或本机服务口令。

## 1. 在设置中启用

打开包含本功能代码的 Orca：**设置 → AI 提供商账户（AI Provider Accounts）→ 自定义（Custom）**。

配置：

1. **显示名称**：左下角摘要和 Usage 弹层中的名称。
2. **Python 解释器路径**：选择 Python 或虚拟环境的解释器，必须是绝对路径；Windows 选择 `python.exe`，不是 shell 命令或 `pythonw.exe`。
3. **Python 用量脚本路径**：选择绝对路径的 `.py` 文件。示例为本目录的 `usage_sample.py`。
4. **刷新间隔**：15–3600 秒，默认 60 秒。
5. 确认**信任此脚本**。脚本以你的本机用户权限执行；更换解释器或脚本路径后，需要重新确认。
6. 点击 **测试获取（Test usage）** 检查数据。测试只运行当前草稿，不保存、不启用自动刷新。
7. 打开启用开关，点击 **保存（Save）**。左下角立即出现自定义摘要，无需重启。

Windows 可以在终端查找解释器位置：

```powershell
(Get-Command python.exe).Source
```

不要把 `python xxx.py` 整段命令填进路径框。两个路径分别选择，空格、中文和 `&` 等路径字符由现有进程封装处理，不经过 shell 字符串拼接。

设置为本机用户级配置；切换到 SSH/WSL 工作区不会把本机脚本伪装成远端账号。浏览器和移动端不提供本机脚本执行。

## 2. 当前固定样例

`usage_sample.py` 仅依赖 Python 标准库，输出以下固定数据后退出：

- 本月额度：**42.5 / 100 USD**。
- 当前窗口：**35% 已用**。
- 累计用量：**123456 tokens**。

没有真实供应商请求、收费调用或账号读取。时间戳是本次生成样例的时间，不代表真实账单更新时间。

可手动运行检查输出：

```powershell
python -X utf8 -u fork/adapters/custom-usage/usage_sample.py
```

左下角摘要取第一个指标，因此样例默认显示额度比例约 **43% 已用**，不是第二个指标的 35%。点击现有 Usage 按钮可看到全部指标。它参与原有详细/紧凑模式、已用/剩余百分比、统一刷新和窄窗口 `+N` 折叠。

额度文字始终保留原始 `used / limit`；剩余模式的进度和百分比按既有函数转换。累计量没有总额度，不画虚构的进度条。

## 3. 改成自己的 HTTP 获取逻辑

只修改 `collect_usage()`，保持 JSON 契约不变。Orca 在下一次采集时重新执行该脚本，不需要重启 Python 服务或重新编译 Orca。

```text
供应商 HTTP 接口
    ↓ Python 处理鉴权、字段映射、缓存
stdout：一份版本化 JSON，随后正常退出
    ↓ Orca 校验、缓存、错误处理
左下角现有 Usage 用量区
```

约定：

- stdout 只输出一份 JSON，不输出 banner、调试日志或 Markdown；日志写 stderr。
- 真实供应商凭据放在环境或仓库外的私有配置中，不写进示例、界面或 JSON。
- 外部 HTTP 请求应有超时，保留 HTTPS 证书校验。
- `usedPercent` 使用 0–100 标度且明确表示已用；剩余值或 0–1 值由 Python 转换。
- `quota` 使用 `used`、正数 `limit` 和 `unit`；无限额度/余额/计数使用 `amount`。
- `observedAt` 只在成功取得新数据时更新；返回缓存不能伪造新鲜时间。
- 失败以非零退出码表示；异常输出不会当成 0% 或覆盖最后成功数据。
- 可选 `refreshAfterSeconds` 是脚本建议的最短间隔；实际刷新不会快于它或用户配置。
- 修改已信任脚本的内容会在下一次运行生效，请保护该文件和所属目录。

默认每次执行限时 5 秒、stdout/stderr 输出上限 256 KiB；配置允许超时 100–30000 ms。界面暂只提供刷新间隔，其他高级值保存在独立的用户配置中。

## 4. 停止、错误与配置位置

关闭启用开关并保存，会取消采集、丢弃旧请求结果并从左下角移除。测试中的 **取消测试** 或离开设置区会取消预览。设置测试与轮询共用串行执行通道，不会并发启动两个采集脚本。

没有成功数据时显示错误；已有成功数据的失败保留旧数值并标注陈旧。统一刷新按钮也遵守刷新间隔/退避，不会连续点击就不断创建进程。

配置通过原有安全写入工具保存为 canonical userData 下的 `custom-usage.json`，与当前实例的 `orca-data.json` 同目录，不进入仓库设置或全局提供商协议。默认开发版是 `orca-dev` 数据目录，`ORCA_DEV_USER_DATA_PATH` 可覆盖。

首次旧 HTTP 方案遗留的 `endpoint/tokenEnv` 配置不再用于采集；请在设置中重新选择脚本并确认信任。旧 `ORCA_CUSTOM_USAGE_TOKEN` 环境变量已不需要，可由你自行删除；应用不会自动修改用户环境变量。

本目录的 JSON 文件只是配置结构参考，通常不需要手动复制：通过设置保存即可。默认关闭，未确认信任时不会运行任何脚本。

## 5. 验证命令

agent 执行测试必须后台运行并设置 `ORCA_BACKGROUND_LAUNCH=1`。

```powershell
$env:ORCA_BACKGROUND_LAUNCH = '1'
$env:ORCA_TEST_CUSTOM_USAGE_PYTHON = (Get-Command python.exe).Source
python -m unittest discover -s fork/adapters/custom-usage -p 'test_*.py'
pnpm test src/shared/custom-usage-contract.test.ts src/main/custom-usage src/preload/custom-usage-bridge.test.ts src/renderer/src/components/custom-usage
pnpm build
```

`ORCA_TEST_CUSTOM_USAGE_PYTHON` 只用于测试夹具，不是正式配置。未提供时真实解释器测试会跳过；正式功能只使用设置中明确选择的解释器。
