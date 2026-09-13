import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { writeGolden } from "./golden.ts";
import {
  CliError,
  loadScenario,
  loadScriptScenario,
  needsLua,
  POLICY_HELP,
  parseSeeds,
  resolvePolicy,
  runSeeds,
  scenarioNeedsLua,
  templateScript,
  toJson,
} from "./run.ts";

const USAGE = `Usage:
  regolith-rail run (--scenario <starter id | file.json | script.lua> | --template <name> [--param name=value ...])
                    --policy <policy> [--seed N | --seeds A..B] [--detail full|summary] [--out file.json]
  regolith-rail golden [--out file.json]

Policies: ${POLICY_HELP}`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "run") {
    const { values } = parseArgs({
      args: rest,
      options: {
        scenario: { type: "string" },
        template: { type: "string" },
        param: { type: "string", multiple: true, default: [] },
        policy: { type: "string" },
        seed: { type: "string" },
        seeds: { type: "string" },
        detail: { type: "string", default: "summary" },
        out: { type: "string" },
      },
    });
    if (!values.policy || (values.scenario === undefined) === (values.template === undefined)) {
      throw new CliError(`--policy and one of --scenario or --template are required\n\n${USAGE}`);
    }
    if (values.detail !== "full" && values.detail !== "summary") {
      throw new CliError("--detail must be full or summary");
    }
    const spec = values.policy;
    const scriptNeeded = values.template !== undefined || scenarioNeedsLua(values.scenario ?? "");
    const runtime = needsLua(spec) || scriptNeeded ? await LuaRuntime.load() : undefined;
    const scenario =
      values.template !== undefined
        ? loadScriptScenario(
            templateScript(values.template, values.param),
            values.template,
            runtime as LuaRuntime,
          )
        : loadScenario(values.scenario as string, runtime);
    const policy = resolvePolicy(spec, runtime);
    const seeds = values.seeds
      ? parseSeeds(values.seeds)
      : values.seed
        ? parseSeeds(values.seed)
        : [scenario.seed];
    const outputs = runSeeds(scenario, () => policy, seeds, values.detail);
    const json = values.seeds ? outputs.map(toJson) : toJson(outputs[0] as never);
    const text = `${JSON.stringify(json, null, 2)}\n`;
    if (values.out) writeFileSync(values.out, text);
    else process.stdout.write(text);
    return 0;
  }
  if (command === "golden") {
    const { values } = parseArgs({ args: rest, options: { out: { type: "string" } } });
    const file = await writeGolden(values.out);
    process.stderr.write(`wrote ${file}\n`);
    return 0;
  }
  process.stderr.write(`${USAGE}\n`);
  return command === undefined || command === "help" || command === "--help" ? 0 : 2;
}

// Stop quietly when output is piped into a command that exits early, such as `head`.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
