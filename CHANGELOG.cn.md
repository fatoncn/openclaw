# 变更日志（中文版）

文档主页：https://docs.openclaw.ai

> 说明：
>
> - 本文件是 `CHANGELOG.md` 的中文摘要版，优先覆盖最近版本与高影响改动。
> - 如需完整、逐条英文原文，请查看根目录 `CHANGELOG.md`。

## Unreleased

### 变更

- CLI/sessions：新增 `--clear-context-tokens`，可清理会话缓存的 context window；新增可选 `--clear-total-tokens-fresh`，将 token 使用快照标记为过期，待下一次运行刷新。
- Model isolation（main 组）：新增按 agent 维度的 token 护栏与持久触发状态；触发后可向频道投递错误通知；WebChat（`Agents -> Isolation Guardrail`）与 CLI（`openclaw agents isolation-guardrail disable --agent <id>`）都支持可视化与手动重置；计费权重改为 `input*1 + cacheRead*0.1 + cacheWrite*1.2 + output*5`。

### 修复

- Models/isolation：`/status` 的模型显示与会话级 `/model` 覆写保持一致（含会话覆写标记），同时保留 Edition 行上的组基线；并统一隔离模式下运行时/会话路径的归一化逻辑。

## 2026.3.8

### 变更

- 新增本地备份能力：`openclaw backup create` / `openclaw backup verify`，支持 `--only-config`、`--no-include-workspace`，并补充 destructive 场景下的备份提示。
- macOS onboarding：远程模式新增 remote gateway token 输入；已有非明文 `gateway.remote.token` 可保留直至显式替换；token 形态不兼容时会给出提示。
- Talk mode：新增全局 `talk.silenceTimeoutMs`，支持按静默时长自动发送转写内容。
- Web search：新增 Brave `llm-context` 模式；统一 provider 列表排序；修正文档中的 Brave 套餐与免费额度描述。
- ACP：新增 provenance 元数据与可见回执注入（`openclaw acp --provenance off|meta|meta+receipt`）。

### 修复

- macOS：修复 update 重启时 LaunchAgent 被禁用导致卡住的问题。
- Telegram/Matrix/Feishu：修复 DM 路由、topic 绑定与插件安装后发现缓存等多处稳定性问题。
- Browser/CDP/relay：修复多种 WebSocket/CDP 地址归一化、重连与跨命名空间绑定问题（含 WSL2 场景）。
- Gateway/Control UI：修复资产路径、版本上报、鉴权重连与配置重启保护等问题。
- Cron：修复 announce 投递、重启补跑与 owner-only tools 可用性等问题。
- Security：加强 SSRF、`system.run` 脚本审批绑定、技能下载路径绑定等安全边界。

## 2026.3.7

### 变更

- Context engine 插件接口正式化：新增完整生命周期钩子，支持通过插件替换/扩展上下文管理策略。
- ACP 持久化绑定：新增 Discord 频道与 Telegram topic 的持久绑定与管理能力。
- Web UI：新增西班牙语（`es`）本地化支持。
- Web search：onboarding 新增 provider 选择；Perplexity 切换到 Search API 并支持语言/地区/时间过滤。
- 插件与 hooks：补充系统上下文字段与注入策略控制，降低 prompt 污染并提升可控性。

### 破坏性变更

- 当同时配置 `gateway.auth.token` 与 `gateway.auth.password`（含 SecretRef）时，必须显式设置 `gateway.auth.mode=token|password`，否则升级后可能出现启动/配对/TUI 失败。

### 修复

- 配置与安全：`loadConfig()` 验证/读取错误时改为 fail-closed，避免回退到宽松默认值。
- 多渠道路由与会话：修复 Slack/LINE/Feishu/Telegram/iMessage 等在 DM、thread、事件路由与去重方面的问题。
- TUI 与会话管理：修复模型指示器滞后、`/new` 会话隔离、错误渲染回退等问题。
- Docker/Podman/Linux daemon：修复 systemd 探测、SELinux 挂载、镜像构建与安装稳健性问题。

## 维护约定

- 新增版本时，优先同步最近版本（通常最近 1-3 个）的中文摘要。
- 本文件标题结构与 `CHANGELOG.md` 保持一致：`Changes` / `Breaking` / `Fixes` 对应 `变更` / `破坏性变更` / `修复`。
- 需要追溯完整细节时，以 `CHANGELOG.md` 为准。
