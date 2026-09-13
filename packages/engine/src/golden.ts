/** Seeds every determinism check runs each scenario and policy with. */
export const GOLDEN_SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

export interface GoldenEntry {
  key: string;
  policy: string;
  scenario: string;
  seed: number;
}

/** The determinism matrix shared by the CLI golden file and the browser tests. */
export function goldenMatrix(
  scenarios: readonly string[],
  policies: readonly string[],
): GoldenEntry[] {
  const entries: GoldenEntry[] = [];
  for (const policy of policies) {
    for (const scenario of scenarios) {
      for (const seed of GOLDEN_SEEDS) {
        entries.push({ key: `${policy}/${scenario}/${seed}`, policy, scenario, seed });
      }
    }
  }
  return entries;
}
