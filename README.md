# OpenClaw — Kosbling Edition

基于 [OpenClaw](https://github.com/openclaw/openclaw) 的定制 fork，用于 Kosbling AI 电商助手平台。

## 与上游的关系

- 上游仓库：`https://github.com/openclaw/openclaw.git`
- 同步方式：`git merge --no-ff` 保留合并记录
- 当前基线：`v2026.2.21`

## 定制改动

### 已完成

- **CLI Banner 品牌标识**：CLI 启动时显示 `Kosbling Edition` 标识
  - 文件：`src/cli/banner.ts`
  - ASCII art 龙虾下方增加 `✦ Kosbling Edition ✦`
  - 单行 banner 版本号后增加 `[Kosbling Edition]`
  - 覆盖 rich/plain 两种渲染模式

### 计划中

- **Model 路由隔离**：主 agent 与 cron/subagent 使用完全独立的模型列表，互不串用

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

直接在 fork 源码目录运行：

```bash
./build-and-link.sh
```

## 版本管理

版本格式：`v{upstream_version}-kosbling.{patch}`

例如：`v2026.2.21-kosbling.1`

### 发版流程

```bash
git add -A && git commit -m "描述"
git tag v2026.2.21-kosbling.1
git push origin main --tags
```

## 同步上游

```bash
git fetch upstream
git merge v2026.2.xx --no-ff -m "Merge upstream v2026.2.xx"
git push origin main
```

## 分支说明

- `main` — 主分支，跟踪上游 + Kosbling 定制
- `kosbling` — 与 main 保持同步

## 许可证

沿用上游 OpenClaw 许可证。
