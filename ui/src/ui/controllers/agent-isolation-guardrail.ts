import type {
  AgentsIsolationGuardrailDisableResult,
  AgentsIsolationGuardrailStatusResult,
} from "../types.ts";

export type AgentIsolationGuardrailState = {
  client: {
    request<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  } | null;
  connected: boolean;
  agentIsolationGuardrailLoading: boolean;
  agentIsolationGuardrailError: string | null;
  agentIsolationGuardrailStatus: AgentsIsolationGuardrailStatusResult | null;
};

export async function loadAgentIsolationGuardrail(
  state: AgentIsolationGuardrailState,
  agentId: string,
) {
  if (!state.client || !state.connected || !agentId.trim()) {
    return;
  }
  if (state.agentIsolationGuardrailLoading) {
    return;
  }
  state.agentIsolationGuardrailLoading = true;
  state.agentIsolationGuardrailError = null;
  try {
    const status = await state.client.request<AgentsIsolationGuardrailStatusResult>(
      "agents.isolation-guardrail.status",
      { agentId },
    );
    state.agentIsolationGuardrailStatus = status;
  } catch (err) {
    state.agentIsolationGuardrailError = String(err);
  } finally {
    state.agentIsolationGuardrailLoading = false;
  }
}

export async function disableAgentIsolationGuardrail(
  state: AgentIsolationGuardrailState,
  agentId: string,
) {
  if (!state.client || !state.connected || !agentId.trim()) {
    return false;
  }
  if (state.agentIsolationGuardrailLoading) {
    return false;
  }
  state.agentIsolationGuardrailLoading = true;
  state.agentIsolationGuardrailError = null;
  try {
    await state.client.request<AgentsIsolationGuardrailDisableResult>(
      "agents.isolation-guardrail.disable",
      { agentId },
    );
    await loadAgentIsolationGuardrail(state, agentId);
    return true;
  } catch (err) {
    state.agentIsolationGuardrailError = String(err);
    return false;
  } finally {
    state.agentIsolationGuardrailLoading = false;
  }
}
