/**
 * Encodes plain data as a Lua table constructor (`return {...}`). Arrays become
 * sequences starting at 1; object keys become string keys. Numbers must be
 * finite: snapshots never contain anything else.
 */
export function toLuaLiteral(value: unknown): string {
  return `return ${encode(value)}`;
}

function encodeString(text: string): string {
  let out = '"';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const ch = text[i] as string;
    if (ch === '"' || ch === "\\") out += `\\${ch}`;
    else if (code < 0x20 || code === 0x7f) out += `\\${code}`;
    else out += ch;
  }
  return `${out}"`;
}

function encode(value: unknown): string {
  switch (typeof value) {
    case "string":
      return encodeString(value);
    case "number":
      if (!Number.isFinite(value)) throw new Error(`cannot pass ${value} to Lua`);
      return Number.isInteger(value) ? String(value) : value.toPrecision(17);
    case "boolean":
      return value ? "true" : "false";
    case "object": {
      if (value === null) return "nil";
      if (Array.isArray(value)) return `{${value.map(encode).join(",")}}`;
      const parts: string[] = [];
      for (const [key, item] of Object.entries(value)) {
        if (item === undefined) continue;
        parts.push(`[${encodeString(key)}]=${encode(item)}`);
      }
      return `{${parts.join(",")}}`;
    }
    default:
      return "nil";
  }
}
