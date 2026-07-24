import { getTierForCR } from "./treasure-tables.js";

/**
 * Individual Treasure tables, 2024 DMG — the incidental coin a single
 * NON-hoarding monster carries (most creatures), rolled once per
 * monster. Distinct from the Treasure Hoard tables (treasure-tables.js),
 * which represent a much larger, rarer find belonging to monsters that
 * actually collect treasure (dragons, etc.) and are rolled far less often.
 *
 * CONFIDENCE NOTE: only one live source was reachable for these values
 * (dungeonmastertools.github.io) — Roll20 gates the real table behind
 * purchase/login and thievesguild.cc blocks automated fetches. The 0-4
 * row matches the long-stable, widely-published 2014 DMG table exactly,
 * which supports the other three tiers by structural consistency, but
 * unlike treasure-tables.js this hasn't been cross-checked against a
 * second independent source — spot-check against your own book before
 * relying on it for anything high-stakes.
 *
 * Each tier is a d100 table: roll 1-100, use the first band whose `max`
 * is >= the roll (bands are listed in ascending `max` order).
 */
const INDIVIDUAL_TREASURE_TABLES = {
  "0-4": [
    { max: 30, cp: [5, 6, 1] },
    { max: 60, sp: [4, 6, 1] },
    { max: 70, ep: [3, 6, 1] },
    { max: 95, gp: [3, 6, 1] },
    { max: 100, pp: [1, 6, 1] },
  ],
  "5-10": [
    { max: 30, cp: [4, 6, 100] },
    { max: 60, sp: [6, 6, 10], gp: [2, 6, 10] },
    { max: 70, ep: [1, 6, 100], gp: [2, 6, 10] },
    { max: 95, gp: [4, 6, 10] },
    { max: 100, gp: [2, 6, 10], pp: [3, 6, 1] },
  ],
  "11-16": [
    { max: 20, sp: [4, 6, 100], gp: [1, 6, 100] },
    { max: 35, ep: [1, 6, 100], gp: [1, 6, 100] },
    { max: 75, gp: [2, 6, 100], pp: [1, 6, 10] },
    { max: 100, gp: [2, 6, 100], pp: [2, 6, 10] },
  ],
  "17+": [
    { max: 15, ep: [2, 6, 1000], gp: [8, 6, 100] },
    { max: 55, gp: [1, 6, 1000], pp: [1, 6, 100] },
    { max: 100, gp: [1, 6, 1000], pp: [2, 6, 100] },
  ],
};

function rollDice(count, sides, rng) {
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(rng() * sides) + 1;
  return total;
}

function rollFormula(formula, rng) {
  if (!formula) return 0;
  const [count, sides, multiplier] = formula;
  return rollDice(count, sides, rng) * multiplier;
}

const EMPTY_COINS = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

/** Rolls one creature's individual coin treasure for a given Challenge Rating. */
export function rollIndividualTreasure(cr, rng = Math.random) {
  const tier = getTierForCR(cr);
  const bands = INDIVIDUAL_TREASURE_TABLES[tier];
  const roll = Math.floor(rng() * 100) + 1;
  const band = bands.find((b) => roll <= b.max) ?? bands[bands.length - 1];
  return {
    cp: rollFormula(band.cp, rng),
    sp: rollFormula(band.sp, rng),
    ep: rollFormula(band.ep, rng),
    gp: rollFormula(band.gp, rng),
    pp: rollFormula(band.pp, rng),
  };
}

function sumCoins(a, b) {
  return { cp: a.cp + b.cp, sp: a.sp + b.sp, ep: a.ep + b.ep, gp: a.gp + b.gp, pp: a.pp + b.pp };
}

/**
 * Rolls Individual Treasure once per creature across a list of
 * {cr, count} entries (mirrors the app's encounter Map shape) and sums
 * the result into a single purse.
 * @returns {{coins: {cp:number,sp:number,ep:number,gp:number,pp:number}, rolledCount: number}}
 */
export function rollIndividualTreasureForEncounter(entries, rng = Math.random) {
  let coins = EMPTY_COINS;
  let rolledCount = 0;
  for (const { cr, count } of entries) {
    for (let i = 0; i < count; i++) {
      coins = sumCoins(coins, rollIndividualTreasure(cr, rng));
      rolledCount += 1;
    }
  }
  return { coins, rolledCount };
}
