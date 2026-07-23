/**
 * Pure logic for auto-generating an encounter from a monster candidate
 * list — no Foundry API dependencies, so it's unit-testable in plain
 * Node.
 *
 * Approach: greedy slot-filling with controlled randomness. For each
 * slot, we look at the candidates closest to (remaining budget /
 * remaining slots), then pick randomly among the top few instead of
 * always taking the single nearest match — otherwise the result is
 * 100% deterministic and running Auto-Fill again always gives the
 * identical encounter. A per-monster repeat cap also nudges toward
 * "Mixed Monster Groups" (an explicit DMG recommendation) instead of
 * stacking N of the exact same creature whenever one happens to divide
 * the budget evenly.
 *
 * An injectable `rng` (defaults to Math.random) keeps this testable
 * deterministically by passing a seeded function in tests.
 */

const CANDIDATE_POOL_SIZE = 3; // how many near-matches to randomize among per slot

/** Filters candidates down to a usable pool: known XP, optional creature-type match. */
function buildPool(candidates, creatureTypeFilter) {
  let pool = candidates.filter((m) => typeof m.xp === "number" && m.xp >= 0);
  if (creatureTypeFilter && creatureTypeFilter !== "any") {
    pool = pool.filter((m) => m.creatureType === creatureTypeFilter);
  }
  return pool;
}

/**
 * Fills a given number of slots against a given budget from a pool,
 * using the greedy-with-randomness approach described above. Shared by
 * both the plain and boss-mode auto-fill entry points.
 */
function fillSlots(pool, budget, slotCount, rng) {
  const repeatCap = Math.max(2, Math.ceil(slotCount / 2));
  const counts = new Map(); // uuid -> { monster, count }
  let remainingBudget = budget;
  let slotsLeft = slotCount;

  while (slotsLeft > 0 && pool.length > 0) {
    const target = Math.max(0, remainingBudget / slotsLeft);
    const sorted = [...pool].sort((a, b) => Math.abs(a.xp - target) - Math.abs(b.xp - target));

    const underCap = sorted.filter((c) => (counts.get(c.uuid)?.count ?? 0) < repeatCap);
    const shortlist = (underCap.length > 0 ? underCap : sorted).slice(0, CANDIDATE_POOL_SIZE);
    const pick = shortlist[Math.floor(rng() * shortlist.length)];

    const existing = counts.get(pick.uuid);
    if (existing) existing.count += 1;
    else counts.set(pick.uuid, { monster: pick, count: 1 });

    remainingBudget -= pick.xp;
    slotsLeft -= 1;
  }

  return counts;
}

/**
 * @param {number} budget - total XP budget for the encounter
 * @param {number} desiredCount - how many creatures to include
 * @param {object[]} candidates - monster index entries (must have .xp, .creatureType, .uuid, .name)
 * @param {string|null} creatureTypeFilter - restrict to this creature type, or null/"any" for no filter
 * @param {() => number} rng - random source in [0,1), injectable for tests
 * @returns {{entries: {monster:object, count:number}[], totalSpent: number, requestedCount: number, actualCount: number, warning: string|null}}
 */
export function autoFillEncounter(budget, desiredCount, candidates, creatureTypeFilter = null, rng = Math.random) {
  const pool = buildPool(candidates, creatureTypeFilter);

  if (pool.length === 0) {
    return { entries: [], totalSpent: 0, requestedCount: desiredCount, actualCount: 0,
      warning: "No candidate monsters match the current filters (or none have a known XP value)." };
  }

  const counts = fillSlots(pool, budget, desiredCount, rng);
  const entries = [...counts.values()];
  const totalSpent = entries.reduce((sum, e) => sum + e.monster.xp * e.count, 0);

  let warning = null;
  if (totalSpent > budget * 1.15) {
    warning = `Best available fit for ${desiredCount} creature(s) overshoots the budget by more than 15% — consider allowing more creatures or loosening the creature-type filter.`;
  }

  return {
    entries,
    totalSpent,
    requestedCount: desiredCount,
    actualCount: entries.reduce((sum, e) => sum + e.count, 0),
    warning,
  };
}

/**
 * "Boss encounter" mode — the DMG's Solo Monster + supporting creatures
 * pattern. Reserves a share of the budget (default 75%) for a single
 * strong creature, then fills the remaining slots/budget with smaller
 * "adds" from the same filtered pool (excluding the boss itself, so it
 * doesn't also get counted as a minion).
 *
 * @param {number} bossShare - fraction of the budget the boss should
 *   target (0-1). 0.75 means the boss alone should eat roughly 3/4 of
 *   the total XP budget, leaving 1/4 for supporting creatures.
 */
export function autoFillBossEncounter(
  budget,
  desiredCount,
  candidates,
  creatureTypeFilter = null,
  bossShare = 0.75,
  rng = Math.random
) {
  const pool = buildPool(candidates, creatureTypeFilter);

  if (pool.length === 0) {
    return { entries: [], totalSpent: 0, requestedCount: desiredCount, actualCount: 0,
      warning: "No candidate monsters match the current filters (or none have a known XP value)." };
  }

  const bossTarget = budget * bossShare;

  // Prefer a boss that doesn't blow the WHOLE budget by itself; only if
  // every candidate is more expensive than the total budget do we fall
  // back to "cheapest available" (least-bad overshoot) instead of
  // refusing to produce anything.
  const withinBudget = pool.filter((m) => m.xp <= budget);
  const bossPool = withinBudget.length > 0 ? withinBudget : pool;
  const boss = [...bossPool].sort((a, b) => Math.abs(a.xp - bossTarget) - Math.abs(b.xp - bossTarget))[0];

  const entries = [{ monster: boss, count: 1 }];
  let warning = null;

  const remainingSlots = desiredCount - 1;
  const remainingBudget = budget - boss.xp;

  if (remainingSlots > 0) {
    const minionPool = pool.filter((m) => m.uuid !== boss.uuid);
    if (minionPool.length === 0) {
      warning = "No other monsters available to fill the supporting-creature slots — only the boss was added.";
    } else {
      const minionCounts = fillSlots(minionPool, Math.max(0, remainingBudget), remainingSlots, rng);
      entries.push(...minionCounts.values());
    }
  }

  const totalSpent = entries.reduce((sum, e) => sum + e.monster.xp * e.count, 0);
  if (!warning && totalSpent > budget * 1.15) {
    warning = `Boss + adds overshoot the budget by more than 15% — the cheapest available "boss" candidate may just be too strong for this budget.`;
  } else if (boss.xp > budget) {
    warning = `No single monster fit within the full budget as a boss — used the cheapest option available (${boss.name}, ${boss.xp} XP), which alone exceeds the budget.`;
  }

  return {
    entries,
    totalSpent,
    requestedCount: desiredCount,
    actualCount: entries.reduce((sum, e) => sum + e.count, 0),
    warning,
    bossUuid: boss.uuid,
  };
}
