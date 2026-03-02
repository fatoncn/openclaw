# OpenClaw — Kosbling Edition

A customized fork of [OpenClaw](https://github.com/openclaw/openclaw) for the [Kosbling AI Studio](https://kosbling.ai) e-commerce assistant platform.

## Upstream Relationship

- Upstream repository: `https://github.com/openclaw/openclaw.git`
- Sync strategy: `git merge --no-ff` (preserve merge history)
- Current baseline: `v2026.2.21`

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
  - `openclaw -v` output format: `2026.2.21-kosbling.4 (34ada4a)`

- **Update flow disabled** (`src/infra/update-startup.ts` + `src/cli/update-cli/update-command.ts` + `src/config/io.ts`)
  - `openclaw update` now guides users to `git pull`
  - Startup update check and config version warning are skipped

- **System prompt injection** (`src/agents/system-prompt.ts`)
  - Adds Kosbling Edition guidance to all agent system prompts
  - Includes model-isolation behavior and config guidance

### Bug Fixes

> `[Upstream]` means an issue in upstream code. `[Kosbling]` means a follow-up fix needed for our custom behavior.

- **`[Upstream]` HTTP 529 did not trigger model fallback** (`src/agents/failover-error.ts`)
  - `resolveFailoverReasonFromError` did not recognize 529 (Anthropic overloaded), so fallback chains were skipped
  - Fix: map 529 into fallback reason `"timeout"`
  - Related issues: [#28502](https://github.com/openclaw/openclaw/issues/28502), [#8112](https://github.com/openclaw/openclaw/issues/8112)

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

- **`[Kosbling]` gateway restart could fork orphan process under launchd** (`src/infra/process-respawn.ts`)
  - During SIGUSR1 restart, supervised-environment detection could miss launchd context and take detached spawn path
  - This left an orphan `openclaw-gateway` process holding port `18789`, while LaunchAgent kept retrying and logging `gateway already running`
  - Fix: treat `XPC_SERVICE_NAME`, `OPENCLAW_LAUNCHD_LABEL`, and `OPENCLAW_SYSTEMD_UNIT` as supervisor hints; restart now returns `supervised` in these contexts

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

Behavior summary:

- `enabled: false` or missing: upstream behavior, no impact
- `enabled: true`: `main` group handles primary agent conversations (DM/group/TUI/webchat), `secondary` group handles cron/subagents
- Groups are fully isolated, fallback does not cross groups, and full failure surfaces as error
- `/model` is intercepted; spawn/cron model overrides are rejected with explicit errors

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

Example: `2026.2.21-kosbling.3`

Version is maintained in root `VERSION`. `build-and-link.sh` reads it and writes into `package.json` during build.

### Release Flow

```bash
# 1) Update VERSION
echo "2026.2.21-kosbling.3" > VERSION

# 2) Commit and push
git add -A && git commit -m "release: v2026.2.21-kosbling.3"
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
