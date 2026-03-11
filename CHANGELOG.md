# Changelog

English (default) | [简体中文](CHANGELOG.zh-CN.md)

Docs: https://docs.openclaw.ai

> Kosbling Edition changelog (concise).
> Only keep practical updates for this fork: upstream sync points, fork-level behavior changes, and notable fixes.

## Unreleased

- WebChat: prevent streamed reply text from disappearing when `final` has no displayable assistant content (thinking-only final now falls back to streamed text).
- WebChat: show `(no visible text)` placeholder for non-streaming assistant empty-shell messages to improve diagnosis.
- WebChat: avoid clearing active stream draft during in-flight `chat.history` refresh.
- Docs/process: README and CHANGELOG are now maintained as fork-focused bilingual docs; each commit should evaluate and sync both language files when user-facing behavior changes.
- Cron isolated sessions: when starting a fresh run (`forceNew`/stale reset), clear inherited `sessionFile` to avoid pointing new `sessionId` at an old transcript file.
- Gateway sessions.patch: allow `spawnedBy` lineage fields on `acp:*` session keys (in addition to `subagent:*`) to avoid ACP spawn patch failures.

## 2026.3.8

- Upstream sync baseline advanced to include `v2026.3.8`.
- Added model isolation main-group token guardrail support (weighted accounting + manual reset controls in WebChat/CLI).
- Added CLI session cleanup flags: `--clear-context-tokens` and optional `--clear-total-tokens-fresh`.
- Continued cleanup of fork-only patches already covered by upstream (models merge/baseUrl precedence and failover status classification).

## 2026.3.7

- Added/expanded fork-facing model isolation behavior and related status/runtime alignment.
- Improved fallback/error visibility for provider failures in embedded runner and logs.
- Added channel-specific DM normalization fix (`p2p -> direct`) for block-deliver behavior consistency.

## Maintenance Notes

- Keep entries short and user-impact focused.
- Prefer one-line bullets; avoid full upstream release duplication.
- Append new items to the active version section.
