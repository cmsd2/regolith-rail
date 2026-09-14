import { copyName, type ItemId, type LibraryItem, newMineId, uniqueName } from "./library.ts";

/** Names already used by Mine items of the same kind, except the item being renamed. */
export const takenNames = (
  items: readonly LibraryItem[],
  kind: LibraryItem["kind"],
  except?: ItemId,
) =>
  items.filter((i) => i.source === "mine" && i.kind === kind && i.id !== except).map((i) => i.name);

/** A Mine item renamed, keeping names unique within its kind. */
export function renamed<T extends LibraryItem>(
  item: T,
  name: string,
  items: readonly LibraryItem[],
  now: number,
): T {
  const trimmed = name.trim() || item.name;
  return {
    ...item,
    name: uniqueName(trimmed, takenNames(items, item.kind, item.id)),
    updatedAt: now,
  };
}

/** A new Mine copy of any item, named after it. */
export function duplicated<T extends LibraryItem>(
  item: T,
  items: readonly LibraryItem[],
  now: number,
): T {
  const { listed: _listed, example: _example, ...rest } = item;
  return {
    ...rest,
    id: newMineId(item.kind),
    source: "mine",
    name: copyName(item.name, takenNames(items, item.kind)),
    origin: item.id,
    createdAt: now,
    updatedAt: now,
  } as T;
}
