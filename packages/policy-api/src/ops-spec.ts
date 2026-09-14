/**
 * The ops library, described for the editor and the reference documentation.
 * A test checks that every block and parameter here exists in ops.lua and the
 * other way round.
 */

import type { Level } from "./spec.ts";

export type Stage = "classify" | "target" | "plan" | "allocate" | "pipeline" | "helper";

export interface OpsParam {
  name: string;
  lua: string;
  required: boolean;
  summary: string;
}

export interface OpsBlock {
  /** Name after `ops.`, e.g. `min_max` or `roles.manual`. */
  name: string;
  stage: Stage;
  level: Level;
  summary: string;
  params: OpsParam[];
  /** Documentation page, relative to the documentation root. */
  docs: string;
}

const docs = (name: string) => `ops/${name.replace(/\./g, "-").replace(/_/g, "-")}`;

export const opsBlocks: OpsBlock[] = [
  {
    name: "policy",
    stage: "pipeline",
    level: "local",
    summary:
      "Builds a policy from stages: classify, target, plan and allocate. Only target is required. Returns a policy module.",
    params: [
      {
        name: "classify",
        lua: "Block|function",
        required: false,
        summary: "Gives each site a role. Without it every site has the role any.",
      },
      {
        name: "target",
        lua: "Block|function|table<string, Block|function>",
        required: true,
        summary: "The stock each site should have, as one block or a table of blocks by role.",
      },
      {
        name: "plan",
        lua: "Block|function",
        required: false,
        summary: "Keeps cargo for stations further along and reserves it.",
      },
      {
        name: "allocate",
        lua: "Block|function",
        required: false,
        summary:
          "Shares limited train space between resources. Without it actions go out site by site.",
      },
    ],
    docs: docs("policy"),
  },
  {
    name: "roles.manual",
    stage: "classify",
    level: "local",
    summary:
      "Assigns the roles supply, demand, relay or any by station, for every resource or per resource.",
    params: [
      {
        name: "assignments",
        lua: "table<string, string|table<string, string>>",
        required: true,
        summary: 'Roles by station id, such as { Mine = "supply", Dome = { Food = "demand" } }.',
      },
    ],
    docs: docs("roles.manual"),
  },
  {
    name: "balance",
    stage: "target",
    level: "line",
    summary:
      "Targets the average stock of the resource across the stations that store it, as the balancing baseline does.",
    params: [],
    docs: docs("balance"),
  },
  {
    name: "order_up_to",
    stage: "target",
    level: "local",
    summary: "Targets a fixed level.",
    params: [
      {
        name: "level",
        lua: "integer",
        required: true,
        summary: "Stock to aim for, in milli-units.",
      },
    ],
    docs: docs("order_up_to"),
  },
  {
    name: "min_max",
    stage: "target",
    level: "local",
    summary:
      "Raises the site to max when its inventory position falls below min, and otherwise leaves it alone.",
    params: [
      {
        name: "min",
        lua: "integer",
        required: true,
        summary: "Inventory position below which the site is refilled, in milli-units.",
      },
      {
        name: "max",
        lua: "integer",
        required: true,
        summary: "Level to refill to, in milli-units.",
      },
    ],
    docs: docs("min_max"),
  },
  {
    name: "drain",
    stage: "target",
    level: "local",
    summary: "Targets zero, so trains take everything they can.",
    params: [],
    docs: docs("drain"),
  },
  {
    name: "fill",
    stage: "target",
    level: "local",
    summary: "Targets the site's capacity, so trains leave everything they can.",
    params: [],
    docs: docs("fill"),
  },
  {
    name: "pass_through",
    stage: "target",
    level: "local",
    summary: "Makes no transfers at the site.",
    params: [],
    docs: docs("pass_through"),
  },
  {
    name: "lookahead",
    stage: "plan",
    level: "line",
    summary:
      "Serves the station a train is at first, then keeps and reserves cargo for shortfalls further along. At supply sites, loads only what is needed ahead.",
    params: [],
    docs: docs("lookahead"),
  },
  {
    name: "priority",
    stage: "allocate",
    level: "local",
    summary: "Gives limited train space to higher priority resources first.",
    params: [],
    docs: docs("priority"),
  },
  {
    name: "proportional",
    stage: "allocate",
    level: "local",
    summary: "Shares limited train space in proportion to what each resource asks for.",
    params: [],
    docs: docs("proportional"),
  },
  {
    name: "inventory_position",
    stage: "helper",
    level: "line",
    summary:
      "Stock at a station plus cargo other trains have reserved for it. For use in custom functions.",
    params: [
      {
        name: "ctx",
        lua: "StopContext",
        required: true,
        summary: "The context passed to on_stop.",
      },
      { name: "station", lua: "string", required: true, summary: "Station id." },
      { name: "resource", lua: "string", required: true, summary: "Resource id." },
    ],
    docs: docs("inventory_position"),
  },
];
