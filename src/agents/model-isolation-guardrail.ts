import fs from "node:fs";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { createAsyncLock, readJsonFile, writeJsonAtomic } from "../infra/json-files.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { isCronSessionKey, isSubagentSessionKey } from "../routing/session-key.js";
import { listAgentIds, resolveAgentDir } from "./agent-scope.js";

type MainTokenGuardrailConfig = {
  enabled: boolean;
  windowMinutes: number;
  maxTokens: number;
};

type MainTokenGuardrailEvent = {
  at: number;
  sessionKey: string;
  tokens: number;
};

type MainTokenGuardrailSession = {
  sessionKey: string;
  triggerCount: number;
  lastTriggeredAt: number;
  lastWindowTokens: number;
};

type MainTokenGuardrailState = {
  active: boolean;
  triggeredAt?: number;
  triggerSessionKey?: string;
  triggerWindowTokens?: number;
  windowMinutes: number;
  maxTokens: number;
  lastWindowTokens: number;
  sessions: Record<string, MainTokenGuardrailSession>;
  events: MainTokenGuardrailEvent[];
  updatedAt: number;
};

type AgentIsolationGuardrailState = {
  version: 1;
  agentId: string;
  mainTokenGuardrail: MainTokenGuardrailState;
};

export type MainTokenGuardrailStatus = {
  agentId: string;
  enabled: boolean;
  active: boolean;
  windowMinutes?: number;
  maxTokens?: number;
  windowTokens?: number;
  triggeredAt?: number;
  triggerSessionKey?: string;
  sessions: MainTokenGuardrailSession[];
};

export type MainTokenGuardrailRecordResult = {
  enabled: boolean;
  triggered: boolean;
  active: boolean;
  windowMinutes?: number;
  maxTokens?: number;
  windowTokens?: number;
};

const DEFAULT_WINDOW_MINUTES = 10;
const DEFAULT_MAX_TOKENS = 120_000;
const STATE_FILE_NAME = "model-isolation-guardrail.json";
const LOCK_BY_PATH = new Map<string, ReturnType<typeof createAsyncLock>>();

function getLock(filePath: string) {
  const cached = LOCK_BY_PATH.get(filePath);
  if (cached) {
    return cached;
  }
  const next = createAsyncLock();
  LOCK_BY_PATH.set(filePath, next);
  return next;
}

function resolveGroupFromSessionKey(sessionKey: string | undefined | null): "main" | "secondary" {
  return isCronSessionKey(sessionKey) || isSubagentSessionKey(sessionKey) ? "secondary" : "main";
}

function resolveMainTokenGuardrailConfig(cfg: OpenClawConfig): MainTokenGuardrailConfig {
  const raw = cfg.modelIsolation?.main?.tokenGuardrail;
  const windowMinutes =
    typeof raw?.windowMinutes === "number" && Number.isFinite(raw.windowMinutes)
      ? Math.max(1, Math.floor(raw.windowMinutes))
      : DEFAULT_WINDOW_MINUTES;
  const maxTokens =
    typeof raw?.maxTokens === "number" && Number.isFinite(raw.maxTokens)
      ? Math.max(1, Math.floor(raw.maxTokens))
      : DEFAULT_MAX_TOKENS;
  return {
    enabled: cfg.modelIsolation?.enabled === true && raw?.enabled === true,
    windowMinutes,
    maxTokens,
  };
}

function resolveStatePath(cfg: OpenClawConfig, agentId: string): string {
  return path.join(resolveAgentDir(cfg, agentId), STATE_FILE_NAME);
}

function buildDefaultState(params: {
  agentId: string;
  config: MainTokenGuardrailConfig;
  now?: number;
}): AgentIsolationGuardrailState {
  return {
    version: 1,
    agentId: params.agentId,
    mainTokenGuardrail: {
      active: false,
      windowMinutes: params.config.windowMinutes,
      maxTokens: params.config.maxTokens,
      lastWindowTokens: 0,
      sessions: {},
      events: [],
      updatedAt: params.now ?? Date.now(),
    },
  };
}

function sanitizeState(
  raw: AgentIsolationGuardrailState | null,
  agentId: string,
  config: MainTokenGuardrailConfig,
): AgentIsolationGuardrailState {
  const fallback = buildDefaultState({ agentId, config });
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const rawMain = raw.mainTokenGuardrail;
  if (!rawMain || typeof rawMain !== "object") {
    return fallback;
  }
  const sessionsRecord: Record<string, MainTokenGuardrailSession> = {};
  for (const [key, value] of Object.entries(rawMain.sessions ?? {})) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const sessionKey = typeof value.sessionKey === "string" ? value.sessionKey : key;
    const triggerCount =
      typeof value.triggerCount === "number" && Number.isFinite(value.triggerCount)
        ? Math.max(0, Math.floor(value.triggerCount))
        : 0;
    const lastTriggeredAt =
      typeof value.lastTriggeredAt === "number" && Number.isFinite(value.lastTriggeredAt)
        ? value.lastTriggeredAt
        : 0;
    const lastWindowTokens =
      typeof value.lastWindowTokens === "number" && Number.isFinite(value.lastWindowTokens)
        ? Math.max(0, value.lastWindowTokens)
        : 0;
    if (!sessionKey.trim()) {
      continue;
    }
    sessionsRecord[sessionKey] = {
      sessionKey,
      triggerCount,
      lastTriggeredAt,
      lastWindowTokens,
    };
  }
  const events = Array.isArray(rawMain.events)
    ? rawMain.events
        .filter((event): event is MainTokenGuardrailEvent => {
          if (!event || typeof event !== "object") {
            return false;
          }
          const at = (event as { at?: unknown }).at;
          const tokens = (event as { tokens?: unknown }).tokens;
          const sessionKey = (event as { sessionKey?: unknown }).sessionKey;
          return (
            typeof at === "number" &&
            Number.isFinite(at) &&
            typeof tokens === "number" &&
            Number.isFinite(tokens) &&
            typeof sessionKey === "string" &&
            sessionKey.trim().length > 0
          );
        })
        .map((event) => ({
          at: event.at,
          tokens: Math.max(0, event.tokens),
          sessionKey: event.sessionKey,
        }))
    : [];
  return {
    version: 1,
    agentId,
    mainTokenGuardrail: {
      active: rawMain.active,
      triggeredAt:
        typeof rawMain.triggeredAt === "number" && Number.isFinite(rawMain.triggeredAt)
          ? rawMain.triggeredAt
          : undefined,
      triggerSessionKey:
        typeof rawMain.triggerSessionKey === "string" && rawMain.triggerSessionKey.trim()
          ? rawMain.triggerSessionKey.trim()
          : undefined,
      triggerWindowTokens:
        typeof rawMain.triggerWindowTokens === "number" &&
        Number.isFinite(rawMain.triggerWindowTokens)
          ? Math.max(0, rawMain.triggerWindowTokens)
          : undefined,
      windowMinutes: config.windowMinutes,
      maxTokens: config.maxTokens,
      lastWindowTokens:
        typeof rawMain.lastWindowTokens === "number" && Number.isFinite(rawMain.lastWindowTokens)
          ? Math.max(0, rawMain.lastWindowTokens)
          : 0,
      sessions: sessionsRecord,
      events,
      updatedAt:
        typeof rawMain.updatedAt === "number" && Number.isFinite(rawMain.updatedAt)
          ? rawMain.updatedAt
          : Date.now(),
    },
  };
}

async function loadState(params: {
  cfg: OpenClawConfig;
  agentId: string;
  config: MainTokenGuardrailConfig;
}): Promise<AgentIsolationGuardrailState> {
  const filePath = resolveStatePath(params.cfg, params.agentId);
  const raw = await readJsonFile<AgentIsolationGuardrailState>(filePath);
  return sanitizeState(raw, params.agentId, params.config);
}

function upsertTriggeredSession(
  sessions: Record<string, MainTokenGuardrailSession>,
  sessionKey: string,
  now: number,
  windowTokens: number,
) {
  const existing = sessions[sessionKey];
  sessions[sessionKey] = {
    sessionKey,
    triggerCount: (existing?.triggerCount ?? 0) + 1,
    lastTriggeredAt: now,
    lastWindowTokens: windowTokens,
  };
}

function pruneEvents(events: MainTokenGuardrailEvent[], cutoff: number): MainTokenGuardrailEvent[] {
  return events.filter((event) => event.at >= cutoff);
}

export async function getMainTokenGuardrailStatus(params: {
  cfg: OpenClawConfig;
  agentId: string;
}): Promise<MainTokenGuardrailStatus> {
  const agentId = normalizeAgentId(params.agentId);
  const config = resolveMainTokenGuardrailConfig(params.cfg);
  const state = await loadState({ cfg: params.cfg, agentId, config });
  const main = state.mainTokenGuardrail;
  const sessions = Object.values(main.sessions).toSorted(
    (a, b) => b.lastTriggeredAt - a.lastTriggeredAt,
  );
  if (!config.enabled) {
    return {
      agentId,
      enabled: false,
      active: false,
      sessions: [],
    };
  }
  return {
    agentId,
    enabled: true,
    active: main.active,
    windowMinutes: main.windowMinutes,
    maxTokens: main.maxTokens,
    windowTokens: main.lastWindowTokens,
    triggeredAt: main.triggeredAt,
    triggerSessionKey: main.triggerSessionKey,
    sessions,
  };
}

export async function disableMainTokenGuardrail(params: {
  cfg: OpenClawConfig;
  agentId: string;
}): Promise<void> {
  const agentId = normalizeAgentId(params.agentId);
  const config = resolveMainTokenGuardrailConfig(params.cfg);
  const filePath = resolveStatePath(params.cfg, agentId);
  const withLock = getLock(filePath);
  await withLock(async () => {
    const state = await loadState({ cfg: params.cfg, agentId, config });
    state.mainTokenGuardrail.active = false;
    state.mainTokenGuardrail.triggeredAt = undefined;
    state.mainTokenGuardrail.triggerSessionKey = undefined;
    state.mainTokenGuardrail.triggerWindowTokens = undefined;
    state.mainTokenGuardrail.lastWindowTokens = 0;
    state.mainTokenGuardrail.events = [];
    state.mainTokenGuardrail.sessions = {};
    state.mainTokenGuardrail.updatedAt = Date.now();
    await writeJsonAtomic(filePath, state, { trailingNewline: true });
  });
}

export async function checkMainTokenGuardrailBlocked(params: {
  cfg: OpenClawConfig;
  agentId: string;
  sessionKey: string;
}): Promise<MainTokenGuardrailStatus> {
  const agentId = normalizeAgentId(params.agentId);
  const config = resolveMainTokenGuardrailConfig(params.cfg);
  if (!config.enabled || resolveGroupFromSessionKey(params.sessionKey) !== "main") {
    return {
      agentId,
      enabled: config.enabled,
      active: false,
      sessions: [],
    };
  }
  const filePath = resolveStatePath(params.cfg, agentId);
  const withLock = getLock(filePath);
  return await withLock(async () => {
    const state = await loadState({ cfg: params.cfg, agentId, config });
    const main = state.mainTokenGuardrail;
    if (main.active) {
      const now = Date.now();
      upsertTriggeredSession(main.sessions, params.sessionKey, now, main.lastWindowTokens);
      main.updatedAt = now;
      await writeJsonAtomic(filePath, state, { trailingNewline: true });
    }
    const sessions = Object.values(main.sessions).toSorted(
      (a, b) => b.lastTriggeredAt - a.lastTriggeredAt,
    );
    return {
      agentId,
      enabled: true,
      active: main.active,
      windowMinutes: main.windowMinutes,
      maxTokens: main.maxTokens,
      windowTokens: main.lastWindowTokens,
      triggeredAt: main.triggeredAt,
      triggerSessionKey: main.triggerSessionKey,
      sessions,
    };
  });
}

export async function recordMainTokenGuardrailUsage(params: {
  cfg: OpenClawConfig;
  agentId: string;
  sessionKey: string;
  tokens: number;
  at?: number;
}): Promise<MainTokenGuardrailRecordResult> {
  const config = resolveMainTokenGuardrailConfig(params.cfg);
  if (!config.enabled || resolveGroupFromSessionKey(params.sessionKey) !== "main") {
    return { enabled: config.enabled, triggered: false, active: false };
  }
  const tokens = Number.isFinite(params.tokens) ? Math.max(0, params.tokens) : 0;
  if (tokens <= 0) {
    return { enabled: true, triggered: false, active: false };
  }
  const agentId = normalizeAgentId(params.agentId);
  const filePath = resolveStatePath(params.cfg, agentId);
  const withLock = getLock(filePath);
  return await withLock(async () => {
    const state = await loadState({ cfg: params.cfg, agentId, config });
    const main = state.mainTokenGuardrail;
    const now = params.at ?? Date.now();
    const cutoff = now - main.windowMinutes * 60_000;
    const nextEvents = pruneEvents(main.events, cutoff);
    nextEvents.push({ at: now, sessionKey: params.sessionKey, tokens });
    const windowTokens = nextEvents.reduce((sum, event) => sum + event.tokens, 0);
    const shouldTrigger = !main.active && windowTokens > main.maxTokens;
    main.events = nextEvents;
    main.lastWindowTokens = windowTokens;
    if (shouldTrigger) {
      main.active = true;
      main.triggeredAt = now;
      main.triggerSessionKey = params.sessionKey;
      main.triggerWindowTokens = windowTokens;
      upsertTriggeredSession(main.sessions, params.sessionKey, now, windowTokens);
    }
    main.updatedAt = now;
    await writeJsonAtomic(filePath, state, { trailingNewline: true });
    return {
      enabled: true,
      triggered: shouldTrigger,
      active: main.active,
      windowMinutes: main.windowMinutes,
      maxTokens: main.maxTokens,
      windowTokens,
    };
  });
}

export async function listActiveGuardrailTriggeredSessionsByAgent(params: {
  cfg: OpenClawConfig;
  agentIds?: string[];
}): Promise<Map<string, Set<string>>> {
  const ids =
    params.agentIds && params.agentIds.length > 0 ? params.agentIds : listAgentIds(params.cfg);
  const out = new Map<string, Set<string>>();
  for (const rawId of ids) {
    const agentId = normalizeAgentId(rawId);
    const status = await getMainTokenGuardrailStatus({ cfg: params.cfg, agentId });
    if (!status.active || status.sessions.length === 0) {
      continue;
    }
    out.set(agentId, new Set(status.sessions.map((session) => session.sessionKey).filter(Boolean)));
  }
  return out;
}

export function listActiveGuardrailTriggeredSessionsByAgentSync(params: {
  cfg: OpenClawConfig;
  agentIds?: string[];
}): Map<string, Set<string>> {
  const ids =
    params.agentIds && params.agentIds.length > 0 ? params.agentIds : listAgentIds(params.cfg);
  const out = new Map<string, Set<string>>();
  for (const rawId of ids) {
    const agentId = normalizeAgentId(rawId);
    const config = resolveMainTokenGuardrailConfig(params.cfg);
    if (!config.enabled) {
      continue;
    }
    const filePath = resolveStatePath(params.cfg, agentId);
    let raw: AgentIsolationGuardrailState | null = null;
    try {
      const text = fs.readFileSync(filePath, "utf8");
      raw = JSON.parse(text) as AgentIsolationGuardrailState;
    } catch {
      raw = null;
    }
    const state = sanitizeState(raw, agentId, config);
    const sessions = Object.values(state.mainTokenGuardrail.sessions)
      .map((session) => session.sessionKey)
      .filter(Boolean);
    if (!state.mainTokenGuardrail.active || sessions.length === 0) {
      continue;
    }
    out.set(agentId, new Set(sessions));
  }
  return out;
}
