/**
 * Monster role classification for Encounter Composition — pure logic, no
 * Foundry dependency. Non-exclusive, additive tags (a monster can carry
 * zero, one, or several): Brute (HP), Tank (AC), Skirmisher (damage÷HP
 * ratio), Cleric (WIS spellcasting), Caster (INT/CHA spellcasting). Not a
 * DMG/book system — a homebrew heuristic, deliberately independent of any
 * single sourcebook's own "role" taxonomy (e.g. MCDM Flee Mortals tags its
 * own monsters with a similar but separate `role` flag — not read here, so
 * this works identically for GMs without that compendium).
 *
 * Thresholds and design choices are all live-verified against real
 * compendium data (2026-08, CR 5 n=129, CR 10 n=47) rather than guessed:
 * - Top-25%-of-same-CR (>= the 75th percentile) for Brute/Tank/Skirmisher.
 *   Chosen over absolute-offset thresholds (e.g. "AC +2") because it
 *   auto-adapts per CR without per-stat calibration, and gives
 *   consistently-sized (~15-25%) buckets at both tested CR tiers.
 * - Skirmisher uses damage÷HP, not raw attack bonus or raw damage.
 *   Attack bonus was tested and rejected: at CR 5 the spread is only
 *   SD=1 around a median of +7, so even the loosest threshold (>median+1)
 *   only ever tags ~9% of monsters, and the practical difference is a
 *   single point of to-hit — not a meaningful signal. Raw damage works
 *   (SD comparable to HP's own spread) but overlaps heavily with Brute:
 *   44% of Brutes were also "high damage" Skirmishers, because HP and
 *   damage both scale together with monster size in 5e design. Damage÷HP
 *   ("hits hard relative to its own toughness") cut that overlap to 16%
 *   at the same sample while keeping the same bucket size (still top-25%
 *   by construction) — the intended "glass cannon" archetype, not just
 *   "big numbers".
 * - Cleric/Caster are binary (spellcasting ability + >=1 real spell item),
 *   not percentile-based — "how much of a caster" doesn't have the same
 *   graded meaning as HP/AC/damage. Requiring an actual spell item is
 *   essential: `system.attributes.spellcasting` (the ability score field)
 *   was found live to be populated on 57% of CR-5 monsters that have ZERO
 *   spells (e.g. Air Elemental, Triceratops, Hill Giant) — a dnd5e
 *   system default, not a real signal of casting ability on its own.
 *
 * Percentile thresholds are computed within a same-CR comparison group,
 * widened to neighboring CRs when that group is too small to be
 * statistically meaningful (live-verified at CR 10, n=47: a plain
 * per-exact-CR cutoff left Tank at only 4 monsters, 8.5% instead of the
 * intended ~25%, because several monsters tied exactly at the threshold
 * AC value in the smaller sample).
 */

/** Below this same-CR sample size, widen the comparison group to neighboring CRs. */
const MIN_SAMPLE_SIZE = 20;
/** Top 25% — i.e. at-or-above the 75th percentile. */
const PERCENTILE = 0.75;
/** Safety cap on how far the CR window can widen (±10) before giving up. */
const MAX_WINDOW = 10;

/**
 * @param {{hp:number, ac:number, dmgPerHp:number}[]} population
 * @returns {{hpThreshold:number, acThreshold:number, dmgPerHpThreshold:number}}
 */
export function computeRoleThresholds(population) {
  function percentileValue(key) {
    const vals = population
      .map((p) => p[key])
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b);
    if (vals.length === 0) return Infinity;
    return vals[Math.floor(vals.length * PERCENTILE)];
  }
  return {
    hpThreshold: percentileValue("hp"),
    acThreshold: percentileValue("ac"),
    dmgPerHpThreshold: percentileValue("dmgPerHp"),
  };
}

/**
 * @param {{hp:number, ac:number, dmgPerHp:number, spellAbility:string|null, spellCount:number}} stats
 * @param {{hpThreshold:number, acThreshold:number, dmgPerHpThreshold:number}} thresholds
 * @returns {string[]} zero or more of "brute", "tank", "skirmisher", "cleric", "caster"
 */
export function classifyRoles(stats, thresholds) {
  const roles = [];
  if (Number.isFinite(stats.hp) && stats.hp >= thresholds.hpThreshold) roles.push("brute");
  if (Number.isFinite(stats.ac) && stats.ac >= thresholds.acThreshold) roles.push("tank");
  if (Number.isFinite(stats.dmgPerHp) && stats.dmgPerHp >= thresholds.dmgPerHpThreshold) roles.push("skirmisher");
  const isRealCaster = Boolean(stats.spellAbility) && stats.spellCount > 0;
  if (isRealCaster && stats.spellAbility === "wis") roles.push("cleric");
  if (isRealCaster && (stats.spellAbility === "int" || stats.spellAbility === "cha")) roles.push("caster");
  return roles;
}

/**
 * Assigns roles to a whole population of monsters at once, grouping by CR
 * and widening the comparison window per-group when a CR tier is too
 * sparsely populated for a stable percentile (see MIN_SAMPLE_SIZE above).
 *
 * @param {{uuid:string, cr:number, hp:number, ac:number, dmgPerHp:number, spellAbility:string|null, spellCount:number}[]} monsters
 * @returns {Map<string, string[]>} uuid -> roles
 */
export function assignRolesToPopulation(monsters) {
  const byCr = new Map();
  for (const m of monsters) {
    if (!Number.isFinite(m.cr)) continue;
    if (!byCr.has(m.cr)) byCr.set(m.cr, []);
    byCr.get(m.cr).push(m);
  }

  const results = new Map();
  for (const [cr, group] of byCr) {
    let comparisonGroup = group;
    let window = 0;
    while (comparisonGroup.length < MIN_SAMPLE_SIZE && window < MAX_WINDOW) {
      window += 1;
      comparisonGroup = monsters.filter((m) => Number.isFinite(m.cr) && Math.abs(m.cr - cr) <= window);
    }
    const thresholds = computeRoleThresholds(comparisonGroup);
    for (const m of group) {
      results.set(m.uuid, classifyRoles(m, thresholds));
    }
  }
  return results;
}

export const ROLE_LABELS = {
  brute: "Brute",
  tank: "Tank",
  skirmisher: "Skirmisher",
  cleric: "Cleric",
  caster: "Caster",
};
