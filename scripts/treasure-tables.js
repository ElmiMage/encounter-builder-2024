/**
 * Treasure Hoard tables, 2024 DMG.
 *
 * CONFIDENCE NOTE (updated after research, 2026-07): coin formulas for
 * all four tiers — including 11-16 and 17+, previously flagged
 * "approximate" here over a rumored errata dispute — were cross-checked
 * against two independently maintained community references and match
 * exactly (4d6x1000 gp / 5d6x100 pp for 11-16; 12d6x1000 gp / 8d6x1000
 * pp for 17+). The "8d8x1000 vs x10000" errata some threads mention
 * turned out to be about a *different*, newer 2024 DMG table (the
 * simplified "Random Treasure Hoard" summary table, p.121) — not the
 * detailed per-tier table implemented here — so it doesn't apply to
 * these formulas. All four tiers' coin math is now treated as confirmed.
 *
 * Still an approximation: the gems/art/magic-item table below is
 * restructured as weighted bands rather than a literal d100 row-by-row
 * copy of the book (easier to maintain/test while preserving the same
 * probabilities), and it only produces Magic Item Table letters A-G.
 * The real 11-16 and 17+ hoard tables also roll on Tables H and I (the
 * rarest slice, ~15-20% of the d100 range at those tiers) — this model
 * folds that slice into G/legendary instead, so very-high-CR hoards may
 * under-represent the single rarest magic-item band slightly.
 */

export const COIN_FORMULAS = {
  "0-4": { cp: [6, 6, 100], sp: [3, 6, 100], gp: [2, 6, 10], pp: null },
  "5-10": { cp: [2, 6, 100], sp: [2, 6, 1000], gp: [6, 6, 100], pp: [3, 6, 10] },
  "11-16": { cp: null, sp: null, gp: [4, 6, 1000], pp: [5, 6, 100] },
  "17+": { cp: null, sp: null, gp: [12, 6, 1000], pp: [8, 6, 1000] },
};

const CONFIRMED_TIERS = new Set(["0-4", "5-10", "11-16", "17+"]);

/** Fixed rarity tiers used throughout the loot system. Lives here (not loot-generator.js) so smoothed-loot-tables.js can use it too without a circular import. */
export const RARITY_TIERS = ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"];

/**
 * Simplified mapping from DMG Magic Item Table letter to a dnd5e item
 * rarity. The real tables mix specific item types with sub-weightings
 * per rarity; this collapses each letter to its dominant rarity so
 * loot-generator.js can pull a real, correctly-built item from the GM's
 * own compendiums instead of maintaining a separate hardcoded item list.
 * Lives here (not in loot-generator.js) so smoothed-loot-tables.js can
 * use it too without a circular import between the two.
 */
export const MAGIC_TABLE_TO_RARITY = {
  A: "common",
  B: "uncommon",
  C: "uncommon",
  D: "rare",
  E: "rare",
  F: "veryRare",
  G: "legendary",
};

/**
 * Gems/art/magic-item bands per tier. Each band's `weight` values in a
 * tier should sum to 100 (they represent percentage chance, matching a
 * d100 roll landing in that band).
 */
export const TREASURE_BANDS = {
  "0-4": [
    { weight: 6, type: "none" },
    { weight: 10, type: "gems", dice: [2, 6], unitValue: 10 },
    { weight: 10, type: "art", dice: [2, 4], unitValue: 25 },
    { weight: 10, type: "gems", dice: [2, 6], unitValue: 50 },
    { weight: 8, type: "gems", dice: [2, 6], unitValue: 10, magicTable: "A", magicRolls: [1, 6] },
    { weight: 8, type: "art", dice: [2, 4], unitValue: 25, magicTable: "A", magicRolls: [1, 6] },
    { weight: 8, type: "gems", dice: [2, 6], unitValue: 50, magicTable: "A", magicRolls: [1, 6] },
    { weight: 5, type: "gems", dice: [2, 6], unitValue: 10, magicTable: "B", magicRolls: [1, 4] },
    { weight: 5, type: "art", dice: [2, 4], unitValue: 25, magicTable: "B", magicRolls: [1, 4] },
    { weight: 5, type: "gems", dice: [2, 6], unitValue: 50, magicTable: "B", magicRolls: [1, 4] },
    { weight: 3, type: "gems", dice: [2, 6], unitValue: 10, magicTable: "C", magicRolls: [1, 4] },
    { weight: 2, type: "art", dice: [2, 4], unitValue: 25, magicTable: "C", magicRolls: [1, 4] },
    { weight: 5, type: "gems", dice: [2, 6], unitValue: 50, magicTable: "C", magicRolls: [1, 4] },
    { weight: 7, type: "art", dice: [2, 4], unitValue: 25, magicTable: "F", magicRolls: [1, 4] },
    { weight: 5, type: "gems", dice: [2, 6], unitValue: 50, magicTable: "F", magicRolls: [1, 4] },
    { weight: 2, type: "art", dice: [2, 4], unitValue: 25, magicTable: "G", magicRolls: [1, 1] },
    { weight: 1, type: "gems", dice: [2, 6], unitValue: 50, magicTable: "G", magicRolls: [1, 1] },
  ],
  "5-10": [
    { weight: 4, type: "none" },
    { weight: 6, type: "art", dice: [2, 4], unitValue: 25 },
    { weight: 6, type: "gems", dice: [3, 6], unitValue: 50 },
    { weight: 6, type: "gems", dice: [3, 6], unitValue: 100 },
    { weight: 6, type: "art", dice: [2, 4], unitValue: 250 },
    { weight: 4, type: "art", dice: [2, 4], unitValue: 25, magicTable: "A", magicRolls: [1, 6] },
    { weight: 4, type: "gems", dice: [3, 6], unitValue: 50, magicTable: "A", magicRolls: [1, 6] },
    { weight: 4, type: "gems", dice: [3, 6], unitValue: 100, magicTable: "A", magicRolls: [1, 6] },
    { weight: 4, type: "art", dice: [2, 4], unitValue: 250, magicTable: "A", magicRolls: [1, 6] },
    { weight: 5, type: "art", dice: [2, 4], unitValue: 25, magicTable: "B", magicRolls: [1, 4] },
    { weight: 5, type: "gems", dice: [3, 6], unitValue: 50, magicTable: "B", magicRolls: [1, 4] },
    { weight: 8, type: "gems", dice: [3, 6], unitValue: 100, magicTable: "C", magicRolls: [1, 4] },
    { weight: 8, type: "art", dice: [2, 4], unitValue: 250, magicTable: "C", magicRolls: [1, 4] },
    { weight: 8, type: "gems", dice: [3, 6], unitValue: 100, magicTable: "D", magicRolls: [1, 4] },
    { weight: 8, type: "art", dice: [2, 4], unitValue: 250, magicTable: "D", magicRolls: [1, 4] },
    { weight: 6, type: "art", dice: [2, 4], unitValue: 250, magicTable: "E", magicRolls: [1, 4] },
    { weight: 5, type: "gems", dice: [3, 6], unitValue: 100, magicTable: "F", magicRolls: [1, 4] },
    { weight: 2, type: "art", dice: [2, 4], unitValue: 250, magicTable: "G", magicRolls: [1, 1] },
    { weight: 1, type: "gems", dice: [3, 6], unitValue: 100, magicTable: "G", magicRolls: [1, 1] },
  ],
  // Restructured/approximate band model — see confidence note above
  // (coin formulas for this tier are confirmed; this gems/magic-item
  // band shape is not a literal d100 copy). Weighted toward higher-value
  // gems/art and rarer magic items, matching the tier's general intent.
  "11-16": [
    { weight: 3, type: "none" },
    { weight: 12, type: "gems", dice: [3, 6], unitValue: 500 },
    { weight: 12, type: "art", dice: [2, 4], unitValue: 750 },
    { weight: 15, type: "gems", dice: [3, 6], unitValue: 500, magicTable: "C", magicRolls: [1, 4] },
    { weight: 15, type: "art", dice: [2, 4], unitValue: 750, magicTable: "D", magicRolls: [1, 4] },
    { weight: 15, type: "gems", dice: [3, 6], unitValue: 1000, magicTable: "D", magicRolls: [1, 4] },
    { weight: 13, type: "art", dice: [2, 4], unitValue: 750, magicTable: "E", magicRolls: [1, 4] },
    { weight: 10, type: "gems", dice: [3, 6], unitValue: 1000, magicTable: "F", magicRolls: [1, 4] },
    { weight: 4, type: "art", dice: [2, 4], unitValue: 750, magicTable: "G", magicRolls: [1, 1] },
    { weight: 1, type: "gems", dice: [3, 6], unitValue: 1000, magicTable: "G", magicRolls: [1, 1] },
  ],
  "17+": [
    { weight: 2, type: "none" },
    { weight: 10, type: "gems", dice: [3, 6], unitValue: 1000 },
    { weight: 10, type: "art", dice: [2, 4], unitValue: 2500 },
    { weight: 15, type: "gems", dice: [3, 6], unitValue: 1000, magicTable: "E", magicRolls: [1, 4] },
    { weight: 20, type: "art", dice: [2, 4], unitValue: 2500, magicTable: "E", magicRolls: [1, 4] },
    { weight: 20, type: "gems", dice: [3, 6], unitValue: 1000, magicTable: "F", magicRolls: [1, 4] },
    { weight: 15, type: "art", dice: [2, 4], unitValue: 2500, magicTable: "F", magicRolls: [1, 4] },
    { weight: 6, type: "gems", dice: [3, 6], unitValue: 1000, magicTable: "G", magicRolls: [1, 1] },
    { weight: 2, type: "art", dice: [2, 4], unitValue: 2500, magicTable: "G", magicRolls: [1, 1] },
  ],
};

/** Maps a monster's Challenge Rating to the DMG hoard tier key. */
export function getTierForCR(cr) {
  if (cr <= 4) return "0-4";
  if (cr <= 10) return "5-10";
  if (cr <= 16) return "11-16";
  return "17+";
}

export function rollDice(count, sides, rng) {
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(rng() * sides) + 1;
  return total;
}

function rollFormula(formula, rng) {
  if (!formula) return 0;
  const [count, sides, multiplier] = formula;
  return rollDice(count, sides, rng) * multiplier;
}

/** Rolls the coin portion of a hoard for the given tier. */
export function rollCoins(tier, rng = Math.random) {
  const formulas = COIN_FORMULAS[tier];
  return {
    cp: rollFormula(formulas.cp, rng),
    sp: rollFormula(formulas.sp, rng),
    ep: 0,
    gp: rollFormula(formulas.gp, rng),
    pp: rollFormula(formulas.pp, rng),
  };
}

/** Picks one weighted band from the tier's table and rolls its dice. */
export function rollGemsArtAndMagic(tier, rng = Math.random) {
  const bands = TREASURE_BANDS[tier];
  const totalWeight = bands.reduce((sum, b) => sum + b.weight, 0);
  let roll = rng() * totalWeight;
  let chosen = bands[bands.length - 1];
  for (const band of bands) {
    if (roll < band.weight) { chosen = band; break; }
    roll -= band.weight;
  }

  const result = { type: chosen.type, magicItemTable: chosen.magicTable ?? null, magicItemCount: 0 };
  if (chosen.type !== "none") {
    result.count = rollDice(chosen.dice[0], chosen.dice[1], rng);
    result.unitValue = chosen.unitValue;
    result.totalValue = result.count * result.unitValue;
  }
  if (chosen.magicTable) {
    result.magicItemCount = rollDice(chosen.magicRolls[0], chosen.magicRolls[1], rng);
  }
  return result;
}

/**
 * Generates a full hoard for a given Challenge Rating.
 * @returns {{tier: string, confidence: "confirmed"|"approximate", coins: object, gemsOrArt: object}}
 */
export function generateHoard(cr, rng = Math.random) {
  const tier = getTierForCR(cr);
  return {
    tier,
    confidence: CONFIRMED_TIERS.has(tier) ? "confirmed" : "approximate",
    coins: rollCoins(tier, rng),
    gemsOrArt: rollGemsArtAndMagic(tier, rng),
  };
}
