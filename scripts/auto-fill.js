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

/** Default fraction of the budget Boss Encounter mode reserves for the boss — GM-tunable via the "Boss-ify / Minion-ify Values" settings menu (bossBudgetSharePercent in main.js), this is just the shipped default the setting itself defaults to. */
export const DEFAULT_BOSS_SHARE = 0.75;

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
export function fillSlots(pool, budget, slotCount, rng) {
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
 *   the total XP budget, leaving 1/4 for supporting creatures. Ignored
 *   (treated as 1) when desiredCount <= 1 — with no slots left for adds,
 *   the boss should target the entire budget instead of leaving a chunk
 *   of it unspent.
 */
export function autoFillBossEncounter(
  budget,
  desiredCount,
  candidates,
  creatureTypeFilter = null,
  bossShare = DEFAULT_BOSS_SHARE,
  rng = Math.random
) {
  const pool = buildPool(candidates, creatureTypeFilter);

  if (pool.length === 0) {
    return { entries: [], totalSpent: 0, requestedCount: desiredCount, actualCount: 0,
      warning: "No candidate monsters match the current filters (or none have a known XP value)." };
  }

  // With no room for supporting adds, the boss should target the WHOLE
  // budget instead of the usual 75% share — otherwise a 1-creature boss
  // fight would always leave ~25% of the budget unspent for no reason.
  const effectiveBossShare = desiredCount <= 1 ? 1 : bossShare;
  const bossTarget = budget * effectiveBossShare;

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

/** Adds one fillSlots() result's counts into an accumulator Map, summing counts for repeated uuids across groups instead of overwriting. */
function mergeCounts(accumulator, groupCounts) {
  for (const [uuid, entry] of groupCounts) {
    const existing = accumulator.get(uuid);
    if (existing) existing.count += entry.count;
    else accumulator.set(uuid, { ...entry });
  }
}

/**
 * Encounter Composition — Auto-Fill with role constraints (see
 * monster-roles.js for what Brute/Tank/Skirmisher/Cleric/Caster mean).
 * `roleConstraints` reserves a fixed number of slots for monsters tagged
 * with each given role (e.g. "2 Brute + 2 Skirmisher"); any remaining
 * slots (desiredCount minus the sum of constraint counts) are filled
 * unconstrained from the WHOLE pool, same as plain autoFillEncounter — a
 * monster with no standout role can still fill an unconstrained slot, it's
 * simply not eligible for a role-reserved one.
 *
 * Each group (each role constraint, then the final unconstrained group)
 * gets a budget share proportional to its own slot count out of
 * desiredCount, computed from the ORIGINAL total budget rather than
 * whatever's left after earlier groups — keeps the per-creature target
 * roughly budget/desiredCount for every group instead of later groups
 * getting a skewed leftover share. Cross-group repeats (the same monster
 * picked by two different groups) are allowed and summed, not deduped —
 * matches how autoFillBossEncounter's boss+adds split already behaves,
 * not a new inconsistency introduced here.
 *
 * If the constraint counts alone add up to MORE than desiredCount (e.g. "5
 * Brute" with a Desired Count of 4), later constraints are trimmed to fit
 * — actualCount never exceeds desiredCount — and a warning is returned
 * explaining the trim, on top of whatever the UI itself may already warn
 * about before calling this.
 *
 * @param {number} budget
 * @param {number} desiredCount
 * @param {object[]} candidates - monster index entries (.xp, .creatureType, .uuid, .name)
 * @param {Map<string,string[]>} roleData - monster uuid -> role tags (see monster-role-data.js)
 * @param {{role:string, count:number}[]} roleConstraints
 * @param {string|null} creatureTypeFilter
 * @param {() => number} rng
 */
export function autoFillEncounterWithRoles(
  budget,
  desiredCount,
  candidates,
  roleData,
  roleConstraints,
  creatureTypeFilter = null,
  rng = Math.random
) {
  const pool = buildPool(candidates, creatureTypeFilter);
  if (pool.length === 0) {
    return { entries: [], totalSpent: 0, requestedCount: desiredCount, actualCount: 0,
      warning: "No candidate monsters match the current filters (or none have a known XP value)." };
  }

  // If the constraints alone ask for more slots than desiredCount (e.g. "5
  // Brute" with Desired Count 4 — the UI warns about this too, but this
  // function stays correct standalone regardless of what the caller
  // checked), trim them down to fit: keep constraints in the order given,
  // capping the running total at desiredCount, so actualCount never
  // exceeds what the GM asked for.
  const requestedConstraints = roleConstraints.filter((c) => c.count > 0);
  const requestedTotal = requestedConstraints.reduce((sum, c) => sum + c.count, 0);
  let activeConstraints = requestedConstraints;
  let wasTrimmed = false;
  if (requestedTotal > desiredCount) {
    wasTrimmed = true;
    activeConstraints = [];
    let running = 0;
    for (const c of requestedConstraints) {
      if (running >= desiredCount) break;
      const allowed = Math.min(c.count, desiredCount - running);
      activeConstraints.push({ role: c.role, count: allowed });
      running += allowed;
    }
  }
  const totalConstrained = activeConstraints.reduce((sum, c) => sum + c.count, 0);
  const unconstrainedSlots = Math.max(0, desiredCount - totalConstrained);

  const accumulator = new Map();
  const unmatchedRoles = [];

  for (const constraint of activeConstraints) {
    const rolePool = pool.filter((m) => (roleData.get(m.uuid) ?? []).includes(constraint.role));
    if (rolePool.length === 0) {
      unmatchedRoles.push(constraint.role);
      continue;
    }
    const groupBudget = (budget * constraint.count) / desiredCount;
    mergeCounts(accumulator, fillSlots(rolePool, groupBudget, constraint.count, rng));
  }

  if (unconstrainedSlots > 0) {
    const groupBudget = (budget * unconstrainedSlots) / desiredCount;
    mergeCounts(accumulator, fillSlots(pool, groupBudget, unconstrainedSlots, rng));
  }

  const entries = [...accumulator.values()];
  const totalSpent = entries.reduce((sum, e) => sum + e.monster.xp * e.count, 0);

  let warning = null;
  if (wasTrimmed) {
    warning = `Role constraints requested ${requestedTotal} creature(s), more than the Desired Count of ${desiredCount} — later constraints were trimmed to fit.`;
  }
  if (unmatchedRoles.length > 0) {
    const unmatchedMsg = `No monsters matching the current filters are tagged as: ${unmatchedRoles.join(", ")}. Those role slots were skipped — try Compute Roles with fewer other filters active, or a broader search.`;
    warning = warning ? `${warning} ${unmatchedMsg}` : unmatchedMsg;
  } else if (!warning && totalSpent > budget * 1.15) {
    warning = `Best available fit for ${desiredCount} creature(s) overshoots the budget by more than 15% — consider allowing more creatures or loosening the filters.`;
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
 * Boss Encounter mode combined with role constraints — picks a boss
 * exactly like autoFillBossEncounter (reserves bossShare of the budget,
 * one slot out of desiredCount), then fills the REMAINING slots/budget
 * for supporting "adds" using autoFillEncounterWithRoles instead of a
 * plain unconstrained fillSlots() — so a GM can still say "2 Brute + 2
 * Skirmisher" for the adds even with Boss Encounter checked. The boss
 * itself is never role-constrained (it's picked purely by budget fit,
 * same as plain Boss Encounter) and is excluded from the adds' candidate
 * pool so it can't also get double-counted as one of its own supporting
 * creatures.
 *
 * @param {number} budget
 * @param {number} desiredCount - total creature count INCLUDING the boss (1 boss + desiredCount-1 adds)
 * @param {object[]} candidates
 * @param {Map<string,string[]>} roleData - see monster-role-data.js
 * @param {{role:string, count:number}[]} roleConstraints - applies to the adds only, never the boss
 * @param {string|null} creatureTypeFilter
 * @param {number} bossShare
 * @param {() => number} rng
 */
export function autoFillBossEncounterWithRoles(
  budget,
  desiredCount,
  candidates,
  roleData,
  roleConstraints,
  creatureTypeFilter = null,
  bossShare = DEFAULT_BOSS_SHARE,
  rng = Math.random
) {
  const pool = buildPool(candidates, creatureTypeFilter);
  if (pool.length === 0) {
    return { entries: [], totalSpent: 0, requestedCount: desiredCount, actualCount: 0,
      warning: "No candidate monsters match the current filters (or none have a known XP value)." };
  }

  const effectiveBossShare = desiredCount <= 1 ? 1 : bossShare;
  const bossTarget = budget * effectiveBossShare;
  const withinBudget = pool.filter((m) => m.xp <= budget);
  const bossPool = withinBudget.length > 0 ? withinBudget : pool;
  const boss = [...bossPool].sort((a, b) => Math.abs(a.xp - bossTarget) - Math.abs(b.xp - bossTarget))[0];

  const entries = [{ monster: boss, count: 1 }];
  let warning = null;

  const remainingSlots = desiredCount - 1;
  const remainingBudget = Math.max(0, budget - boss.xp);

  if (remainingSlots > 0) {
    const addsPool = pool.filter((m) => m.uuid !== boss.uuid);
    if (addsPool.length === 0) {
      warning = "No other monsters available to fill the supporting-creature slots — only the boss was added.";
    } else {
      const addsResult = autoFillEncounterWithRoles(remainingBudget, remainingSlots, addsPool, roleData, roleConstraints, null, rng);
      entries.push(...addsResult.entries);
      warning = addsResult.warning;
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
