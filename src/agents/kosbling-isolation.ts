// KOSBLING-PATCH: model isolation
import type { OpenClawConfig } from "../config/config.js";
import { isCronSessionKey, isSubagentSessionKey } from "../routing/session-key.js";
import { DEFAULT_PROVIDER } from "./defaults.js";
import { buildModelAliasIndex, resolveModelRefFromString } from "./model-selection.js";

export type KosblingIsolationParams = {
  provider: string;
  model: string;
  /** Empty array = disable fallback, never cross-group */
  fallbacksOverride: string[];
} | null;

/**
 * Returns model isolation params based on sessionKey and kosbling config.
 * Returns null if isolation is disabled or not configured — caller uses original logic.
 */
export function resolveKosblingIsolationParams(
  cfg: OpenClawConfig,
  sessionKey: string | undefined | null,
): KosblingIsolationParams {
  const isolation = cfg.kosbling?.modelIsolation;
  if (!isolation?.enabled) {
    return null;
  }

  const isSecondary = isCronSessionKey(sessionKey) || isSubagentSessionKey(sessionKey);
  const groupCfg = isSecondary ? isolation.secondary : isolation.main;

  if (!groupCfg?.model) {
    return null;
  }

  const aliasIndex = buildModelAliasIndex({ cfg, defaultProvider: DEFAULT_PROVIDER });
  const resolved = resolveModelRefFromString({
    raw: groupCfg.model,
    defaultProvider: DEFAULT_PROVIDER,
    aliasIndex,
  });
  if (!resolved) {
    return null;
  }

  return {
    provider: resolved.ref.provider,
    model: resolved.ref.model,
    fallbacksOverride: groupCfg.fallbacks ?? [],
  };
}

/**
 * Returns "provider/model" string for kosbling secondary group, for subagent spawn.
 * Returns undefined if isolation is disabled or not configured.
 */
export function resolveKosblingSubagentModel(cfg: OpenClawConfig): string | undefined {
  const isolation = cfg.kosbling?.modelIsolation;
  if (!isolation?.enabled) {
    return undefined;
  }
  const secondary = isolation.secondary;
  if (!secondary?.model) {
    return undefined;
  }

  const aliasIndex = buildModelAliasIndex({ cfg, defaultProvider: DEFAULT_PROVIDER });
  const resolved = resolveModelRefFromString({
    raw: secondary.model,
    defaultProvider: DEFAULT_PROVIDER,
    aliasIndex,
  });
  if (!resolved) {
    return undefined;
  }
  return `${resolved.ref.provider}/${resolved.ref.model}`;
}
