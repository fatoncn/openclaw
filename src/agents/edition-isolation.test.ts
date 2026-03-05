import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeIsolationModelRef, resolveEditionIsolationParams } from "./edition-isolation.js";

function makeConfig(): OpenClawConfig {
  return {
    agents: {
      defaults: {
        models: {
          "anthropic/claude-sonnet-4-5": { alias: "sonnet" },
          "openai/gpt-4o-mini": { alias: "mini" },
          "openai/gpt-4o": { alias: "gpt" },
        },
      },
    },
    modelIsolation: {
      enabled: true,
      main: {
        model: "SoNnEt",
        fallbacks: ["mini"],
      },
      secondary: {
        model: "gpt",
      },
      agents: {
        main: {
          model: "mini",
        },
      },
    },
  } as OpenClawConfig;
}

describe("model isolation alias normalization", () => {
  it("resolves group model aliases case-insensitively", () => {
    const cfg = makeConfig();

    const resolved = resolveEditionIsolationParams(cfg, "agent:main:main");

    expect(resolved).not.toBeNull();
    expect(resolved?.provider).toBe("anthropic");
    expect(resolved?.model).toBe("claude-sonnet-4-5");
  });

  it("accepts in-group fallback alias without rewrite", () => {
    const cfg = makeConfig();

    const normalized = normalizeIsolationModelRef({
      cfg,
      sessionKey: "agent:main:main",
      raw: "mini",
    });

    expect(normalized).not.toBeNull();
    expect(normalized && normalized.ok).toBe(true);
    if (!normalized || !normalized.ok) {
      return;
    }
    expect(normalized.provider).toBe("openai");
    expect(normalized.model).toBe("gpt-4o-mini");
    expect(normalized.rewritten).toBe(false);
    expect(normalized.group).toBe("main");
  });

  it("rewrites out-of-group alias to group default", () => {
    const cfg = makeConfig();

    const normalized = normalizeIsolationModelRef({
      cfg,
      sessionKey: "agent:main:main",
      raw: "gpt",
    });

    expect(normalized).not.toBeNull();
    expect(normalized && normalized.ok).toBe(true);
    if (!normalized || !normalized.ok) {
      return;
    }
    expect(normalized.rewritten).toBe(true);
    expect(normalized.provider).toBe("anthropic");
    expect(normalized.model).toBe("claude-sonnet-4-5");
    expect(normalized.requestedProvider).toBe("openai");
    expect(normalized.requestedModel).toBe("gpt-4o");
  });

  it("supports agent-level alias override when it is in the group allowlist", () => {
    const cfg = makeConfig();

    const resolved = resolveEditionIsolationParams(cfg, "agent:main:main", "main");

    expect(resolved).not.toBeNull();
    expect(resolved?.provider).toBe("openai");
    expect(resolved?.model).toBe("gpt-4o-mini");
  });
});
