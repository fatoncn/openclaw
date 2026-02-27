# OpenClaw — Kosbling Edition

基于 [OpenClaw](https://github.com/openclaw/openclaw) 的定制 fork，用于 [Kosbling AI Studio](https://kosbling.ai) 电商助手平台。

## 与上游的关系

- 上游仓库：`https://github.com/openclaw/openclaw.git`
- 同步方式：`git merge --no-ff` 保留合并记录
- 当前基线：`v2026.2.21`

## 定制改动

所有改动在源码中标记 `// KOSBLING-PATCH`。

### 功能改造

- **Model 隔离**（`src/agents/edition-isolation.ts` + 多个文件）
  - 根级 `modelIsolation` 配置块，main/secondary 两组完全隔离
  - `/model` 命令、cron payload、spawn 显式指定全部封死
  - 支持 per-agent model override（必须在组 allowlist 内）
  - 详见下方 [Model 隔离](#model-隔离) 章节
  - 已向官方提交 [Feature Proposal](https://github.com/openclaw/openclaw/discussions/28314)

- **CLI Banner 品牌标识**（`src/cli/banner.ts`）
  - ASCII art 下方 `✦ Kosbling Edition ✦`，单行 banner `[Kosbling Edition]`

- **更新机制禁用**（`src/infra/update-startup.ts` + `src/cli/update-cli/update-command.ts` + `src/config/io.ts`）
  - `openclaw update` 提示用 git pull 方式
  - 启动时 update check 和 config version warning 跳过

- **System Prompt 注入**（`src/agents/system-prompt.ts`）
  - 所有 agent 的 system prompt 中包含 Kosbling Edition 说明
  - 包括 model isolation 配置参考和定制版行为说明

### Bug 修复

- **HTTP 529 不触发 model fallback**（`src/agents/failover-error.ts`）
  - 上游 `resolveFailoverReasonFromError` 不识别 529（Anthropic overloaded），导致 fallback 链被跳过
  - 上游的 `isTransientHttpError` 只在外层做一次 retry，不进入 fallback 循环
  - 修复：将 529 加入 `resolveFailoverReasonFromError`，让内层 fallback 循环正常尝试备用模型
  - 相关上游 issue: [#28502](https://github.com/openclaw/openclaw/issues/28502), [#8112](https://github.com/openclaw/openclaw/issues/8112)

- **/status 误报 fallback**（`src/auto-reply/status.ts`）
  - session 首次请求前，edition isolation 分支会错误显示 fallback 状态
  - 修复：加 `hasRuntimeModel` 检查，无运行时 model 时不显示 fallback

### Model 隔离

openclaw.json 配置：

```json
{
  "modelIsolation": {
    "enabled": true,
    "main": {
      "model": "anthropic/claude-opus-4-6",
      "fallbacks": ["anthropic/claude-sonnet-4-6"]
    },
    "secondary": {
      "model": "anthropic/claude-sonnet-4-6",
      "fallbacks": ["anthropic/claude-haiku-3-5"]
    }
  }
}
```

行为：

- `enabled: false` 或不存在 → 走官方原版逻辑，零影响
- `enabled: true` → main 组用于主 agent 对话（DM/群聊/TUI/webchat），secondary 组用于 cron/subagent
- 两组完全隔离，fallback 不穿透，全挂则报错
- `/model` 命令被拦截，spawn/cron 的 model 指定被拒绝并返回错误信息

### 配置迁移

旧配置路径 `edition.modelIsolation` 和 `kosbling.modelIsolation` 会在启动时自动迁移到根级 `modelIsolation`。

## 开发规范

### 改动记录

所有改动必须同步更新本 README：

- **功能改造** → 记录在「功能改造」区
- **Bug 修复** → 记录在「Bug 修复」区
- 如涉及上游 bug，附上相关 issue 链接

### 功能改动必须同步 System Prompt

任何功能改动都必须考虑是否需要更新 `src/agents/system-prompt.ts` 中的 Kosbling Edition section。

### 代码标记

所有定制改动必须加 `// KOSBLING-PATCH` 注释，便于 upstream 同步时识别冲突。

## 安装

### 前置条件

- Node.js 22+
- pnpm

### 首次安装（目标机器）

```bash
git clone https://github.com/kosbling-ai/openclaw.git ~/.openclaw-kosbling
cd ~/.openclaw-kosbling
./build-and-link.sh
```

### 更新

```bash
cd ~/.openclaw-kosbling
git pull
./build-and-link.sh
```

### 开发机

在 fork 源码目录运行 `./build-and-link.sh` 只会构建，不会注册全局 CLI（避免与运行仓库冲突）。

改完代码后：

```bash
./build-and-link.sh          # 仅构建，验证编译通过
git add -A && git commit     # 提交
git push origin main         # 推送
```

然后在运行仓库（`~/.openclaw-kosbling`）pull + build 部署。

## 版本管理

版本格式：`{upstream_version}-kosbling.{patch}`

例如：`2026.2.21-kosbling.3`

版本号维护在仓库根目录的 `VERSION` 文件中，`build-and-link.sh` 构建时自动读取并写入 `package.json`。

### 发版流程

```bash
# 1. 更新 VERSION 文件
echo "2026.2.21-kosbling.3" > VERSION

# 2. 提交推送
git add -A && git commit -m "release: v2026.2.21-kosbling.3"
git push origin main
```

## 同步上游

```bash
git fetch upstream
git checkout upstream
git merge v2026.2.xx
git checkout main
git merge upstream --no-ff -m "Merge upstream v2026.2.xx"
git push origin main upstream
```

## 分支说明

- `main` — 主开发分支，包含所有 Kosbling Edition 定制
- `upstream` — 跟踪上游 OpenClaw，用于同步合并

## 许可证

沿用上游 OpenClaw 许可证。
