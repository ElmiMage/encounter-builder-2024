/**
 * XP Budget per Character, 2024 Dungeon Master's Guide.
 * Index 0 = level 1, index 19 = level 20.
 * No group-size multipliers in the 2024 rules — XP values are summed directly.
 */
export const XP_BUDGET_PER_CHARACTER = [
  { level: 1, low: 50, moderate: 75, high: 100 },
  { level: 2, low: 100, moderate: 150, high: 200 },
  { level: 3, low: 150, moderate: 225, high: 400 },
  { level: 4, low: 250, moderate: 375, high: 500 },
  { level: 5, low: 500, moderate: 750, high: 1100 },
  { level: 6, low: 600, moderate: 1000, high: 1400 },
  { level: 7, low: 750, moderate: 1300, high: 1700 },
  { level: 8, low: 1000, moderate: 1700, high: 2100 },
  { level: 9, low: 1300, moderate: 2000, high: 2600 },
  { level: 10, low: 1600, moderate: 2300, high: 3100 },
  { level: 11, low: 1900, moderate: 2900, high: 4100 },
  { level: 12, low: 2200, moderate: 3700, high: 4700 },
  { level: 13, low: 2600, moderate: 4200, high: 5400 },
  { level: 14, low: 2900, moderate: 4900, high: 6200 },
  { level: 15, low: 3300, moderate: 5400, high: 7800 },
  { level: 16, low: 3800, moderate: 6100, high: 9800 },
  { level: 17, low: 4500, moderate: 7200, high: 11700 },
  { level: 18, low: 5000, moderate: 8700, high: 14200 },
  { level: 19, low: 5500, moderate: 10700, high: 17200 },
  { level: 20, low: 6400, moderate: 13200, high: 22000 },
];

/**
 * Standard Challenge Rating → XP table. This base per-monster XP value
 * (distinct from the 2024 per-character encounter *budget* table above)
 * has not changed between the 2014 and 2024 Monster Manuals — only the
 * encounter-budget math changed. Used as a fallback when a monster's
 * XP isn't present in the compendium index (Foundry's dnd5e system
 * derives XP from CR at runtime via prepareDerivedData, so it's often
 * missing from the raw index data compendiums expose).
 */
export const CR_TO_XP = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
  6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
  16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
  26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
};

/** Returns the standard XP value for a given Challenge Rating, or null if unknown. */
export function xpForChallengeRating(cr) {
  return CR_TO_XP[cr] ?? null;
}

/**
 * Returns the per-character XP budget row for a given level.
 * Clamps to the valid 1-20 range instead of throwing, since a party
 * could technically be above 20 in homebrew content.
 */
export function getBudgetRow(level) {
  const clamped = Math.min(20, Math.max(1, Math.round(level)));
  return XP_BUDGET_PER_CHARACTER[clamped - 1];
}

/**
 * Computes the total XP budget for a party.
 * @param {number} partyLevel - average or chosen party level
 * @param {number} partySize - number of characters
 * @param {"low"|"moderate"|"high"} difficulty
 */
export function computeBudget(partyLevel, partySize, difficulty) {
  const row = getBudgetRow(partyLevel);
  const perCharacter = row[difficulty];
  if (perCharacter === undefined) {
    throw new Error(`Unknown difficulty "${difficulty}". Expected "low", "moderate", or "high".`);
  }
  return perCharacter * partySize;
}

/**
 * Given a list of selected monster XP values, returns how much of the
 * budget is used and whether it's under/over.
 */
export function evaluateSpend(totalBudget, selectedXpValues) {
  const spent = selectedXpValues.reduce((sum, xp) => sum + (xp ?? 0), 0);
  return {
    spent,
    remaining: totalBudget - spent,
    percentUsed: totalBudget > 0 ? spent / totalBudget : 0,
    overBudget: spent > totalBudget,
  };
}
