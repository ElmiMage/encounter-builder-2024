import { COIN_FORMULAS, TREASURE_BANDS, RARITY_TIERS, getTierForCR, rollDice } from "./treasure-tables.js";

/**
 * Homebrew "smoothed" per-character-level loot tables — NOT part of the
 * DMG. Opt-in alternative to the RAW tier tables in treasure-tables.js,
 * selected via the "Loot Basis" dropdown on the Hoard tab (default stays
 * "Tier (RAW)", i.e. this file is never used unless the GM picks a
 * specific level).
 *
 * The DMG's Treasure Hoard tables only offer 4 wide CR bands (0-4, 5-10,
 * 11-16, 17+), so a level 5 and a level 10 party roll on the exact same
 * flat table despite being 5 levels apart. This interpolates a smooth,
 * level-appropriate target between the 4 tiers' own averages (log-linear
 * for magnitudes, since the tiers already jump roughly 10x each — see
 * the per-tier hoard-count ratio documented by community sources), then
 * builds a level-specific formula that reuses the nearest tier's
 * currency-mix "shape" (same die count/type as the book) with only the
 * multiplier rescaled to hit that level's own target average — so the
 * relative swinginess of a single roll stays book-like, but the range
 * itself is scoped to one level instead of a whole 4-6 level tier.
 *
 * Magic item COUNT barely varies across the book's own tiers (~1.75-1.9
 * average throughout), so it isn't interpolated — every level uses the
 * same simple count formula. What DOES change per level is the RARITY
 * MIX, which is linearly interpolated between the tiers' own mixes AND
 * then hard-gated per RARITY_MIN_LEVEL below (interpolation alone can
 * leak a small nonzero chance a level or two before a tier boundary,
 * which isn't enough to guarantee a rarity is truly unavailable). Unlike
 * the RAW system (which picks one Magic Item Table letter, so every item
 * from a given hoard roll shares that single rarity), each item's rarity
 * is drawn independently here — a single smoothed hoard can mix rarities.
 */

const TIER_ORDER = ["0-4", "5-10", "11-16", "17+"];
const TIER_LEVEL_RANGE = { "0-4": [1, 4], "5-10": [5, 10], "11-16": [11, 16], "17+": [17, 20] };

/**
 * "Magic Items Awarded by Level" (2024 DMG, p.218) — the rarity mix a
 * party is expected to receive across an ENTIRE tier of play. Used here
 * only for its RARITY PROPORTIONS (normalized per tier below), not as a
 * literal per-hoard item count — these figures are a whole-tier budget
 * (e.g. "~11 items total across all of levels 1-4"), not a single-roll
 * count, so the per-roll count formula further below is a separate,
 * independent simplification.
 */
const RARITY_AWARD_COUNTS = {
  "0-4": { common: 6, uncommon: 4, rare: 1, veryRare: 0, legendary: 0, artifact: 0 },
  "5-10": { common: 10, uncommon: 17, rare: 6, veryRare: 1, legendary: 0, artifact: 0 },
  "11-16": { common: 3, uncommon: 7, rare: 11, veryRare: 7, legendary: 2, artifact: 0 },
  "17+": { common: 0, uncommon: 0, rare: 5, veryRare: 11, legendary: 9, artifact: 0 },
};

/**
 * Hard floor: a rarity cannot appear at all before this level, regardless
 * of what interpolation alone produces — matches the DMG table above,
 * where very rare is entirely absent (0) until Tier 2 and legendary is
 * entirely absent until Tier 3. Artifact never appears in that table at
 * all (no column for it), so its floor of 21 makes it unreachable within
 * the 1-20 level range — matching that artifacts aren't meant to come
 * from random rolls in the first place.
 */
const RARITY_MIN_LEVEL = { common: 1, uncommon: 1, rare: 1, veryRare: 5, legendary: 11, artifact: 21 };

function avgDice(n, s) {
  return (n * (s + 1)) / 2;
}

function avgFormula(f) {
  return f ? avgDice(f[0], f[1]) * f[2] : 0;
}

function rollFormula(f, rng) {
  return f ? rollDice(f[0], f[1], rng) * f[2] : 0;
}

/** gp-equivalent conversion, standard 5e rate: 1pp=10gp, 1gp=1, 1ep=0.5, 1sp=0.1, 1cp=0.01. */
function gpEquivAvg(coinFormulas) {
  return avgFormula(coinFormulas.cp) * 0.01 + avgFormula(coinFormulas.sp) * 0.1 + avgFormula(coinFormulas.gp) * 1 + avgFormula(coinFormulas.pp) * 10;
}

/** Average gems/art gp-value for one tier's weighted band table (rarity is handled separately via RARITY_AWARD_COUNTS, not derived from these bands). */
function avgGemsArtValue(bands) {
  const totalWeight = bands.reduce((sum, b) => sum + b.weight, 0);
  let avgValue = 0;
  for (const b of bands) {
    if (b.type !== "none") avgValue += (b.weight / totalWeight) * avgDice(b.dice[0], b.dice[1]) * b.unitValue;
  }
  return avgValue;
}

// Precomputed once at module load — anchor stats per tier, keyed by that
// tier's own level-range midpoint (e.g. tier "5-10" anchors at level 7.5).
const TIER_STATS = Object.fromEntries(
  TIER_ORDER.map((tier) => {
    const [lo, hi] = TIER_LEVEL_RANGE[tier];
    const counts = RARITY_AWARD_COUNTS[tier];
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
    const rarityProportions = Object.fromEntries(RARITY_TIERS.map((r) => [r, totalCount > 0 ? counts[r] / totalCount : 0]));
    return [
      tier,
      { midpoint: (lo + hi) / 2, coinsAvg: gpEquivAvg(COIN_FORMULAS[tier]), gemsAvg: avgGemsArtValue(TREASURE_BANDS[tier]), rarityProportions },
    ];
  })
);

const ANCHOR_LEVELS = TIER_ORDER.map((t) => TIER_STATS[t].midpoint);

/** Linear interpolation/extrapolation of a value across the 4 tier-midpoint anchor levels. */
function interpolateLinear(level, values) {
  let lo = 0;
  let hi = 1;
  if (level <= ANCHOR_LEVELS[0]) {
    lo = 0;
    hi = 1;
  } else if (level >= ANCHOR_LEVELS[ANCHOR_LEVELS.length - 1]) {
    lo = ANCHOR_LEVELS.length - 2;
    hi = ANCHOR_LEVELS.length - 1;
  } else {
    for (let i = 0; i < ANCHOR_LEVELS.length - 1; i++) {
      if (level >= ANCHOR_LEVELS[i] && level <= ANCHOR_LEVELS[i + 1]) {
        lo = i;
        hi = i + 1;
        break;
      }
    }
  }
  const t = (level - ANCHOR_LEVELS[lo]) / (ANCHOR_LEVELS[hi] - ANCHOR_LEVELS[lo]);
  return values[lo] + t * (values[hi] - values[lo]);
}

/** Log-linear interpolation — appropriate for magnitudes here since the tiers already jump ~10x each, not by a fixed amount. */
function interpolateLog(level, values) {
  return Math.exp(interpolateLinear(level, values.map((v) => Math.log(Math.max(v, 1e-9)))));
}

function pickWeighted(items, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[0];
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    if (roll < weights[i]) return items[i];
    roll -= weights[i];
  }
  return items[items.length - 1];
}

function rollSmoothedCoins(level, rng) {
  const tier = getTierForCR(level);
  const shape = COIN_FORMULAS[tier];
  const targetAvg = interpolateLog(level, TIER_ORDER.map((t) => TIER_STATS[t].coinsAvg));
  const shapeAvg = TIER_STATS[tier].coinsAvg;
  const scale = shapeAvg > 0 ? targetAvg / shapeAvg : 0;

  const scaleFormula = (f) => (f ? [f[0], f[1], Math.max(1, Math.round(f[2] * scale))] : null);
  const scaled = { cp: scaleFormula(shape.cp), sp: scaleFormula(shape.sp), gp: scaleFormula(shape.gp), pp: scaleFormula(shape.pp) };

  return {
    cp: rollFormula(scaled.cp, rng),
    sp: rollFormula(scaled.sp, rng),
    ep: 0,
    gp: rollFormula(scaled.gp, rng),
    pp: rollFormula(scaled.pp, rng),
  };
}

const GEMS_ART_DICE = [3, 6];
// Matches the book's own "none" band weight range (2-6%) across tiers.
const GEMS_ART_NONE_CHANCE = 0.04;

function rollSmoothedGemsOrArt(level, rng) {
  if (rng() < GEMS_ART_NONE_CHANCE) return { type: "none", count: 0, unitValue: 0, totalValue: 0 };

  const targetAvg = interpolateLog(level, TIER_ORDER.map((t) => TIER_STATS[t].gemsAvg));
  const count = rollDice(GEMS_ART_DICE[0], GEMS_ART_DICE[1], rng);
  const unitValue = Math.max(1, Math.round(targetAvg / avgDice(GEMS_ART_DICE[0], GEMS_ART_DICE[1])));
  return { type: "gems", count, unitValue, totalValue: count * unitValue };
}

function rollSmoothedMagicItems(level, rng) {
  const count = Math.max(0, rollDice(1, 4, rng) - 1);
  const rarityCounts = Object.fromEntries(RARITY_TIERS.map((r) => [r, 0]));
  if (count === 0) return { count, rarityCounts };

  // Interpolate first, then hard-gate to 0 below each rarity's minimum
  // level — interpolation alone isn't enough to guarantee a rarity is
  // truly unavailable this early, since smoothing between tier anchors
  // can leak a small nonzero chance a level or two before the real
  // boundary (e.g. legendary bleeding into level 9 instead of only
  // appearing from level 11 on).
  const weights = RARITY_TIERS.map((r) => {
    if (level < RARITY_MIN_LEVEL[r]) return 0;
    return Math.max(0, interpolateLinear(level, TIER_ORDER.map((t) => TIER_STATS[t].rarityProportions[r])));
  });
  for (let i = 0; i < count; i++) {
    rarityCounts[pickWeighted(RARITY_TIERS, weights, rng)] += 1;
  }
  return { count, rarityCounts };
}

/**
 * Generates a full smoothed hoard for a given character level (1-20).
 * @returns {{level:number, confidence:"homebrew", coins:object, gemsOrArt:object, rarityCounts:object}}
 */
export function generateSmoothedHoard(level, rng = Math.random) {
  const clamped = Math.min(20, Math.max(1, Math.round(level)));
  const magicItems = rollSmoothedMagicItems(clamped, rng);
  return {
    level: clamped,
    confidence: "homebrew",
    coins: rollSmoothedCoins(clamped, rng),
    gemsOrArt: rollSmoothedGemsOrArt(clamped, rng),
    rarityCounts: magicItems.rarityCounts,
  };
}
