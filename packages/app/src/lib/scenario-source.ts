import {
  type Scenario,
  starterScenario,
  starterScenarios,
  validateScenario,
} from "@regolith-rail/engine";
import {
  classicTemplates,
  STARTER_SCRIPTS,
  type TemplateParams,
  templateCall,
} from "@regolith-rail/scenario-kit";

export type ScenarioKind = "script" | "json";

/** A scenario as the player wrote it, before evaluation. */
export interface ScenarioSource {
  kind: ScenarioKind;
  source: string;
  /** Starter the source came from, while it is unedited. */
  starterId: string | null;
  /** Template and parameters the source was written from, while it is unedited. */
  template?: { name: string; params: TemplateParams };
}

/** A problem with a scenario, at a script line or a document path when known. */
export interface ScenarioError {
  message: string;
  path?: string;
  line?: number;
}

export const DEFAULT_SCENARIO = "two-station";

export const isStarter = (id: string | null): id is string =>
  id !== null && starterScenarios.some((s) => s.id === id);

export function starterSource(id: string): ScenarioSource {
  const source = STARTER_SCRIPTS[id];
  if (source === undefined) throw new Error(`unknown starter scenario ${id}`);
  return { kind: "script", source, starterId: id };
}

export function templateSource(name: string, params: TemplateParams): ScenarioSource {
  return {
    kind: "script",
    source: templateCall(name, params),
    starterId: null,
    template: { name, params },
  };
}

export const findTemplate = (name: string) => classicTemplates.find((t) => t.name === name);

/**
 * The scenario an unedited starter evaluates to, known without running its script: tests prove
 * each starter script evaluates to exactly its recorded document.
 */
export function knownScenario(source: ScenarioSource): Scenario | null {
  return isStarter(source.starterId) && source.source === STARTER_SCRIPTS[source.starterId]
    ? starterScenario(source.starterId)
    : null;
}

export const documentText = (scenario: Scenario) => `${JSON.stringify(scenario, null, 2)}\n`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * A scenario record from a share link, save or draft, including records made before scenario
 * scripts, which held JSON text. An unedited starter becomes its script; a format 1 document is
 * shown upgraded to format 2.
 */
export function upgradeScenarioRecord(value: unknown): ScenarioSource | null {
  if (!isRecord(value)) return null;
  const starterId = typeof value.starterId === "string" ? value.starterId : null;
  if (value.kind === "script" || value.kind === "json") {
    if (typeof value.source !== "string") return null;
    const template =
      isRecord(value.template) &&
      typeof value.template.name === "string" &&
      isRecord(value.template.params)
        ? { name: value.template.name, params: value.template.params as TemplateParams }
        : undefined;
    return {
      kind: value.kind,
      source: value.source,
      starterId: isStarter(starterId) ? starterId : null,
      ...(template && findTemplate(template.name) ? { template } : {}),
    };
  }
  if (typeof value.text !== "string") return null;
  let text = value.text;
  try {
    const document = JSON.parse(text) as { format?: unknown };
    const result = validateScenario(document);
    if (result.ok && isStarter(starterId) && sameScenario(result.scenario, starterId)) {
      return starterSource(starterId);
    }
    if (result.ok && document.format === 1) text = documentText(result.scenario);
  } catch {
    // Text that is not JSON stays as it was, with its errors shown in the editor.
  }
  return { kind: "json", source: text, starterId: null };
}

/** Whether a document, in any format, is an unedited starter. */
const sameScenario = (scenario: Scenario, starterId: string) =>
  JSON.stringify(scenario) === JSON.stringify(starterScenario(starterId));

// --- Documents as scripts -----------------------------------------------------------------

const SOL = 86_400_000;
const DURATIONS: [string, number][] = [
  ["weeks", 7 * SOL],
  ["sols", SOL],
  ["hours", 3_600_000],
  ["minutes", 60_000],
];

function duration(ms: number): string {
  for (const [helper, size] of DURATIONS) {
    if (ms > 0 && ms % size === 0) return `${helper}(${ms / size})`;
  }
  return String(ms);
}

/** Thousandths as an exact decimal, such as 2500 as 2.5. */
function thousandths(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 1000);
  const rest = abs % 1000;
  return rest === 0
    ? `${sign}${whole}`
    : `${sign}${whole}.${String(rest).padStart(3, "0").replace(/0+$/, "")}`;
}

const str = (text: string) => JSON.stringify(text);

type Value = string | undefined | false;

/** A construct call with its fields, one per line, skipping those that are left out. */
function call(name: string, fields: [string, Value][], indent: string): string {
  const inner = `${indent}  `;
  const lines = fields.filter(([, v]) => v !== undefined && v !== false) as [string, string][];
  if (lines.length === 0) return `${name} {}`;
  return `${name} {\n${lines.map(([k, v]) => `${inner}${k} = ${v},`).join("\n")}\n${indent}}`;
}

function list(items: string[], indent: string): string {
  if (items.length === 0) return "{}";
  const inner = `${indent}  `;
  return `{\n${items.map((item) => `${inner}${item},`).join("\n")}\n${indent}}`;
}

const optional = (value: number | undefined, show: (n: number) => string = String) =>
  value === undefined ? undefined : show(value);

type Distribution =
  | { kind: "fixed"; value: number }
  | { kind: "discrete"; values: { value: number; weight: number }[] };

function distribution(d: Distribution, show: (n: number) => string): string {
  if (d.kind === "fixed") return show(d.value);
  return `discrete { ${d.values.map((v) => `{ ${show(v.value)}, ${v.weight} }`).join(", ")} }`;
}

type Flow = Scenario["stations"][number]["producers"][number] &
  Partial<Scenario["stations"][number]["consumers"][number]>;

function variabilityScript(variability: Flow["variability"]): Value {
  if (variability === undefined || variability.kind === "fixed") return undefined;
  return variability.kind === "uniform"
    ? `uniform { range = ${variability.rangePercent}, period = ${duration(variability.periodMs)} }`
    : `bursts { on_ppm = ${variability.onPpm}, off_ppm = ${variability.offPpm}, starts_on = ${variability.startsOn} }`;
}

function flowFields(flow: Flow): [string, Value][] {
  return [
    ["resource", str(flow.resource)],
    ["rate", optional(flow.rate, thousandths)],
    ["variability", variabilityScript(flow.variability)],
    [
      "poisson",
      flow.poisson &&
        `poisson { per_sol = ${thousandths(flow.poisson.arrivalsPerSol)}, size = ${distribution(flow.poisson.size, thousandths)} }`,
    ],
    [
      "per_period",
      flow.perPeriod &&
        `per_period { period = ${duration(flow.perPeriod.periodMs)}, amount = ${distribution(flow.perPeriod.amount, thousandths)} }`,
    ],
    [
      "trace",
      flow.trace &&
        `trace { period = ${duration(flow.trace.periodMs)}, amounts = { ${flow.trace.amounts.map(thousandths).join(", ")} } }`,
    ],
    [
      "profile",
      flow.profile &&
        `profile { ${flow.profile.map((p) => `{ ${duration(p.atMs)}, ${thousandths(p.multiplierPermille)} }`).join(", ")} }`,
    ],
    ["stall_cost", optional(flow.stallCost)],
    ["unmet", flow.unmet === "backorder" ? str("backorder") : undefined],
    ["lost_cost", optional(flow.lostCost)],
    ["backorder_cost", optional(flow.backorderCost)],
  ];
}

function stationScript(station: Scenario["stations"][number], indent: string): string {
  const inner = `${indent}  `;
  const deeper = `${inner}  `;
  const stores = station.resources.map((r) =>
    call(
      "store",
      [
        ["resource", str(r.id)],
        ["capacity", r.capacity === "unlimited" ? str("unlimited") : thousandths(r.capacity)],
        ["initial", r.initial === 0 ? undefined : thousandths(r.initial)],
        ["expires", r.expires && "true"],
        ["holding_cost", optional(r.holdingCost)],
      ],
      deeper,
    ),
  );
  const flows = (name: string, items: Flow[]) =>
    items.length === 0
      ? undefined
      : list(
          items.map((f) => call(name, flowFields(f), deeper)),
          inner,
        );
  const amounts = (items: { resource: string; amount: number }[]) =>
    `{ ${items.map((a) => `{ ${str(a.resource)}, ${thousandths(a.amount)} }`).join(", ")} }`;
  return call(
    "station",
    [
      ["id", str(station.id)],
      ["resources", list(stores, inner)],
      ["producers", flows("producer", station.producers)],
      ["consumers", flows("consumer", station.consumers as Flow[])],
      [
        "converters",
        station.converters.length === 0
          ? undefined
          : list(
              station.converters.map((c) =>
                call(
                  "converter",
                  [
                    ["inputs", amounts(c.inputs)],
                    ["outputs", amounts(c.outputs)],
                    ["rate", thousandths(c.rate)],
                    ["variability", variabilityScript(c.variability)],
                  ],
                  deeper,
                ),
              ),
              inner,
            ),
      ],
      [
        "suppliers",
        station.suppliers.length === 0
          ? undefined
          : list(
              station.suppliers.map((s) =>
                call(
                  "supplier",
                  [
                    ["resource", str(s.resource)],
                    ["from", str(s.from)],
                    ["lead_time", distribution(s.leadTime, duration)],
                    ["min_order", optional(s.minOrder, thousandths)],
                    ["max_order", optional(s.maxOrder, thousandths)],
                    ["order_cost", optional(s.orderCost)],
                    ["unit_cost", optional(s.unitCost)],
                  ],
                  deeper,
                ),
              ),
              inner,
            ),
      ],
      [
        "review",
        station.review &&
          `review { period = ${duration(station.review.periodMs)}, offset = ${duration(station.review.offsetMs)} }`,
      ],
      ["position", station.position && `{ x = ${station.position.x}, y = ${station.position.y} }`],
    ],
    indent,
  );
}

function routeScript(route: Scenario["vehicles"][number]["route"]): string {
  const stops = `{ ${route.stops.map(str).join(", ")} }`;
  if (route.kind === "timetable") {
    return `timetable { stops = ${stops}, departures = { ${route.departuresMs.map(duration).join(", ")} } }`;
  }
  const start = route.start === undefined ? "" : `, start = ${str(route.start)}`;
  const direction =
    route.kind === "shuttle" && route.direction === "backward" ? `, direction = "backward"` : "";
  return `${route.kind} { stops = ${stops}${start}${direction} }`;
}

function selection(value: "all" | string[]): string {
  return value === "all" ? str("all") : `{ ${value.map(str).join(", ")} }`;
}

/** An equivalent script built from core constructs, for a validated scenario document. */
export function documentToScript(scenario: Scenario): string {
  const indent = "  ";
  const inner = "    ";
  const vehicles = scenario.vehicles.map((v) =>
    call(
      "vehicle",
      [
        ["id", str(v.id)],
        ["route", routeScript(v.route)],
        ["speed", String(v.speed)],
        ["dwell", duration(v.dwellMs)],
        ["dwell_per_unit", duration(v.dwellPerUnitMs)],
        [
          "capacity",
          "shared" in v.capacity
            ? thousandths(v.capacity.shared)
            : `{ ${Object.entries(v.capacity.perResource)
                .map(([r, amount]) => `[${str(r)}] = ${thousandths(amount)}`)
                .join(", ")} }`,
        ],
        ["cost_per_distance", optional(v.costPerDistance)],
      ],
      inner,
    ),
  );
  const events = scenario.events.map((e) =>
    call(
      "event",
      [
        ["id", str(e.id)],
        ["label", str(e.label)],
        ["start", e.schedule.kind === "fixed" ? duration(e.schedule.startMs) : undefined],
        [
          "chance_ppm",
          e.schedule.kind === "random" ? String(e.schedule.probabilityPpm) : undefined,
        ],
        [
          "check_every",
          e.schedule.kind === "random" ? duration(e.schedule.checkIntervalMs) : undefined,
        ],
        ["duration", duration(e.schedule.durationMs)],
        [
          "effects",
          list(
            e.effects.map(
              (f) =>
                `effect { ${[
                  `type = ${str(f.type)}`,
                  `stations = ${selection(f.stations)}`,
                  `resources = ${selection(f.resources)}`,
                  `multiplier = ${thousandths(f.multiplierPermille)}`,
                  f.startOffsetMs ? `start_offset = ${duration(f.startOffsetMs)}` : "",
                  f.durationMs === undefined ? "" : `duration = ${duration(f.durationMs)}`,
                ]
                  .filter(Boolean)
                  .join(", ")} }`,
            ),
            inner,
          ),
        ],
      ],
      inner,
    ),
  );
  return `return ${call(
    "scenario",
    [
      ["id", str(scenario.id)],
      ["title", str(scenario.title)],
      ["description", str(scenario.description)],
      ["docs", scenario.docs === undefined ? undefined : str(scenario.docs)],
      ["duration", duration(scenario.durationMs)],
      ["seed", String(scenario.seed)],
      ["information", str(scenario.informationLevel)],
      ["sample_interval", duration(scenario.sampleIntervalMs)],
      [
        "resources",
        list(
          scenario.resources.map((r) => `resource { id = ${str(r.id)}, priority = ${r.priority} }`),
          indent,
        ),
      ],
      [
        "stations",
        list(
          scenario.stations.map((s) => stationScript(s, inner)),
          indent,
        ),
      ],
      [
        "arcs",
        scenario.arcs.length === 0
          ? undefined
          : list(
              scenario.arcs.map(
                (a) => `arc { from = ${str(a.from)}, to = ${str(a.to)}, distance = ${a.distance} }`,
              ),
              indent,
            ),
      ],
      ["vehicles", vehicles.length === 0 ? undefined : list(vehicles, indent)],
      ["events", events.length === 0 ? undefined : list(events, indent)],
    ],
    "",
  )}\n`;
}
