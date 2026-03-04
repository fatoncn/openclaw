import { describe, expect, it } from "vitest";
import { resolveTrustedNetworkSsrFPolicy } from "./trusted-network-ssrf.js";

describe("resolveTrustedNetworkSsrFPolicy", () => {
  it("returns undefined when browser policy is missing", () => {
    expect(resolveTrustedNetworkSsrFPolicy(undefined)).toBeUndefined();
    expect(resolveTrustedNetworkSsrFPolicy({})).toBeUndefined();
  });

  it("requires explicit browser SSRF opt-in keys", () => {
    expect(resolveTrustedNetworkSsrFPolicy({ browser: {} })).toBeUndefined();
    expect(resolveTrustedNetworkSsrFPolicy({ browser: { ssrfPolicy: {} } })).toBeUndefined();
  });

  it("resolves private-network allow when explicitly enabled in network.ssrfPolicy", () => {
    expect(
      resolveTrustedNetworkSsrFPolicy({
        network: { ssrfPolicy: { dangerouslyAllowPrivateNetwork: true } },
      }),
    ).toEqual({ dangerouslyAllowPrivateNetwork: true });
  });

  it("normalizes network allowlists", () => {
    expect(
      resolveTrustedNetworkSsrFPolicy({
        network: {
          ssrfPolicy: {
            allowedHostnames: [" localhost ", "", "example.com"],
            hostnameAllowlist: [" *.corp.local ", ""],
          },
        },
      }),
    ).toEqual({
      allowedHostnames: ["localhost", "example.com"],
      hostnameAllowlist: ["*.corp.local"],
    });
  });

  it("falls back to legacy browser.ssrfPolicy when network.ssrfPolicy is absent", () => {
    expect(
      resolveTrustedNetworkSsrFPolicy({
        browser: { ssrfPolicy: { dangerouslyAllowPrivateNetwork: true } },
      }),
    ).toEqual({ dangerouslyAllowPrivateNetwork: true });
  });
});
