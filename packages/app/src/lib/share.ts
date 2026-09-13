import { POLICY_API_VERSION } from "@regolith-rail/engine";
import type { WorkbenchState } from "../state/workbench.ts";

/** Links longer than this may be truncated by forums and chat apps. */
export const LINK_LENGTH_WARNING = 8000;

const PREFIX = "v1.";

export interface ShareState {
  apiVersion: number;
  appVersion: string;
  view: "run" | "batch";
  policy: { name: string; source: string };
  policyB?: { name: string; source: string };
  scenario: { starterId: string | null; text: string };
  seed: number;
  saveReloadTest: boolean;
  batch?: { seedCount: number; baseSeed: number; compare: boolean };
}

/** The parts of the workbench a share link carries. */
export function toShareState(state: WorkbenchState, appVersion: string): ShareState {
  const { seedCount, baseSeed, compare } = state.batch;
  return {
    apiVersion: POLICY_API_VERSION,
    appVersion,
    view: state.view,
    policy: state.policy,
    ...(state.view === "batch" && compare ? { policyB: state.policyB } : {}),
    scenario: { starterId: state.scenario.starterId, text: state.scenario.text },
    seed: state.seed,
    saveReloadTest: state.saveReloadTest,
    ...(state.view === "batch" ? { batch: { seedCount, baseSeed, compare } } : {}),
  };
}

async function transform(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const response = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Encodes share state as a URL fragment such as `#v1.<data>`. */
export async function encodeShare(state: ShareState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(state));
  return `#${PREFIX}${toBase64Url(await transform(json, new CompressionStream("deflate-raw")))}`;
}

export type DecodeResult =
  | { ok: true; state: ShareState; warnings: string[] }
  | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const isPolicy = (v: unknown) =>
  isRecord(v) && typeof v.name === "string" && typeof v.source === "string";

const isCount = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;

function valid(state: unknown): state is ShareState {
  if (!isRecord(state)) return false;
  const { scenario, batch } = state;
  return (
    typeof state.apiVersion === "number" &&
    typeof state.appVersion === "string" &&
    (state.view === "run" || state.view === "batch") &&
    isPolicy(state.policy) &&
    (state.policyB === undefined || isPolicy(state.policyB)) &&
    isRecord(scenario) &&
    typeof scenario.text === "string" &&
    (scenario.starterId === null || typeof scenario.starterId === "string") &&
    isCount(state.seed) &&
    typeof state.saveReloadTest === "boolean" &&
    (batch === undefined ||
      (isRecord(batch) &&
        isCount(batch.seedCount) &&
        isCount(batch.baseSeed) &&
        typeof batch.compare === "boolean"))
  );
}

/** Whether a URL fragment looks like a share link at all. */
export const isShareFragment = (hash: string) => hash.startsWith(`#${PREFIX}`);

export async function decodeShare(hash: string): Promise<DecodeResult> {
  const damaged = {
    ok: false as const,
    error:
      "This share link is damaged or incomplete, so it could not be opened. Your saved work is untouched.",
  };
  if (!isShareFragment(hash)) return damaged;
  let state: unknown;
  try {
    const bytes = await transform(
      fromBase64Url(hash.slice(PREFIX.length + 1)),
      new DecompressionStream("deflate-raw"),
    );
    state = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return damaged;
  }
  if (!valid(state)) return damaged;
  const warnings: string[] = [];
  if (state.apiVersion !== POLICY_API_VERSION) {
    warnings.push(
      `This link was made with Policy API version ${state.apiVersion}; this site uses version ${POLICY_API_VERSION}, so results may differ.`,
    );
  }
  return { ok: true, state, warnings };
}

/** A warning to show when a link is long enough that some sites may cut it off. */
export function lengthWarning(link: string): string | null {
  return link.length > LINK_LENGTH_WARNING
    ? `This link is ${link.length.toLocaleString("en-GB")} characters long. Some sites shorten or cut off long links; check it still opens after posting.`
    : null;
}
