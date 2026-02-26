# Kosbling Edition 配置说明

## 概述

Kosbling Edition 在 OpenClaw 官方配置基础上，新增 `kosbling` 配置块，用于定制化功能。所有 Kosbling 定制配置位于 `openclaw.json` 的 `kosbling` 顶级字段下。

当 `kosbling` 字段不存在或相关功能未启用时，行为与官方版本完全一致。

## 配置结构

```json
{
  "kosbling": {
    "modelIsolation": {
      "enabled": true,
      "main": {
        "model": "opus",
        "fallbacks": ["sonnet"]
      },
      "secondary": {
        "model": "sonnet",
        "fallbacks": ["haiku"]
      },
      "agents": {
        "service": { "model": "haiku" }
      }
    }
  }
}
```

## Model Isolation（模型隔离）

### 功能说明

将不同类型的 session 分为两组，各组使用独立的模型列表，互不穿透：

- **main 组**：主 agent 直接对话（包括 DM、群聊、TUI、WebChat、Webhook 触发的对话）
- **secondary 组**：cron 定时任务、subagent 子 agent

### 配置项

#### `kosbling.modelIsolation.enabled`

- 类型：`boolean`
- 默认：`false`
- 说明：是否启用模型隔离。设为 `false` 或不配置时，所有行为与官方版本一致。

#### `kosbling.modelIsolation.main`

- 类型：`object`
- 说明：main 组的模型配置。

| 字段        | 类型       | 说明                                                                            |
| ----------- | ---------- | ------------------------------------------------------------------------------- |
| `model`     | `string`   | 主模型，支持 alias（如 `"opus"`）或完整格式（如 `"anthropic/claude-opus-4-6"`） |
| `fallbacks` | `string[]` | 备选模型列表，主模型不可用时按顺序尝试。不配置或空数组表示无备选                |

#### `kosbling.modelIsolation.secondary`

- 类型：`object`
- 说明：secondary 组的模型配置。字段与 main 相同。

#### `kosbling.modelIsolation.agents`

- 类型：`Record<string, { model: string }>`
- 说明：per-agent 模型覆盖。为特定 agent 指定不同于组默认的模型。

**约束**：指定的模型必须在该 agent 所属组的模型列表（`model` + `fallbacks`）内。如果指定的模型不在列表内，将被静默忽略，使用组默认模型。

**示例**：

```json
{
  "main": { "model": "opus", "fallbacks": ["sonnet"] },
  "secondary": { "model": "sonnet", "fallbacks": ["haiku"] },
  "agents": {
    "service": { "model": "sonnet" }
  }
}
```

上例中，`service` agent 的直接对话（main 组）将使用 `sonnet`（在 main 组的 [opus, sonnet] 列表内，允许）。如果配置 `"model": "haiku"`，因为 haiku 不在 main 组列表内，将被忽略。

### 隔离行为

启用后，以下模型切换方式全部被封死：

1. **`/model` 命令** — 拒绝执行，提示 policy 信息
2. **cron payload 指定 model** — 忽略，强制使用 secondary 组模型
3. **`sessions_spawn` 显式指定 model** — 拒绝，返回错误信息
4. **fallback 穿透** — 各组的 fallback 列表独立，不会跨组兜底。所有候选模型都失败时直接报错

### 模型别名（Alias）

`model` 和 `fallbacks` 中的值支持使用在 `agents.defaults.models` 中定义的别名：

```json
{
  "agents": {
    "defaults": {
      "models": {
        "anthropic/claude-opus-4-6": { "alias": "opus" },
        "anthropic/claude-sonnet-4-6": { "alias": "sonnet" },
        "anthropic/claude-haiku-3-5": { "alias": "haiku" }
      }
    }
  },
  "kosbling": {
    "modelIsolation": {
      "enabled": true,
      "main": { "model": "opus", "fallbacks": ["sonnet"] },
      "secondary": { "model": "haiku" }
    }
  }
}
```

### 与官方配置的关系

| 官方配置项                        | 隔离启用后的状态                                     |
| --------------------------------- | ---------------------------------------------------- |
| `agents.defaults.models`          | ✅ 生效 — alias 定义仍被使用                         |
| `agents.defaults.model.primary`   | ⚠️ 仅在对应组未配置 model 时作为 fallback            |
| `agents.defaults.model.fallbacks` | ❌ 被覆盖 — 使用组自己的 fallbacks                   |
| `agents.list[id].model`           | ❌ 被覆盖 — 使用 kosbling.modelIsolation.agents 配置 |
| `agents.defaults.subagents.model` | ❌ 被覆盖 — 使用 secondary 组模型                    |
| `agents.list[id]` 的非 model 配置 | ✅ 生效 — workspace、tools、prompts 等不受影响       |

### 禁用隔离

将 `enabled` 设为 `false` 或删除整个 `kosbling` 块即可恢复官方行为：

```json
{
  "kosbling": {
    "modelIsolation": {
      "enabled": false
    }
  }
}
```
