import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { writeGolden } from "./golden.ts";
import { CliError, loadPolicy, loadScenario, parseSeeds, runSeeds, toJson } from "./run.ts";

const USAGE = `Usage:
  regolith-rail run --scenario <starter id | file.json> --policy <policy> [--seed N | --seeds A..B]
                    [--detail full|summary] [--out file.json]
  regolith-rail golden [--out file.json]

Policies: reference:naive`;

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === "run") {
    const { values } = parseArgs({
      args: rest,
      options: {
        scenario: { type: "string" },
        policy: { type: "string" },
        seed: { type: "string" },
        seeds: { type: "string" },
        detail: { type: "string", default: "summary" },
        out: { type: "string" },
      },
    });
    if (!values.scenario || !values.policy)
      throw new CliError(`--scenario and --policy are required\n\n${USAGE}`);
    if (values.detail !== "full" && values.detail !== "summary") {
      throw new CliError("--detail must be full or summary");
    }
    const scenario = loadScenario(values.scenario);
    const policySpec = values.policy;
    const seeds = values.seeds
      ? parseSeeds(values.seeds)
      : values.seed
        ? parseSeeds(values.seed)
        : [scenario.seed];
    loadPolicy(policySpec, scenario);
    const outputs = runSeeds(
      scenario,
      () => loadPolicy(policySpec, scenario),
      seeds,
      values.detail,
    );
    const json = values.seeds ? outputs.map(toJson) : toJson(outputs[0] as never);
    const text = `${JSON.stringify(json, null, 2)}\n`;
    if (values.out) writeFileSync(values.out, text);
    else process.stdout.write(text);
    return 0;
  }
  if (command === "golden") {
    const { values } = parseArgs({ args: rest, options: { out: { type: "string" } } });
    const file = writeGolden(values.out);
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
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
