import type { SsrFPolicy } from "./ssrf.js";

type BrowserSsrFPolicyLike = {
  allowPrivateNetwork?: boolean;
  dangerouslyAllowPrivateNetwork?: boolean;
  allowedHostnames?: string[];
  hostnameAllowlist?: string[];
};

type BrowserConfigLike = {
  ssrfPolicy?: BrowserSsrFPolicyLike;
};

type TrustedNetworkConfigLike = {
  network?: {
    ssrfPolicy?: BrowserSsrFPolicyLike;
  };
  browser?: BrowserConfigLike;
};

function normalizeStringList(values: string[] | undefined): string[] | undefined {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Resolve an explicit trusted-network SSRF policy from config.
 * We intentionally require explicit opt-in keys and do not inherit browser defaults.
 */
export function resolveTrustedNetworkSsrFPolicy(
  cfg?: TrustedNetworkConfigLike,
): SsrFPolicy | undefined {
  // Preferred global policy path.
  const policy = cfg?.network?.ssrfPolicy ?? cfg?.browser?.ssrfPolicy;
  if (!policy || typeof policy !== "object") {
    return undefined;
  }
  const allowPrivateNetwork =
    policy.dangerouslyAllowPrivateNetwork === true || policy.allowPrivateNetwork === true;
  const allowedHostnames = normalizeStringList(policy.allowedHostnames);
  const hostnameAllowlist = normalizeStringList(policy.hostnameAllowlist);

  if (!allowPrivateNetwork && !allowedHostnames && !hostnameAllowlist) {
    return undefined;
  }

  return {
    ...(allowPrivateNetwork ? { dangerouslyAllowPrivateNetwork: true } : {}),
    ...(allowedHostnames ? { allowedHostnames } : {}),
    ...(hostnameAllowlist ? { hostnameAllowlist } : {}),
  };
}
