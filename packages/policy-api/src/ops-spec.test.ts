import { describe, expect, it } from "vitest";
import { OPS_LIBRARY } from "./ops.generated.ts";
import { opsBlocks } from "./ops-spec.ts";

const source = OPS_LIBRARY.ops;

describe("ops block descriptions", () => {
  it("cover every function the library defines", () => {
    const defined = [...source.matchAll(/^function ops\.([\w.]+)\(/gm)].map((m) => m[1]).sort();
    expect(opsBlocks.map((b) => b.name).sort()).toEqual(defined);
  });

  it("list the parameters each block accepts", () => {
    for (const block of opsBlocks) {
      if (block.stage === "pipeline" || block.stage === "helper" || block.name === "roles.manual")
        continue;
      const declaration = new RegExp(`check_params\\("${block.name}", params, \\{([^}]*)\\}`).exec(
        source,
      );
      expect(declaration, block.name).not.toBeNull();
      const accepted = [...(declaration?.[1] ?? "").matchAll(/(\w+) =/g)].map((m) => m[1]).sort();
      expect(block.params.map((p) => p.name).sort(), block.name).toEqual(accepted);
    }
  });

  it("declare the information level the library enforces", () => {
    for (const block of opsBlocks) {
      if (block.stage === "pipeline" || block.stage === "helper") continue;
      // The formatter may break the block's name and level onto separate lines.
      const name = block.name.replace(".", "\\.");
      expect(source, block.name).toMatch(new RegExp(`"${name}",\\s*"${block.level}"`));
    }
  });

  it("give every block a summary and a documentation page", () => {
    for (const block of opsBlocks) {
      expect(block.summary.length, block.name).toBeGreaterThan(10);
      expect(block.docs, block.name).toMatch(/^ops\//);
      for (const param of block.params)
        expect(param.summary.length, `${block.name}.${param.name}`).toBeGreaterThan(5);
    }
  });
});
