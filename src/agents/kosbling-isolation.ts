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
  agentId?: string, // KOSBLING-PATCH
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

  // Per-agent model override (must be within group allowlist) // KOSBLING-PATCH
  let finalProvider = resolved.ref.provider;
  let finalModel = resolved.ref.model;

  if (agentId && isolation.agents?.[agentId]?.model) {
    const agentModelRaw = isolation.agents[agentId].model;
    const agentResolved = resolveModelRefFromString({
      raw: agentModelRaw,
      defaultProvider: DEFAULT_PROVIDER,
      aliasIndex,
    });

    if (agentResolved) {
      // Build allowlist from group: [primary model, ...fallbacks]
      const groupAllowlist: string[] = [];
      // Add primary
      groupAllowlist.push(`${resolved.ref.provider}/${resolved.ref.model}`);
      // Add fallbacks (resolve each through alias)
      for (const fb of groupCfg.fallbacks ?? []) {
        const fbResolved = resolveModelRefFromString({
          raw: fb,
          defaultProvider: DEFAULT_PROVIDER,
          aliasIndex,
        });
        if (fbResolved) {
          groupAllowlist.push(`${fbResolved.ref.provider}/${fbResolved.ref.model}`);
        }
      }

      const agentModelFull = `${agentResolved.ref.provider}/${agentResolved.ref.model}`;
      if (groupAllowlist.includes(agentModelFull)) {
        finalProvider = agentResolved.ref.provider;
        finalModel = agentResolved.ref.model;
      }
      // If not in allowlist, silently ignore and use group default
    }
  }

  return {
    provider: finalProvider,
    model: finalModel,
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
