import luaparse from "luaparse";

export interface Diagnostic {
  line: number;
  column: number;
  message: string;
}

/** Prefix reserved for names the runtime inserts into policy code. */
export const RESERVED_PREFIX = "__rr";

interface AnyNode {
  type: string;
  range?: [number, number];
  loc?: { start: { line: number; column: number } };
  [key: string]: unknown;
}

const isNode = (value: unknown): value is AnyNode =>
  typeof value === "object" && value !== null && typeof (value as AnyNode).type === "string";

function walk(node: AnyNode, visit: (node: AnyNode) => void): void {
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) walk(item, visit);
    } else if (isNode(value)) {
      walk(value, visit);
    }
  }
}

const at = (node: AnyNode, message: string): Diagnostic => ({
  line: node.loc?.start.line ?? 1,
  column: (node.loc?.start.column ?? 0) + 1,
  message,
});

function syntaxDiagnostic(source: string, error: unknown): Diagnostic {
  const err = error as { line?: number; column?: number; message?: string };
  const message = (err.message ?? String(error)).replace(/^\[\d+:\d+\]\s*/, "");
  const line = err.line ?? 1;
  const text = source.split(/\r?\n/)[line - 1] ?? "";
  if (/\blocal\s+[A-Za-z_]\w*\s*<\s*(const|close)\s*>/.test(text)) {
    return {
      line,
      column: 1,
      message:
        "variable attributes such as <const> are not available in Lua 5.1; use a plain local",
    };
  }
  return { line, column: (err.column ?? 0) + 1, message };
}

const BITWISE = new Set(["&", "|", "~", "<<", ">>"]);

/**
 * Checks a policy against the portable Lua 5.1 subset. Returns every
 * violation found, or a single syntax error.
 */
export function checkPolicySource(source: string): Diagnostic[] {
  let chunk: AnyNode;
  try {
    chunk = luaparse.parse(source, {
      luaVersion: "5.3",
      locations: true,
      ranges: true,
    }) as unknown as AnyNode;
  } catch (error) {
    return [syntaxDiagnostic(source, error)];
  }

  const diagnostics: Diagnostic[] = [];
  walk(chunk, (node) => {
    switch (node.type) {
      case "GotoStatement":
      case "LabelStatement":
        diagnostics.push(
          at(
            node,
            "goto and labels are not available in Lua 5.1; use a loop with break, or if statements",
          ),
        );
        break;
      case "BinaryExpression":
        if (node.operator === "//") {
          diagnostics.push(
            at(node, "integer division // is not available in Lua 5.1; use math.floor(a / b)"),
          );
        } else if (BITWISE.has(node.operator as string)) {
          diagnostics.push(
            at(
              node,
              `bitwise operator ${node.operator} is not available in Lua 5.1; use arithmetic instead`,
            ),
          );
        }
        break;
      case "UnaryExpression":
        if (node.operator === "~") {
          diagnostics.push(
            at(node, "bitwise operator ~ is not available in Lua 5.1; use arithmetic instead"),
          );
        }
        break;
      case "Identifier":
        if ((node.name as string).startsWith(RESERVED_PREFIX)) {
          diagnostics.push(at(node, `names starting with ${RESERVED_PREFIX} are reserved`));
        }
        break;
    }
  });
  if (diagnostics.length > 0)
    return diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);

  // Anything else Lua 5.3 accepts but Lua 5.1 does not.
  try {
    luaparse.parse(source, { luaVersion: "5.1" });
  } catch (error) {
    return [syntaxDiagnostic(source, error)];
  }
  return [];
}

/** Skips whitespace and comments from `pos`. */
function skipTrivia(source: string, pos: number): number {
  let i = pos;
  for (;;) {
    while (i < source.length && /\s/.test(source[i] as string)) i++;
    if (!source.startsWith("--", i)) return i;
    const long = /^--\[(=*)\[/.exec(source.slice(i, i + 64));
    if (long) {
      const close = source.indexOf(`]${long[1]}]`, i + long[0].length);
      i = close < 0 ? source.length : close + (long[1] as string).length + 2;
    } else {
      const newline = source.indexOf("\n", i);
      i = newline < 0 ? source.length : newline + 1;
    }
  }
}

function after(source: string, pos: number, token: string): number {
  const i = skipTrivia(source, pos);
  if (!source.startsWith(token, i))
    throw new Error(`instrumentation expected "${token}" at offset ${i}`);
  return i + token.length;
}

const TICK = ` ${RESERVED_PREFIX}_tick();`;

const CALLS = new Set(["CallExpression", "TableCallExpression", "StringCallExpression"]);

/**
 * Inserts a budget check at the start of every loop body and function body,
 * without changing line numbers. The source must already pass
 * `checkPolicySource`. The result expects `__rr_tick` as the chunk's first
 * vararg.
 *
 * With `keepCallers`, a `return` of a single call is wrapped in parentheses so
 * it is not a tail call, and the returning line stays on the stack for error
 * and source map lines.
 */
export function instrumentPolicySource(
  source: string,
  options: { keepCallers?: boolean } = {},
): string {
  const chunk = luaparse.parse(source, { luaVersion: "5.1", ranges: true }) as unknown as AnyNode;
  const inserts: { at: number; text: string }[] = [];
  const points = { push: (at: number) => inserts.push({ at, text: TICK }) };
  const end = (node: unknown) => (node as AnyNode).range?.[1] ?? 0;

  walk(chunk, (node) => {
    switch (node.type) {
      case "ReturnStatement": {
        const args = node.arguments as AnyNode[];
        const only = args[0];
        if (options.keepCallers && args.length === 1 && only && CALLS.has(only.type)) {
          inserts.push({ at: only.range?.[0] ?? 0, text: "(" }, { at: end(only), text: ")" });
        }
        break;
      }
      case "WhileStatement":
        points.push(after(source, end(node.condition), "do"));
        break;
      case "ForNumericStatement":
        points.push(after(source, end(node.step ?? node.end), "do"));
        break;
      case "ForGenericStatement": {
        const iterators = node.iterators as AnyNode[];
        points.push(after(source, end(iterators[iterators.length - 1]), "do"));
        break;
      }
      case "RepeatStatement":
        points.push(after(source, node.range?.[0] ?? 0, "repeat"));
        break;
      case "FunctionDeclaration": {
        const parameters = node.parameters as AnyNode[];
        let pos: number;
        if (parameters.length > 0) {
          pos = end(parameters[parameters.length - 1]);
        } else {
          const start = node.identifier
            ? end(node.identifier)
            : after(source, node.range?.[0] ?? 0, "function");
          pos = after(source, start, "(");
        }
        points.push(after(source, pos, ")"));
        break;
      }
    }
  });

  let out = source;
  for (const { at, text } of inserts.sort((a, b) => b.at - a.at)) {
    out = out.slice(0, at) + text + out.slice(at);
  }
  return `local ${RESERVED_PREFIX}_tick = ...; ${out}`;
}
