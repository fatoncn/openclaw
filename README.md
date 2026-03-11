# OpenClaw — Kosbling Edition

English (default) | [简体中文](README.zh-CN.md)

A customized fork of [OpenClaw](https://github.com/openclaw/openclaw) for the [Kosbling AI Studio](https://kosbling.ai) e-commerce assistant platform.

## Upstream Relationship

- Upstream repository: `https://github.com/openclaw/openclaw.git`
- Sync strategy: `git merge --no-ff` (preserve merge history)
- Current baseline: `upstream/main` (synced 2026-03-09, includes `v2026.3.8`)

## Custom Changes

All custom changes are marked in source code with `// KOSBLING-PATCH`.

### Feature Changes

- **Model Isolation** (`src/agents/edition-isolation.ts` + multiple files)
  - Root-level `modelIsolation` config with fully isolated `main`/`secondary` groups
  - Explicitly blocks `/model`, cron model payload overrides, and spawn-time model overrides
  - Supports per-agent model override (must be in the group allowlist)
  - See [Model Isolation](#model-isolation)
  - Proposal submitted upstream: [Feature Proposal](https://github.com/openclaw/openclaw/discussions/28314)

- **CLI branding in banner** (`src/cli/banner.ts`)
  - `✦ Kosbling Edition ✦` under ASCII art
  - Single-line banner: `[Kosbling Edition]`

- **CLI `--version` includes git commit hash** (`src/cli/program/context.ts`)
  - `openclaw -v` output format: `2026.3.3-kosbling.6 (34ada4a)`

- **Update flow disabled** (`src/infra/update-startup.ts` + `src/cli/update-cli/update-command.ts` + `src/config/io.ts`)
  - `openclaw update` now guides users to `git pull`
  - Startup update check and config version warning are skipped

- **System prompt injection** (`src/agents/system-prompt.ts`)
  - Adds Kosbling Edition guidance to all agent system prompts
  - Includes model-isolation behavior and config guidance

- **Global network SSRF policy for tool fetch paths** (`src/infra/net/trusted-network-ssrf.ts` + related tools/config)
  - Adds root-level `network.ssrfPolicy` as the default SSRF policy for non-browser network tools
  - Current inherited paths: `web_fetch`, `image` remote URL loading, and message attachment URL fetching
  - `tools.web.fetch.ssrfPolicy` remains a per-tool override (higher priority than `network.ssrfPolicy`)
  - Legacy compatibility: if `network.ssrfPolicy` is unset, runtime falls back to `browser.ssrfPolicy`
  - Recommended steady-state: use `network.ssrfPolicy` for global behavior and keep browser policy browser-scoped

### Bug Fixes

> `[Upstream]` means an issue in upstream code. `[Kosbling]` means a follow-up fix needed for our custom behavior.

- **`[Upstream]` HTTP provider errors (401/403/503...) did not trigger model fallback** (`src/agents/pi-embedded-runner/run.ts`)
  - Provider HTTP failures returned as `lastAssistant.stopReason="error"`, wrapped into `isError=true` payloads, and never thrown
  - `runWithModelFallback` catch branch could not trigger
  - Fix: detect `stopReason="error"` in the loop and throw `FailoverError` via `coerceToFailoverError`

- **`[Upstream]` model fallback logs were invisible** (`src/agents/model-fallback.ts`)
  - No visible logs during fallback attempts
  - Fix: add info-level fallback attempt logs to `gateway.log` (stdout)

- **`[Kosbling]` `fallbackConfigured` ignored `modelIsolation` fallbacks** (`src/agents/pi-embedded-runner/run.ts`)
  - Upstream only checked `agents.defaults.model.fallbacks`
  - In isolation mode, this caused fallback checks to be skipped
  - Fix: extend check to include `modelIsolation.enabled` + `main/secondary.fallbacks`

- **`[Kosbling]` false fallback status in `/status`** (`src/auto-reply/status.ts`)
  - Before first runtime model selection, isolation branch could incorrectly display fallback state
  - Fix: add `hasRuntimeModel` guard

- **`[Upstream]` `block_deliver.dm_enable` did not apply in Feishu DM (`p2p`) chats** (`src/channels/chat-type.ts` + tests)
  - Upstream DM normalization recognized `direct`/`dm` only and did not map Feishu `p2p`
  - Result: with `block_deliver.block_disable=true` and `dm_enable=true`, Feishu DMs were still filtered as non-DM targets
  - Fix: normalize `p2p -> direct` so the DM exception path works as expected
- **`[Upstream]` ACP `sessions.patch` lineage validation rejected `acp:*` session keys** (`src/gateway/sessions-patch.ts`)
  - `spawnedBy` updates were restricted to `subagent:*` keys only, while ACP spawn writes `spawnedBy` on `acp:*` keys.
  - Fix: allow `spawnedBy` lineage fields on `subagent:*` or `acp:*` session keys (matches upstream PR #40995 / commit `425bd89`).
- **`[Upstream]` provider transient INTERNAL errors are retryable failover timeouts** (`src/agents/pi-embedded-helpers/failover-matches.ts`)
  - `got status: INTERNAL` and payloads like `{"status":"INTERNAL","code":500}` are classified as transient timeout-style failover errors.
- **`[Upstream]` WebChat streamed text could disappear when `final` had no displayable assistant content** (`ui/src/ui/controllers/chat.ts` + `ui/src/ui/chat/grouped-render.ts`)
  - In some runs, `delta` had visible text but `final.message` only carried thinking blocks (no text/tool/image), so refresh/history replay showed an invisible assistant shell and the streamed draft was lost.
  - Fix: on `final`, apply a visibility guard and fall back to persisted `chatStream` when the final assistant message is not displayable; render `(no visible text)` for non-streaming empty assistant shells; and avoid clearing active stream drafts during in-flight `loadChatHistory()` refreshes.

### Upstream-Covered (no longer fork-only)

- **Models merge-mode provider baseUrl precedence + api drift refresh** (`src/agents/models-config.ts`)
  - Fork-specific merge/baseUrl preservation patches were removed; behavior now follows upstream `planOpenClawModelsJson` flow and upstream test coverage.
- **HTTP 529 classification in failover path** (`src/agents/failover-error.ts`)
  - Fork-specific HTTP status mapping patch was removed; behavior now uses upstream shared classifier (`classifyFailoverReasonFromHttpStatus`), including `529 -> rate_limit`.
- **Gateway supervised restart guardrails** (`src/infra/process-respawn.ts`)
  - The current implementation now comes from upstream and includes supervised-env markers + launchd kickstart flow.

## Model Isolation

`openclaw.json` example:

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

### Block Delivery Policy (new)

```json5
{
  agents: {
    defaults: {
      block_deliver: {
        block_disable: true, // disable block delivery for non-webchat channel targets
        dm_enable: true, // when block_disable is true, still allow block delivery in DMs
      },
    },
  },
}
```

- `block_disable`: when `true`, non-`webchat` targets no longer receive block/stream chunks and only receive final replies.
- `dm_enable`: when `true` and `block_disable=true`, direct-message chats still receive block/stream chunks.
  - Feishu note: `p2p` chat type is treated as `direct`.

Behavior summary:

- `enabled: false` or missing: upstream behavior, no impact
- `enabled: true`: `main` group handles primary agent conversations (DM/group/TUI/webchat), `secondary` group handles cron/subagents
- Groups are fully isolated, fallback does not cross groups, and full failure surfaces as error
- `/model` is intercepted; spawn/cron model overrides are rejected with explicit errors
- Session model overrides (`/model`) are persisted per session; under `modelIsolation`, requested models are normalized to the active group allowlist.
- `/status` shows session-specific override status while keeping the group baseline on the `Edition` line.

For custom provider merge behavior (`openclaw.json` vs per-agent `models.json`), see [Models registry](https://docs.openclaw.ai/concepts/models#models-registry-modelsjson).
For token-window cache reset after model/fallback drift, run `openclaw sessions cleanup --enforce --clear-context-tokens` (optional: add `--clear-total-tokens-fresh`).

### Model Isolation Token Guardrail (main group)

`modelIsolation.main.tokenGuardrail` adds a per-agent guardrail for main-group sessions.
If weighted token usage across that agent's main-group sessions exceeds the configured
window threshold, main-group runs are paused for that agent until you manually disable
the guardrail.

```json5
{
  modelIsolation: {
    enabled: true,
    main: {
      tokenGuardrail: {
        enabled: true,
        windowMinutes: 5,
        maxTokens: 20000,
      },
    },
  },
}
```

Current weighted accounting:

- `input * 1`
- `cacheRead * 0.1`
- `cacheWrite * 1.2`
- `output * 5`

Disable for a specific agent:

```bash
openclaw agents isolation-guardrail disable --agent <agent-id>
```

### Config Migration

Legacy paths `edition.modelIsolation` and `kosbling.modelIsolation` are auto-migrated to root-level `modelIsolation` at startup.

## Development Rules

### Change Log Discipline

Every change must also update this README:

- **Feature change** -> add under "Feature Changes"
- **Bug fix** -> add under "Bug Fixes"
- If it is an upstream bug, include upstream issue links

### System Prompt Sync Required

Any functional change must be evaluated for updates in the Kosbling Edition section of `src/agents/system-prompt.ts`.

### Code Marking

All custom edits must include `// KOSBLING-PATCH` comments to simplify upstream conflict resolution.

## Installation

### Prerequisites

- Node.js 22+
- pnpm

### First Install (target machine)

```bash
git clone https://github.com/kosbling-ai/openclaw.git ~/.openclaw-kosbling
cd ~/.openclaw-kosbling
./build-and-link.sh
```

### Update

```bash
cd ~/.openclaw-kosbling
git pull
./build-and-link.sh
```

### Dev machine

Running `./build-and-link.sh` in the fork source repo only builds and does not register global CLI links (to avoid conflicts with runtime repos).

After code changes:

```bash
./build-and-link.sh          # build only, validate compile
git add -A && git commit     # commit
git push origin main         # push
```

Then pull and build in your runtime repo (`~/.openclaw-kosbling`) to deploy.

## Versioning

Version format: `{upstream_version}-kosbling.{patch}`

Example: `2026.3.3-kosbling.6`

Version is maintained in root `VERSION`. `build-and-link.sh` reads it and writes into `package.json` during build.

### Release Flow

```bash
# 1) Update VERSION
echo "2026.3.3-kosbling.6" > VERSION

# 2) Commit and push
git add -A && git commit -m "release: v2026.3.3-kosbling.6"
git push origin main
```

## Upstream Sync

```bash
git fetch upstream
git checkout upstream
git merge v2026.2.xx
git checkout main
git merge upstream --no-ff -m "Merge upstream v2026.2.xx"
git push origin main upstream
```

## Branches

- `main` - primary development branch with all Kosbling Edition customizations
- `upstream` - tracks upstream OpenClaw for merge/sync operations

## License

Same license as upstream OpenClaw.
