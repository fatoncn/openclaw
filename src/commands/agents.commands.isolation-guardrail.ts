import { listAgentIds, resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  disableMainTokenGuardrail,
  getMainTokenGuardrailStatus,
} from "../agents/model-isolation-guardrail.js";
import { loadConfig } from "../config/config.js";
import { normalizeAgentId } from "../routing/session-key.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";

type AgentsIsolationGuardrailOptions = {
  agent?: string;
  json?: boolean;
};

function resolveAgentIdOrThrow(
  cfg: ReturnType<typeof loadConfig>,
  rawAgentId: string | undefined,
): string {
  const known = new Set(listAgentIds(cfg));
  const candidate = rawAgentId?.trim()
    ? normalizeAgentId(rawAgentId.trim())
    : resolveDefaultAgentId(cfg);
  if (!known.has(candidate)) {
    throw new Error(`Unknown agent id: ${candidate}`);
  }
  return candidate;
}

export async function agentsIsolationGuardrailStatusCommand(
  opts: AgentsIsolationGuardrailOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const cfg = loadConfig();
  const agentId = resolveAgentIdOrThrow(cfg, opts.agent);
  const status = await getMainTokenGuardrailStatus({ cfg, agentId });
  if (opts.json) {
    runtime.log(JSON.stringify(status, null, 2));
    return;
  }
  const lines = [`Agent: ${agentId}`];
  if (!status.enabled) {
    lines.push("Guardrail: disabled in config");
    runtime.log(lines.join("\n"));
    return;
  }
  lines.push(`Guardrail: ${status.active ? "triggered" : "idle"}`);
  lines.push(`Window: ${status.windowMinutes ?? "-"} minutes`);
  lines.push(`Threshold: ${status.maxTokens ?? "-"} tokens`);
  lines.push(`Current window: ${status.windowTokens ?? 0} tokens`);
  if (status.triggeredAt) {
    lines.push(`Triggered at: ${new Date(status.triggeredAt).toLocaleString()}`);
  }
  if (status.triggerSessionKey) {
    lines.push(`Trigger session: ${status.triggerSessionKey}`);
  }
  if (status.sessions.length > 0) {
    lines.push("Triggered sessions:");
    for (const session of status.sessions) {
      lines.push(
        `- ${session.sessionKey} · count=${session.triggerCount} · windowTokens=${session.lastWindowTokens}`,
      );
    }
  } else {
    lines.push("Triggered sessions: none");
  }
  runtime.log(lines.join("\n"));
}

export async function agentsIsolationGuardrailDisableCommand(
  opts: AgentsIsolationGuardrailOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const cfg = loadConfig();
  const agentId = resolveAgentIdOrThrow(cfg, opts.agent);
  await disableMainTokenGuardrail({ cfg, agentId });
  const result = { ok: true, agentId };
  if (opts.json) {
    runtime.log(JSON.stringify(result, null, 2));
    return;
  }
  runtime.log(`Disabled isolation guardrail for agent ${agentId}.`);
}
