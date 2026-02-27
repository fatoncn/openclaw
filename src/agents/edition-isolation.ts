// KOSBLING-PATCH: model isolation
import type { OpenClawConfig } from "../config/config.js";
import { logInfo } from "../logger.js";
import { isCronSessionKey, isSubagentSessionKey } from "../routing/session-key.js";
import { DEFAULT_PROVIDER } from "./defaults.js";
import { buildModelAliasIndex, resolveModelRefFromString } from "./model-selection.js";

export type EditionIsolationParams = {
  provider: string;
  model: string;
  /** Empty array = disable fallback, never cross-group */
  fallbacksOverride: string[];
} | null;

/**
 * Returns model isolation params based on sessionKey and edition config.
 * Returns null if isolation is disabled or not configured — caller uses original logic.
 */
export function resolveEditionIsolationParams(
  cfg: OpenClawConfig,
  sessionKey: string | undefined | null,
  agentId?: string, // KOSBLING-PATCH
): EditionIsolationParams {
  const isolation = cfg.modelIsolation;
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

  const perAgentInfo =
    finalProvider !== resolved.ref.provider || finalModel !== resolved.ref.model
      ? `${finalProvider}/${finalModel}`
      : "none";
  const groupName = isSecondary ? "secondary" : "main";
  logInfo(
    `[edition-isolation] group=${groupName} model=${finalProvider}/${finalModel} agent=${agentId ?? "unknown"} per-agent=${perAgentInfo}`,
  ); // KOSBLING-PATCH

  return {
    provider: finalProvider,
    model: finalModel,
    fallbacksOverride: groupCfg.fallbacks ?? [],
  };
}

/**
 * Returns "provider/model" string for edition secondary group, for subagent spawn.
 * Returns undefined if isolation is disabled or not configured.
 */
export function resolveEditionSubagentModel(cfg: OpenClawConfig): string | undefined {
  const isolation = cfg.modelIsolation;
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
  logInfo(
    `[edition-isolation] subagent-spawn model=${resolved.ref.provider}/${resolved.ref.model}`,
  ); // KOSBLING-PATCH
  return `${resolved.ref.provider}/${resolved.ref.model}`;
}
