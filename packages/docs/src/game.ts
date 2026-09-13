/** The game the documented behaviour was seen in. */
export const GAME = "Surviving Mars: Relaunched";

/**
 * The game version the mechanics pages describe. Update it, and re-check the
 * statements that cite it, when observations are repeated on a newer version.
 */
export const GAME_VERSION = "1.0";

export const EVIDENCE_LEVELS = {
  observed: "Seen by playing the game and watching what happens.",
  "shadow-mode": "Compared against the game by running a policy beside it in a mod.",
  "game-code": "Read from the game's own code.",
} as const;

export type EvidenceLevel = keyof typeof EVIDENCE_LEVELS;

export const isEvidenceLevel = (value: string): value is EvidenceLevel =>
  Object.hasOwn(EVIDENCE_LEVELS, value);
