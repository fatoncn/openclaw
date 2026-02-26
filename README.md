# OpenClaw — Kosbling Edition

基于 [OpenClaw](https://github.com/openclaw/openclaw) 的定制 fork，用于 Kosbling AI 电商助手平台。

## 与上游的关系

- 上游仓库：`https://github.com/openclaw/openclaw.git`
- 同步方式：`git merge --no-ff` 保留合并记录
- 当前基线：`v2026.2.21`

## 定制改动

所有改动在源码中标记 `// KOSBLING-PATCH`。

### 已完成

- **CLI Banner 品牌标识**（`src/cli/banner.ts`）
  - ASCII art 下方 `✦ Kosbling Edition ✦`，单行 banner `[Kosbling Edition]`

- **Model 隔离**（`src/agents/kosbling-isolation.ts` + 5 个文件）
  - `kosbling.modelIsolation` 配置块，main/secondary 两组完全隔离
  - `/model` 命令、cron payload、spawn 显式指定全部封死
  - 详见下方 Model 隔离章节

- **更新机制禁用**（`src/infra/update-startup.ts` + `src/cli/update-cli/update-command.ts` + `src/config/io.ts`）
  - `openclaw update` 提示用 git pull 方式
  - 启动时 update check 和 config version warning 跳过

- **System Prompt 注入**（`src/agents/system-prompt.ts`）
  - 所有 agent 的 system prompt 中包含 Kosbling Edition 说明
  - 包括 model isolation 配置参考和定制版行为说明

### Model 隔离

openclaw.json 配置：

```json
{
  "kosbling": {
    "modelIsolation": {
      "enabled": true,
      "main": { "model": "provider/model-a", "fallbacks": ["provider/model-b"] },
      "secondary": { "model": "provider/model-c", "fallbacks": ["provider/model-d"] }
    }
  }
}
```

行为：

- `enabled: false` 或不存在 → 走官方原版逻辑，零影响
- `enabled: true` → main 组用于主 agent 对话（DM/群聊/TUI/webchat），secondary 组用于 cron/subagent
- 两组完全隔离，fallback 不穿透，全挂则报错
- `/model` 命令被拦截，spawn/cron 的 model 指定被拒绝并返回错误信息

## 开发规范

### 功能改动必须同步 System Prompt

任何功能改动都必须考虑是否需要更新 `src/agents/system-prompt.ts` 中的 Kosbling Edition section，确保所有 agent 知道定制版的行为变化。

检查清单：

1. 新增/修改了配置项？→ 更新 system prompt 中的配置说明
2. 改变了 agent 可用的命令/工具行为？→ 更新 system prompt 中的行为说明
3. 新增了限制或策略？→ 在 system prompt 中说明

### 代码标记

所有定制改动必须加 `// KOSBLING-PATCH` 注释，便于 upstream 同步时识别冲突。

## 安装

### 前置条件

- Node.js 22+
- pnpm

### 首次安装（目标机器）

```bash
git clone git@github.com:fatoncn/openclaw.git ~/.openclaw-kosbling
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
git push origin kosbling     # 推送
```

然后在运行仓库（`~/.openclaw-kosbling`）pull + build 部署。

## 版本管理

版本格式：`{upstream_version}-kosbling.{patch}`

例如：`2026.2.21-kosbling.2`

版本号维护在仓库根目录的 `VERSION` 文件中，`build-and-link.sh` 构建时自动读取并写入 `package.json`。

### 发版流程

```bash
# 1. 更新 VERSION 文件
echo "2026.2.21-kosbling.3" > VERSION

# 2. 提交推送
git add -A && git commit -m "release: v2026.2.21-kosbling.3"
git push origin kosbling
```

## 同步上游

```bash
git fetch upstream
git merge v2026.2.xx --no-ff -m "Merge upstream v2026.2.xx"
git push origin main
```

## 分支说明

- `main` — 主分支，跟踪上游 + Kosbling 定制
- `kosbling` — 主开发分支
- `feature/*` — 功能分支，合并后保留备查

## 许可证

沿用上游 OpenClaw 许可证。
