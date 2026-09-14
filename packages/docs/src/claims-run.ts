import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, join, relative } from "node:path";
import { maximaChecks } from "./claims.ts";

/** A notebook in the Jupyter format Aximar reads, starting with the shared prelude cell. */
export function notebookWithPrelude(prelude: string, cells: string[]): string {
  const code = (source: string) => ({
    cell_type: "code",
    source,
    metadata: {},
    execution_count: null,
    outputs: [],
  });
  return `${JSON.stringify(
    {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: { kernelspec: { name: "maxima", display_name: "Maxima", language: "maxima" } },
      cells: [code(prelude.trim()), ...cells.map(code)],
    },
    null,
    1,
  )}\n`;
}

const firstCodeCell = (notebook: string) => {
  const parsed = JSON.parse(notebook) as { cells?: { cell_type?: string; source?: unknown }[] };
  const cell = parsed.cells?.find((c) => c.cell_type === "code");
  const source = cell?.source;
  return (
    Array.isArray(source) ? source.join("") : typeof source === "string" ? source : ""
  ).trim();
};

const RUNNER_MARK = "# runner:";
const runnerOf = (script: string) => {
  const at = script.indexOf(RUNNER_MARK);
  return at === -1 ? undefined : script.slice(at).replace(/\r\n/g, "\n").trim();
};

/**
 * Problems with the shape of a page's check files: a notebook that doesn't start with the shared
 * prelude, a script without the shared runner, and check cells that verify nothing.
 */
export function checkFileShape(
  file: string,
  text: string,
  shared: { prelude: string; pythonTemplate: string },
): string[] {
  const name = basename(file);
  if (file.endsWith(".macnb")) {
    const problems: string[] = [];
    if (firstCodeCell(text) !== shared.prelude.trim()) {
      problems.push(`${name}: the first cell must be the shared prelude from checks/prelude.mac`);
    }
    for (const [check, source] of maximaChecks(text)) {
      if (!/\bexpect_(equal|close)\(/.test(source)) {
        problems.push(`${name}: check ${check} calls neither expect_equal nor expect_close`);
      }
    }
    return problems;
  }
  return runnerOf(text) === runnerOf(shared.pythonTemplate)
    ? []
    : [`${name}: must end with the shared runner from checks/template.checks.py`];
}

export interface Tools {
  aximar: string;
  maxima: string;
  uv: string;
}

const onPath = (env: NodeJS.ProcessEnv, names: string[]) => {
  for (const dir of (env.PATH ?? env.Path ?? "").split(delimiter)) {
    for (const name of names) {
      const path = join(dir, name);
      if (dir && existsSync(path)) return path;
    }
  }
  return undefined;
};

/** Finds the notebook runner, Maxima and uv, or says what is missing and how to get it. */
export function findTools(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): { tools: Tools } | { missing: string[] } {
  const windows = platform === "win32";
  const aximar =
    (env.AXIMAR_MCP && existsSync(env.AXIMAR_MCP) ? env.AXIMAR_MCP : undefined) ??
    onPath(env, windows ? ["aximar-mcp.exe"] : ["aximar-mcp"]);
  const maxima =
    (env.AXIMAR_MAXIMA_PATH && existsSync(env.AXIMAR_MAXIMA_PATH)
      ? env.AXIMAR_MAXIMA_PATH
      : undefined) ??
    onPath(env, windows ? ["maxima.bat", "maxima.exe"] : ["maxima"]) ??
    (windows && existsSync("C:\\")
      ? readdirSync("C:\\")
          .filter((d) => /^maxima-/.test(d))
          .map((d) => `C:\\${d}\\bin\\maxima.bat`)
          .find((p) => existsSync(p))
      : undefined);
  const uv = onPath(env, windows ? ["uv.exe"] : ["uv"]);
  const missing = [
    ...(aximar
      ? []
      : [
          "aximar-mcp: download aximar-tools for your platform from https://github.com/cmsd2/aximar/releases/tag/tools-v0.4.1 and put it on PATH, or set AXIMAR_MCP",
        ]),
    ...(maxima
      ? []
      : [
          "Maxima: install it from https://maxima.sourceforge.io/ (apt install maxima on Ubuntu), or set AXIMAR_MAXIMA_PATH",
        ]),
    ...(uv ? [] : ["uv: install it from https://docs.astral.sh/uv/"]),
  ];
  return aximar && maxima && uv ? { tools: { aximar, maxima, uv } } : { missing };
}

/** Every checks notebook and script under a content folder. */
export function checkFilesUnder(root: string): string[] {
  return readdirSync(root, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.checks\.(macnb|py)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

export interface RunResult {
  ok: boolean;
  output: string;
}

/** Runs one checks file: a notebook through aximar-mcp in a temporary copy, a script through uv. */
export function runCheckFile(file: string, tools: Tools): RunResult {
  if (file.endsWith(".macnb")) {
    const dir = mkdtempSync(join(tmpdir(), "regolith-checks-"));
    try {
      const copy = join(dir, basename(file));
      copyFileSync(file, copy);
      // The notebooks are repository content reviewed like code, and `load` counts as dangerous.
      const run = spawnSync(
        tools.aximar,
        ["run", copy, "-o", join(dir, "out.macnb"), "--allow-dangerous"],
        {
          encoding: "utf8",
          env: { ...process.env, AXIMAR_MAXIMA_PATH: tools.maxima },
          timeout: 300_000,
        },
      );
      return { ok: run.status === 0, output: `${run.stdout ?? ""}${run.stderr ?? ""}` };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const run = spawnSync(tools.uv, ["run", "--script", file], {
    encoding: "utf8",
    timeout: 600_000,
  });
  return { ok: run.status === 0, output: `${run.stdout ?? ""}${run.stderr ?? ""}` };
}

/** The failure lines worth reporting from a run's output. */
export function failuresIn(output: string): string[] {
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /check failed|Error:|FAILED|contains dangerous/.test(l));
  return lines.length > 0 ? lines : [output.trim().split(/\r?\n/).slice(-3).join(" ")];
}

/** Runs every checks file under a content folder and names each failure with its page. */
export function runClaims(
  root: string,
  tools: Tools,
  shared: { prelude: string; pythonTemplate: string },
  run: (file: string, tools: Tools) => RunResult = runCheckFile,
): { files: number; problems: string[] } {
  const problems: string[] = [];
  const files = checkFilesUnder(root);
  for (const file of files) {
    const page = relative(root, file)
      .replace(/\\/g, "/")
      .replace(/\.checks\.(macnb|py)$/, "");
    problems.push(
      ...checkFileShape(file, readFileSync(file, "utf8"), shared).map((p) => `${page}: ${p}`),
    );
    const result = run(file, tools);
    if (!result.ok) {
      for (const failure of failuresIn(result.output))
        problems.push(`${page}: ${basename(file)}: ${failure}`);
    }
  }
  return { files: files.length, problems };
}
