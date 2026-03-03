import { randomUUID } from "node:crypto";
import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  isModelIsolationEnabled,
  normalizeIsolationModelRef,
  resolveIsolationAwareModelSelection,
} from "../agents/edition-isolation.js";
import type { ModelCatalogEntry } from "../agents/model-catalog.js";
import {
  resolveAllowedModelRef,
  resolveSubagentConfiguredModelSelection,
} from "../agents/model-selection.js";
import { normalizeGroupActivation } from "../auto-reply/group-activation.js";
import {
  formatThinkingLevels,
  formatXHighModelHint,
  normalizeElevatedLevel,
  normalizeReasoningLevel,
  normalizeThinkLevel,
  normalizeUsageDisplay,
  supportsXHighThinking,
} from "../auto-reply/thinking.js";
import type { OpenClawConfig } from "../config/config.js";
import type { SessionEntry } from "../config/sessions.js";
import { logWarn } from "../logger.js";
import {
  isSubagentSessionKey,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import { applyVerboseOverride, parseVerboseOverride } from "../sessions/level-overrides.js";
import { applyModelOverrideToSessionEntry } from "../sessions/model-overrides.js";
import { normalizeSendPolicy } from "../sessions/send-policy.js";
import { parseSessionLabel } from "../sessions/session-label.js";
import {
  ErrorCodes,
  type ErrorShape,
  errorShape,
  type SessionsPatchParams,
} from "./protocol/index.js";

function invalid(message: string): { ok: false; error: ErrorShape } {
  return { ok: false, error: errorShape(ErrorCodes.INVALID_REQUEST, message) };
}

function normalizeExecHost(raw: string): "sandbox" | "gateway" | "node" | undefined {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "sandbox" || normalized === "gateway" || normalized === "node") {
    return normalized;
  }
  return undefined;
}

function normalizeExecSecurity(raw: string): "deny" | "allowlist" | "full" | undefined {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "deny" || normalized === "allowlist" || normalized === "full") {
    return normalized;
  }
  return undefined;
}

function normalizeExecAsk(raw: string): "off" | "on-miss" | "always" | undefined {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "off" || normalized === "on-miss" || normalized === "always") {
    return normalized;
  }
  return undefined;
}

export async function applySessionsPatchToStore(params: {
  cfg: OpenClawConfig;
  store: Record<string, SessionEntry>;
  storeKey: string;
  patch: SessionsPatchParams;
  loadGatewayModelCatalog?: () => Promise<ModelCatalogEntry[]>;
}): Promise<{ ok: true; entry: SessionEntry } | { ok: false; error: ErrorShape }> {
  const { cfg, store, storeKey, patch } = params;
  const now = Date.now();
  const parsedAgent = parseAgentSessionKey(storeKey);
  const sessionAgentId = normalizeAgentId(parsedAgent?.agentId ?? resolveDefaultAgentId(cfg));
  const isolationEnabled = isModelIsolationEnabled(cfg);
  const resolvedDefault = resolveIsolationAwareModelSelection({
    cfg,
    sessionKey: storeKey,
    agentId: sessionAgentId,
  });
  const resolveSubagentConfiguredModelRaw = (): string | undefined => {
    if (!isSubagentSessionKey(storeKey)) {
      return undefined;
    }
    return resolveSubagentConfiguredModelSelection({
      cfg,
      agentId: sessionAgentId,
    });
  };
  const isRawSubagentConfiguredModel = (raw: string): boolean => {
    const configuredRaw = resolveSubagentConfiguredModelRaw();
    if (!configuredRaw) {
      return false;
    }
    return configuredRaw.trim().toLowerCase() === raw.trim().toLowerCase();
  };
  const parseProviderModelLiteral = (raw: string): { provider: string; model: string } | null => {
    const trimmed = raw.trim();
    const idx = trimmed.indexOf("/");
    if (idx <= 0 || idx >= trimmed.length - 1) {
      return null;
    }
    return { provider: trimmed.slice(0, idx), model: trimmed.slice(idx + 1) };
  };

  const existing = store[storeKey];
  const next: SessionEntry = existing
    ? {
        ...existing,
        updatedAt: Math.max(existing.updatedAt ?? 0, now),
      }
    : { sessionId: randomUUID(), updatedAt: now };

  if ("spawnedBy" in patch) {
    const raw = patch.spawnedBy;
    if (raw === null) {
      if (existing?.spawnedBy) {
        return invalid("spawnedBy cannot be cleared once set");
      }
    } else if (raw !== undefined) {
      const trimmed = String(raw).trim();
      if (!trimmed) {
        return invalid("invalid spawnedBy: empty");
      }
      if (!isSubagentSessionKey(storeKey)) {
        return invalid("spawnedBy is only supported for subagent:* sessions");
      }
      if (existing?.spawnedBy && existing.spawnedBy !== trimmed) {
        return invalid("spawnedBy cannot be changed once set");
      }
      next.spawnedBy = trimmed;
    }
  }

  if ("spawnDepth" in patch) {
    const raw = patch.spawnDepth;
    if (raw === null) {
      if (typeof existing?.spawnDepth === "number") {
        return invalid("spawnDepth cannot be cleared once set");
      }
    } else if (raw !== undefined) {
      if (!isSubagentSessionKey(storeKey)) {
        return invalid("spawnDepth is only supported for subagent:* sessions");
      }
      const numeric = Number(raw);
      if (!Number.isInteger(numeric) || numeric < 0) {
        return invalid("invalid spawnDepth (use an integer >= 0)");
      }
      const normalized = numeric;
      if (typeof existing?.spawnDepth === "number" && existing.spawnDepth !== normalized) {
        return invalid("spawnDepth cannot be changed once set");
      }
      next.spawnDepth = normalized;
    }
  }

  if ("label" in patch) {
    const raw = patch.label;
    if (raw === null) {
      delete next.label;
    } else if (raw !== undefined) {
      const parsed = parseSessionLabel(raw);
      if (!parsed.ok) {
        return invalid(parsed.error);
      }
      for (const [key, entry] of Object.entries(store)) {
        if (key === storeKey) {
          continue;
        }
        if (entry?.label === parsed.label) {
          return invalid(`label already in use: ${parsed.label}`);
        }
      }
      next.label = parsed.label;
    }
  }

  if ("thinkingLevel" in patch) {
    const raw = patch.thinkingLevel;
    if (raw === null) {
      // Clear the override and fall back to model default
      delete next.thinkingLevel;
    } else if (raw !== undefined) {
      const normalized = normalizeThinkLevel(String(raw));
      if (!normalized) {
        const hintProvider = isolationEnabled
          ? resolvedDefault.provider
          : (existing?.providerOverride?.trim() ?? resolvedDefault.provider);
        const hintModel = isolationEnabled
          ? resolvedDefault.model
          : (existing?.modelOverride?.trim() ?? resolvedDefault.model);
        return invalid(
          `invalid thinkingLevel (use ${formatThinkingLevels(hintProvider, hintModel, "|")})`,
        );
      }
      next.thinkingLevel = normalized;
    }
  }

  if ("verboseLevel" in patch) {
    const raw = patch.verboseLevel;
    const parsed = parseVerboseOverride(raw);
    if (!parsed.ok) {
      return invalid(parsed.error);
    }
    applyVerboseOverride(next, parsed.value);
  }

  if ("reasoningLevel" in patch) {
    const raw = patch.reasoningLevel;
    if (raw === null) {
      delete next.reasoningLevel;
    } else if (raw !== undefined) {
      const normalized = normalizeReasoningLevel(String(raw));
      if (!normalized) {
        return invalid('invalid reasoningLevel (use "on"|"off"|"stream")');
      }
      // Persist "off" explicitly so that resolveDefaultReasoningLevel()
      // does not re-enable reasoning for capable models (#24406).
      next.reasoningLevel = normalized;
    }
  }

  if ("responseUsage" in patch) {
    const raw = patch.responseUsage;
    if (raw === null) {
      delete next.responseUsage;
    } else if (raw !== undefined) {
      const normalized = normalizeUsageDisplay(String(raw));
      if (!normalized) {
        return invalid('invalid responseUsage (use "off"|"tokens"|"full")');
      }
      if (normalized === "off") {
        delete next.responseUsage;
      } else {
        next.responseUsage = normalized;
      }
    }
  }

  if ("elevatedLevel" in patch) {
    const raw = patch.elevatedLevel;
    if (raw === null) {
      delete next.elevatedLevel;
    } else if (raw !== undefined) {
      const normalized = normalizeElevatedLevel(String(raw));
      if (!normalized) {
        return invalid('invalid elevatedLevel (use "on"|"off"|"ask"|"full")');
      }
      // Persist "off" explicitly so patches can override defaults.
      next.elevatedLevel = normalized;
    }
  }

  if ("execHost" in patch) {
    const raw = patch.execHost;
    if (raw === null) {
      delete next.execHost;
    } else if (raw !== undefined) {
      const normalized = normalizeExecHost(String(raw));
      if (!normalized) {
        return invalid('invalid execHost (use "sandbox"|"gateway"|"node")');
      }
      next.execHost = normalized;
    }
  }

  if ("execSecurity" in patch) {
    const raw = patch.execSecurity;
    if (raw === null) {
      delete next.execSecurity;
    } else if (raw !== undefined) {
      const normalized = normalizeExecSecurity(String(raw));
      if (!normalized) {
        return invalid('invalid execSecurity (use "deny"|"allowlist"|"full")');
      }
      next.execSecurity = normalized;
    }
  }

  if ("execAsk" in patch) {
    const raw = patch.execAsk;
    if (raw === null) {
      delete next.execAsk;
    } else if (raw !== undefined) {
      const normalized = normalizeExecAsk(String(raw));
      if (!normalized) {
        return invalid('invalid execAsk (use "off"|"on-miss"|"always")');
      }
      next.execAsk = normalized;
    }
  }

  if ("execNode" in patch) {
    const raw = patch.execNode;
    if (raw === null) {
      delete next.execNode;
    } else if (raw !== undefined) {
      const trimmed = String(raw).trim();
      if (!trimmed) {
        return invalid("invalid execNode: empty");
      }
      next.execNode = trimmed;
    }
  }

  if ("model" in patch) {
    const raw = patch.model;
    if (raw === null) {
      applyModelOverrideToSessionEntry({
        entry: next,
        selection: {
          provider: resolvedDefault.provider,
          model: resolvedDefault.model,
          isDefault: true,
        },
      });
    } else if (raw !== undefined) {
      const trimmed = String(raw).trim();
      if (!trimmed) {
        return invalid("invalid model: empty");
      }

      let nextProvider: string;
      let nextModel: string;
      if (isolationEnabled) {
        const normalized = normalizeIsolationModelRef({
          cfg,
          sessionKey: storeKey,
          raw: trimmed,
          agentId: sessionAgentId,
        });
        if (normalized && !normalized.ok) {
          return invalid(normalized.error);
        }
        if (normalized && normalized.ok) {
          nextProvider = normalized.provider;
          nextModel = normalized.model;
          if (normalized.rewritten) {
            logWarn(
              `[sessions.patch] isolation normalized model ${normalized.requestedProvider}/${normalized.requestedModel} -> ${normalized.provider}/${normalized.model} for key=${storeKey} group=${normalized.group}`,
            );
          }
        } else {
          // Isolation enabled but not fully configured: keep standard model resolution.
          if (!params.loadGatewayModelCatalog) {
            return {
              ok: false,
              error: errorShape(ErrorCodes.UNAVAILABLE, "model catalog unavailable"),
            };
          }
          const catalog = await params.loadGatewayModelCatalog();
          const resolved = resolveAllowedModelRef({
            cfg,
            catalog,
            raw: trimmed,
            defaultProvider: resolvedDefault.provider,
            defaultModel: `${resolvedDefault.provider}/${resolvedDefault.model}`,
          });
          if ("error" in resolved) {
            if (isRawSubagentConfiguredModel(trimmed)) {
              const parsed = parseProviderModelLiteral(trimmed);
              if (!parsed) {
                return invalid(resolved.error);
              }
              nextProvider = parsed.provider;
              nextModel = parsed.model;
            } else {
              return invalid(resolved.error);
            }
          } else {
            nextProvider = resolved.ref.provider;
            nextModel = resolved.ref.model;
          }
        }
      } else {
        if (!params.loadGatewayModelCatalog) {
          return {
            ok: false,
            error: errorShape(ErrorCodes.UNAVAILABLE, "model catalog unavailable"),
          };
        }
        const catalog = await params.loadGatewayModelCatalog();
        const resolved = resolveAllowedModelRef({
          cfg,
          catalog,
          raw: trimmed,
          defaultProvider: resolvedDefault.provider,
          defaultModel: `${resolvedDefault.provider}/${resolvedDefault.model}`,
        });
        if ("error" in resolved) {
          if (isRawSubagentConfiguredModel(trimmed)) {
            const parsed = parseProviderModelLiteral(trimmed);
            if (!parsed) {
              return invalid(resolved.error);
            }
            nextProvider = parsed.provider;
            nextModel = parsed.model;
          } else {
            return invalid(resolved.error);
          }
        } else {
          nextProvider = resolved.ref.provider;
          nextModel = resolved.ref.model;
        }
      }

      const isDefault =
        nextProvider === resolvedDefault.provider && nextModel === resolvedDefault.model;
      applyModelOverrideToSessionEntry({
        entry: next,
        selection: {
          provider: nextProvider,
          model: nextModel,
          isDefault,
        },
      });
    }
  }

  if (next.thinkingLevel === "xhigh") {
    const effectiveProvider = isolationEnabled
      ? resolvedDefault.provider
      : (next.providerOverride ?? resolvedDefault.provider);
    const effectiveModel = isolationEnabled
      ? resolvedDefault.model
      : (next.modelOverride ?? resolvedDefault.model);
    if (!supportsXHighThinking(effectiveProvider, effectiveModel)) {
      if ("thinkingLevel" in patch) {
        return invalid(`thinkingLevel "xhigh" is only supported for ${formatXHighModelHint()}`);
      }
      next.thinkingLevel = "high";
    }
  }

  if ("sendPolicy" in patch) {
    const raw = patch.sendPolicy;
    if (raw === null) {
      delete next.sendPolicy;
    } else if (raw !== undefined) {
      const normalized = normalizeSendPolicy(String(raw));
      if (!normalized) {
        return invalid('invalid sendPolicy (use "allow"|"deny")');
      }
      next.sendPolicy = normalized;
    }
  }

  if ("groupActivation" in patch) {
    const raw = patch.groupActivation;
    if (raw === null) {
      delete next.groupActivation;
    } else if (raw !== undefined) {
      const normalized = normalizeGroupActivation(String(raw));
      if (!normalized) {
        return invalid('invalid groupActivation (use "mention"|"always")');
      }
      next.groupActivation = normalized;
    }
  }

  store[storeKey] = next;
  return { ok: true, entry: next };
}
