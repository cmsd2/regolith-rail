import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare, lengthWarning, type ShareState } from "./share.ts";

const state: ShareState = {
  apiVersion: 2,
  appVersion: "0.0.0",
  view: "batch",
  policy: { name: "naive.lua", source: "return { on_stop = function(ctx) end } -- é ✓" },
  policyB: { name: "b.lua", source: "return ops.policy { target = ops.balance {} }" },
  scenario: { starterId: "relay", text: '{ "format": 1 }' },
  seed: 42,
  saveReloadTest: true,
  batch: { seedCount: 50, baseSeed: 7, compare: true },
};

describe("share links", () => {
  it("round-trip the workbench state", async () => {
    const hash = await encodeShare(state);
    expect(hash).toMatch(/^#v1\.[A-Za-z0-9_-]+$/);
    const decoded = await decodeShare(hash);
    expect(decoded).toEqual({ ok: true, state, warnings: [] });
  });

  it("report a damaged link", async () => {
    const hash = await encodeShare(state);
    const decoded = await decodeShare(hash.slice(0, hash.length - 10));
    expect(decoded.ok).toBe(false);
    expect(await decodeShare("#v1.not-base64!")).toMatchObject({ ok: false });
  });

  it("warn about a different Policy API version", async () => {
    const decoded = await decodeShare(await encodeShare({ ...state, apiVersion: 0 }));
    expect(decoded.ok && decoded.warnings[0]).toContain("Policy API version 0");
  });

  it("warn about very long links", () => {
    expect(lengthWarning("#v1.short")).toBeNull();
    expect(lengthWarning(`#v1.${"a".repeat(9000)}`)).toContain("9,004 characters");
  });
});
