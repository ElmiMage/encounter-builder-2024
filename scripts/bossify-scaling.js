/**
 * Pure Boss-ify scaling logic — no Foundry dependency, unit-testable with
 * plain Node.
 *
 * v3 design (2026-07): earlier versions targeted a specific CR N steps up,
 * computed from a 2024 DMG "Monster Statistics by CR" guideline table.
 * Dropped per explicit user direction in favor of something much simpler:
 * the GM picks a named difficulty tier, which scales the creature's OWN
 * current HP and damage dice directly by a percentage — no CR lookup, no
 * guideline table, no "which CR is this roughly equivalent to" guesswork.
 * This is also the deliberate point of differentiation from Boss Loot
 * Monster Tools' CR-guideline-table approach.
 *
 * AC and Ability Scores do NOT scale by the raw percentage — AC 18 at
 * "Deadly" (200%) would become AC 36, and an ability score of 20 would
 * become 40, both nonsensical/impossible in dnd5e (max ability score is
 * 30). They get a small flat bonus per tier instead, which still cascades
 * into attack bonus/save DC via dnd5e's own ability-modifier derivation.
 */

export const BOSSIFY_TIERS = {
  raw: { label: "RAW", percent: 100, acBonus: 0, abilityBonus: 0 },
  moderate: { label: "Moderate", percent: 130, acBonus: 1, abilityBonus: 2 },
  high: { label: "High", percent: 150, acBonus: 2, abilityBonus: 4 },
  deadly: { label: "Deadly", percent: 200, acBonus: 3, abilityBonus: 6 },
};

export const BOSSIFY_TIER_ORDER = ["raw", "moderate", "high", "deadly"];

/**
 * Computes the stat changes for boss-ifying a creature at the given tier,
 * relative to its OWN current stats — no CR or guideline table involved.
 *
 * @param {{hp:{value:number, max:number}}} snapshot
 * @param {"raw"|"moderate"|"high"|"deadly"} tier
 * @returns {{
 *   hpMaxDelta: number,
 *   hpValueDelta: number,
 *   acDelta: number,
 *   abilityScoreDelta: number,
 *   damageRatio: number,
 * }}
 */
export function computeBossifyScale(snapshot, tier) {
  const config = BOSSIFY_TIERS[tier] ?? BOSSIFY_TIERS.raw;
  const ratio = config.percent / 100;

  const currentMax = snapshot.hp?.max ?? 0;
  const currentValue = snapshot.hp?.value ?? currentMax;
  const newMax = Math.max(1, Math.round(currentMax * ratio));
  // Preserve the current damage taken as a ratio, not an absolute amount, so a
  // boss that's already been in a fight doesn't jump back to full HP.
  const newValue = Math.max(0, Math.round(currentValue * (newMax / Math.max(1, currentMax))));

  return {
    hpMaxDelta: newMax - currentMax,
    hpValueDelta: newValue - currentValue,
    acDelta: config.acBonus,
    abilityScoreDelta: config.abilityBonus,
    damageRatio: ratio,
  };
}
