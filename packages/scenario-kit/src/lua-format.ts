import type * as StyLua from "@johnnymorganz/stylua";
import { SCRIPT_LINE_WIDTH } from "./classic.ts";

/**
 * The parts of StyLua that formatting needs. Node and the browser load different builds of the
 * same WebAssembly formatter, so callers pass the one they loaded.
 */
export type StyLuaModule = Pick<
  typeof StyLua,
  "Config" | "IndentType" | "QuoteStyle" | "CallParenType" | "OutputVerification" | "formatCode"
>;

/**
 * Formats Lua the way the site's own policies and scenario scripts are laid out: two-space
 * indents, 80 columns, double quotes, and calls keeping or leaving out parentheses as written, so
 * `ops.policy { ... }` stays as it is. Throws when the source does not parse.
 */
export function formatLua(stylua: StyLuaModule, source: string): string {
  const once = (code: string) => {
    // Each call takes ownership of its config, so every call builds a fresh one.
    const config = stylua.Config.new();
    config.column_width = SCRIPT_LINE_WIDTH;
    config.indent_type = stylua.IndentType.Spaces;
    config.indent_width = 2;
    config.quote_style = stylua.QuoteStyle.AutoPreferDouble;
    config.call_parentheses = stylua.CallParenType.Input;
    return stylua.formatCode(code, config, undefined, stylua.OutputVerification.None);
  };
  // StyLua can need a second pass to settle a wrapped call, so format until nothing changes.
  let formatted = once(source);
  for (let pass = 0; pass < 3; pass++) {
    const again = once(formatted);
    if (again === formatted) break;
    formatted = again;
  }
  return formatted;
}
