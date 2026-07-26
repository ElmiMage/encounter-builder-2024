/**
 * Pure helpers for dnd5e NPC hit-point formulas (e.g. "18d10 + 36",
 * system.attributes.hp.formula) — no Foundry dependency, unit-testable
 * with plain Node. Used by the "Encounter HP" mode selector so the GM can
 * choose how monster HP is determined instead of a flat percentage knob.
 */

/**
 * Parses a hit-point formula into its dice count/denomination/flat bonus.
 * Returns null if the formula is missing or doesn't match the expected
 * "NdM[+/-B]" shape (e.g. a custom/non-standard formula).
 */
export function parseHpFormula(formula) {
  if (!formula) return null;
  const match = String(formula).match(/(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?/i);
  if (!match) return null;

  const [, countStr, dieStr, sign, bonusStr] = match;
  const count = Number(countStr);
  const die = Number(dieStr);
  if (!Number.isFinite(count) || !Number.isFinite(die) || count <= 0 || die <= 0) return null;

  const bonus = bonusStr ? Number(bonusStr) * (sign === "-" ? -1 : 1) : 0;
  return { count, die, bonus };
}

/**
 * Computes an HP max value for a given mode:
 *  - "raw": the creature's stat block as printed — returns `currentMax`
 *    unchanged (RAW = "Rules As Written").
 *  - "average": the standard 5e average-HP formula, count * (die/2 + 0.5)
 *    + bonus, floored — recomputed from the dice formula rather than
 *    trusting `currentMax`, so it corrects any prior drift (e.g. a
 *    previously Boss-ified or re-imported actor).
 *  - "maxroll": every hit die at its maximum face, count * die + bonus —
 *    the common "no bad luck" homebrew toughening technique.
 *
 * Falls back to `currentMax` for "average"/"maxroll" if the formula can't
 * be parsed (missing or non-standard), rather than producing 0 HP.
 *
 * @param {number} currentMax
 * @param {string|undefined} formula
 * @param {"raw"|"average"|"maxroll"} mode
 * @returns {number}
 */
export function computeHpForMode(currentMax, formula, mode) {
  if (mode === "raw") return currentMax;

  const parsed = parseHpFormula(formula);
  if (!parsed) return currentMax;

  if (mode === "maxroll") return parsed.count * parsed.die + parsed.bonus;
  return Math.floor(parsed.count * (parsed.die / 2 + 0.5)) + parsed.bonus; // "average"
}
