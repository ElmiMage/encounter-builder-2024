/**
 * "Minion Statistics by Challenge Rating" table — pure lookup, no Foundry
 * dependency, unit-testable with plain Node.
 *
 * CONFIDENCE NOTE (2026-07): transcribed directly from a page scan of MCDM's
 * *Flee, Mortals!* supplied by the module author. Single-source-verified,
 * same bar individual-treasure-tables.js is held to (see CLAUDE.md). Only
 * covers CR 0-20 (the book's own range) — CR above 20 falls back to the
 * nearest known row with a warning, same pattern as the old CR 29-30 gap in
 * the (now-removed) Boss-ify guideline table.
 *
 * Deliberately NOT the whole Flee, Mortals! Minion rule set: this module
 * only converts a monster's stats (HP → the table value, damage → the
 * table's flat value). The "any damage kills, overkill spills to the next
 * minion in the mob" and "Group Attack" rules from the book are left as
 * manual GM bookkeeping for now — see project history for why (real-time
 * combat automation was explicitly out of scope for this pass).
 *
 * The Prof. Bonus column is transcribed for reference but not applied
 * anywhere — Minion-ify never touches AC or attack bonus, only HP and
 * damage, matching the book's own table (no AC/attack columns exist there).
 */

const MINION_TABLE = {
  0: { prof: 2, hp: 4, damage: 1 },
  0.125: { prof: 2, hp: 5, damage: 1 },
  0.25: { prof: 2, hp: 6, damage: 1 },
  0.5: { prof: 2, hp: 7, damage: 1 },
  1: { prof: 2, hp: 8, damage: 1 },
  2: { prof: 2, hp: 9, damage: 2 },
  3: { prof: 2, hp: 10, damage: 3 },
  4: { prof: 2, hp: 11, damage: 4 },
  5: { prof: 3, hp: 12, damage: 4 },
  6: { prof: 3, hp: 13, damage: 4 },
  7: { prof: 3, hp: 14, damage: 4 },
  8: { prof: 3, hp: 15, damage: 5 },
  9: { prof: 4, hp: 16, damage: 5 },
  10: { prof: 4, hp: 17, damage: 5 },
  11: { prof: 4, hp: 18, damage: 6 },
  12: { prof: 4, hp: 19, damage: 6 },
  13: { prof: 5, hp: 20, damage: 7 },
  14: { prof: 5, hp: 21, damage: 7 },
  15: { prof: 5, hp: 22, damage: 8 },
  16: { prof: 5, hp: 23, damage: 8 },
  17: { prof: 6, hp: 24, damage: 9 },
  18: { prof: 6, hp: 25, damage: 9 },
  19: { prof: 6, hp: 26, damage: 10 },
  20: { prof: 6, hp: 27, damage: 10 },
};

/** CR keys in ascending order. Deliberately NOT derived via Object.keys() — numeric-string object keys like "0.25" sort after integer-like keys ("0".."20") in JS, which would silently scramble this list. */
export const MINION_CR_LADDER = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/**
 * Fraction of a monster's normal XP value a Minion-ified copy counts as for
 * the encounter budget bar/Auto-Fill purposes. MCDM's table doesn't define
 * an XP value at all (minions aren't meant to be budgeted like a normal
 * monster) — this is a pure Hausregel starting point reflecting how much
 * weaker a single minion is (fixed low HP, no damage variance), not a book
 * value. Tune freely.
 */
export const MINION_XP_MULTIPLIER = 0.1;

/** Looks up the Minion stats for a CR, falling back to the nearest known CR (with a warning) above CR 20. */
export function getMinionStats(cr) {
  const row = MINION_TABLE[cr];
  if (row) return { row, warning: null };

  const nearest = [...MINION_CR_LADDER].sort((a, b) => Math.abs(a - cr) - Math.abs(b - cr))[0];
  return {
    row: MINION_TABLE[nearest],
    warning: `No Minion guideline data for CR ${cr} yet (table covers CR 0-20) — used CR ${nearest} as the nearest available substitute.`,
  };
}
