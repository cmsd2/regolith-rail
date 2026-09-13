import { LuaRuntime } from "@regolith-rail/lua-runtime";
import wasmUrl from "@regolith-rail/lua-runtime/wasm-url";
import * as Comlink from "comlink";
import type { SimulationWorkerApi } from "./protocol.ts";
import { simulationTasks } from "./simulate.ts";

const tasks = LuaRuntime.load(wasmUrl).then(simulationTasks);

const api: SimulationWorkerApi = {
  async run(request, progress) {
    const output = (await tasks).run(request, progress);
    const transfers = [
      output.stock?.buffer,
      output.cargo?.buffer,
      output.backorders?.buffer,
    ].filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
    return Comlink.transfer(output, transfers);
  },
  async runSeeds(request, progress) {
    return (await tasks).runSeeds(request, progress);
  },
  async check(source) {
    return (await tasks).check(source);
  },
  async loadScript(source) {
    return (await tasks).loadScript(source);
  },
  async modReady(policy, scenario) {
    return (await tasks).modReady(policy, scenario);
  },
};

Comlink.expose(api);
