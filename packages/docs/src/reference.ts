import type { ApiType, OpsBlock } from "@regolith-rail/policy-api";
import { API_PAGE_TITLES } from "./pages.ts";

const blank = (text: string | undefined) => text === undefined || text.trim() === "";

/**
 * Names every Policy API member, `ops` block and parameter that has no
 * reference documentation.
 */
export function checkReference(types: ApiType[], blocks: OpsBlock[]): string[] {
  const problems: string[] = [];
  for (const type of types) {
    if (blank(type.summary)) problems.push(`${type.name} has no documentation`);
    if (!API_PAGE_TITLES[type.docs]) {
      problems.push(`${type.name} is on page ${type.docs}, which has no title`);
    }
    for (const field of type.fields) {
      const name = `${type.name}.${field.name}`;
      if (blank(field.summary)) problems.push(`${name} has no documentation`);
      for (const param of field.params ?? []) {
        if (blank(param.summary)) {
          problems.push(`${name} parameter "${param.name}" has no documentation`);
        }
      }
      if (field.returns && blank(field.returns.summary)) {
        problems.push(`${name} return value has no documentation`);
      }
    }
  }
  const slugs = new Map<string, string>();
  for (const block of blocks) {
    const name = `ops.${block.name}`;
    if (blank(block.summary)) problems.push(`${name} has no documentation`);
    const other = slugs.get(block.docs);
    if (other) problems.push(`${name} and ${other} share the page ${block.docs}`);
    slugs.set(block.docs, name);
    for (const param of block.params) {
      if (blank(param.summary)) {
        problems.push(`${name} parameter "${param.name}" has no documentation`);
      }
    }
  }
  return problems;
}
