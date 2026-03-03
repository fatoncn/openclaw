// KOSBLING-PATCH: model isolation
import type { OpenClawConfig } from "../config/config.js";
import { logInfo } from "../logger.js";
import { isCronSessionKey, isSubagentSessionKey } from "../routing/session-key.js";
import { DEFAULT_PROVIDER } from "./defaults.js";
import {
  buildModelAliasIndex,
  resolveDefaultModelForAgent,
  resolveModelRefFromString,
} from "./model-selection.js";

export type EditionIsolationParams = {
  provider: string;
  model: string;
  /** Empty array = disable fallback, never cross-group */
  fallbacksOverride: string[];
} | null;

export type IsolationAwareModelSelection = {
  provider: string;
  model: string;
  /** Present only when isolation is active. */
  fallbacksOverride?: string[];
  isolated: boolean;
};

export type IsolationModelNormalizationResult =
  | {
      ok: true;
      provider: string;
      model: string;
      requestedProvider: string;
      requestedModel: string;
      rewritten: boolean;
      group: "main" | "secondary";
    }
  | {
      ok: false;
      error: string;
    };

export function isModelIsolationEnabled(cfg: OpenClawConfig): boolean {
  return cfg.modelIsolation?.enabled === true;
}

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

/**
 * Resolve the effective runtime model for a session.
 * - isolation enabled: returns isolated model + group fallbacks
 * - isolation disabled: returns the normal per-agent default model
 */
export function resolveIsolationAwareModelSelection(params: {
  cfg: OpenClawConfig;
  sessionKey?: string | null;
  agentId?: string;
}): IsolationAwareModelSelection {
  const isolated = resolveEditionIsolationParams(params.cfg, params.sessionKey, params.agentId);
  if (isolated) {
    return {
      provider: isolated.provider,
      model: isolated.model,
      fallbacksOverride: isolated.fallbacksOverride,
      isolated: true,
    };
  }
  const defaultRef = resolveDefaultModelForAgent({
    cfg: params.cfg,
    agentId: params.agentId,
  });
  return {
    provider: defaultRef.provider,
    model: defaultRef.model,
    isolated: false,
  };
}

/**
 * Normalize a requested model ref to the active isolation group.
 * - Group-in model: accepted as requested.
 * - Group-out model: rewritten to the group's effective default model.
 */
export function normalizeIsolationModelRef(params: {
  cfg: OpenClawConfig;
  sessionKey?: string | null;
  raw: string;
  agentId?: string;
}): IsolationModelNormalizationResult | null {
  if (!isModelIsolationEnabled(params.cfg)) {
    return null;
  }

  const isolation = params.cfg.modelIsolation;
  if (!isolation) {
    return null;
  }
  const group: "main" | "secondary" =
    isCronSessionKey(params.sessionKey) || isSubagentSessionKey(params.sessionKey)
      ? "secondary"
      : "main";
  const groupCfg = group === "secondary" ? isolation.secondary : isolation.main;
  if (!groupCfg?.model) {
    return null;
  }

  const effectiveDefault = resolveIsolationAwareModelSelection({
    cfg: params.cfg,
    sessionKey: params.sessionKey,
    agentId: params.agentId,
  });
  const aliasIndex = buildModelAliasIndex({ cfg: params.cfg, defaultProvider: DEFAULT_PROVIDER });

  const requested = resolveModelRefFromString({
    raw: params.raw,
    defaultProvider: effectiveDefault.provider,
    aliasIndex,
  });
  if (!requested) {
    return {
      ok: false,
      error: `invalid model: ${params.raw.trim()}`,
    };
  }

  const allowlist = new Set<string>();
  const primary = resolveModelRefFromString({
    raw: groupCfg.model,
    defaultProvider: DEFAULT_PROVIDER,
    aliasIndex,
  });
  if (primary) {
    allowlist.add(`${primary.ref.provider}/${primary.ref.model}`);
  }
  for (const fallback of groupCfg.fallbacks ?? []) {
    const resolved = resolveModelRefFromString({
      raw: fallback,
      defaultProvider: DEFAULT_PROVIDER,
      aliasIndex,
    });
    if (resolved) {
      allowlist.add(`${resolved.ref.provider}/${resolved.ref.model}`);
    }
  }

  // Ensure effective default is always considered group-allowed.
  allowlist.add(`${effectiveDefault.provider}/${effectiveDefault.model}`);
  const requestedKey = `${requested.ref.provider}/${requested.ref.model}`;
  if (!allowlist.has(requestedKey)) {
    return {
      ok: true,
      provider: effectiveDefault.provider,
      model: effectiveDefault.model,
      requestedProvider: requested.ref.provider,
      requestedModel: requested.ref.model,
      rewritten: true,
      group,
    };
  }
  return {
    ok: true,
    provider: requested.ref.provider,
    model: requested.ref.model,
    requestedProvider: requested.ref.provider,
    requestedModel: requested.ref.model,
    rewritten: false,
    group,
  };
}
