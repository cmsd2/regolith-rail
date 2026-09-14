import * as stylua from "@johnnymorganz/stylua";
import { describe, expect, it } from "vitest";
import { classicTemplates, templateCall } from "./classic.ts";
import { formatLua } from "./lua-format.ts";
import { CLASSIC_POLICIES } from "./policies.generated.ts";
import { STARTER_SCRIPTS } from "./starters.generated.ts";

const formatted = (source: string) => formatLua(stylua, source);

describe("Lua formatting", () => {
  it("lays out code with two-space indents within 80 columns, keeping table calls", () => {
    expect(formatted("local x=1\nif x then ctx.load('Metals', 1) end\n")).toBe(
      'local x = 1\nif x then\n  ctx.load("Metals", 1)\nend\n',
    );
    expect(formatted("return ops.policy { target = ops.balance {} }\n")).toBe(
      "return ops.policy { target = ops.balance {} }\n",
    );
  });

  it("generates template calls and reference policies that are already formatted", () => {
    for (const t of classicTemplates) {
      const call = `${templateCall(t.name, t.defaults)}\n`;
      expect(formatted(call), t.name).toBe(call);
      const policy = t.reference(t.defaults).policy;
      expect(formatted(policy), t.name).toBe(policy);
    }
  });

  it("ships starter scripts and example policies that are already formatted", () => {
    for (const [id, source] of Object.entries({ ...STARTER_SCRIPTS, ...CLASSIC_POLICIES })) {
      expect(formatted(source), id).toBe(source);
    }
  });

  it("throws on Lua that does not parse", () => {
    expect(() => formatted("return {")).toThrow(/unexpected token/);
  });
});
