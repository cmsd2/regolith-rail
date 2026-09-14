import { formatLua, type StyLuaModule } from "@regolith-rail/scenario-kit";

let loading: Promise<StyLuaModule> | undefined;

/** Loads StyLua's WebAssembly build the first time the player formats, since it is large. */
function loadStyLua(): Promise<StyLuaModule> {
  loading ??= (async () => {
    const [stylua, wasm] = await Promise.all([
      import("@johnnymorganz/stylua/web"),
      import("@johnnymorganz/stylua/stylua_lib_bg.wasm?url"),
    ]);
    await stylua.default({ module_or_path: wasm.default });
    return stylua;
  })().catch((error: unknown) => {
    // Let a later attempt load it again, say after the network comes back.
    loading = undefined;
    throw error;
  });
  return loading;
}

export type FormatResult = { ok: true; source: string } | { ok: false; message: string };

/** Formats Lua as the site's own policies and scripts are laid out. */
export async function formatSource(source: string): Promise<FormatResult> {
  let stylua: StyLuaModule;
  try {
    stylua = await loadStyLua();
  } catch {
    return { ok: false, message: "The formatter could not be loaded." };
  }
  try {
    return { ok: true, source: formatLua(stylua, source) };
  } catch (error) {
    return { ok: false, message: `Not formatted: ${(error as Error).message}` };
  }
}
