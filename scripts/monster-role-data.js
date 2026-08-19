/**
 * Foundry-dependent glue for monster role classification — gathers the raw
 * per-monster stats (HP, AC, damage÷HP, spellcasting) that monster-roles.js
 * needs, then hands them off to its pure assignRolesToPopulation(). Kept
 * separate from monster-roles.js so that module stays plain-Node-testable.
 *
 * Deliberately NOT part of loadMonsterIndex() in compendium-browser.js:
 * damage/spellcasting data lives on Items/Activities, which aren't
 * exposed by Foundry's lightweight `pack.getIndex()` at all (unlike CR/XP/
 * type, which mostly are) — getting them requires a full Actor document
 * per monster. Folding that into the index build would mean loading every
 * single compendium Actor just to open the app and browse, which defeats
 * the whole point of loadMonsterIndex's "lightweight index, no full
 * documents until needed" design (see its own docstring). Call
 * computeMonsterRoles() lazily instead — e.g. the first time the GM opens
 * the Role filter — not on every render.
 */
import { loadFullActor } from "./compendium-browser.js";
import { assignRolesToPopulation } from "./monster-roles.js";

/**
 * uuid -> {cr, hp, ac, dmgPerHp, spellAbility, spellCount}. Persists for
 * the whole session once fetched — a monster's own raw stats don't change
 * just because the GM toggles which compendiums are enabled. Role
 * ASSIGNMENT (percentile-based, depends on the current population) is
 * intentionally NOT cached here — see computeMonsterRoles below.
 */
const rawStatsCache = new Map();

/** Sums the average value of a dice/flat-bonus formula string like "3d8 + 5". */
function avgFromFormula(formula) {
  if (!formula) return 0;
  let total = 0;
  const diceRe = /(\d+)\s*d\s*(\d+)/gi;
  let match;
  let consumed = formula;
  while ((match = diceRe.exec(formula)) !== null) {
    total += (parseInt(match[1], 10) * (parseInt(match[2], 10) + 1)) / 2;
    consumed = consumed.replace(match[0], "");
  }
  const flatRe = /([+-]?\s*\d+)(?!\s*d)/g;
  let flat;
  while ((flat = flatRe.exec(consumed)) !== null) {
    total += parseInt(flat[1].replace(/\s/g, ""), 10);
  }
  return total;
}

/** Fetches and computes the raw role-relevant stats for one monster from its full Actor document. */
async function fetchRawStats(monster) {
  const doc = await loadFullActor(monster.uuid);
  if (!doc) return null;

  const hp = doc.system?.attributes?.hp?.max ?? null;
  const ac = doc.system?.attributes?.ac?.value ?? null;
  const spellAbility = doc.system?.attributes?.spellcasting || null;
  const spellCount = doc.items.filter((i) => i.type === "spell").length;

  let sumDamage = 0;
  for (const item of doc.items) {
    for (const activity of item.system?.activities?.contents ?? []) {
      if (activity.type === "attack") {
        sumDamage += (activity.labels?.damage ?? []).reduce((acc, label) => acc + avgFromFormula(label.formula), 0);
      }
    }
  }

  return {
    cr: monster.cr,
    hp,
    ac,
    dmgPerHp: hp > 0 ? sumDamage / hp : 0,
    spellAbility,
    spellCount,
  };
}

/**
 * Computes role tags (see ROLE_LABELS in monster-roles.js) for every
 * monster in the given index. Fetches raw stats only for monsters not
 * already cached from an earlier call this session, then recomputes role
 * ASSIGNMENT fresh every time from whatever's currently cached and present
 * in `monsterIndex` — percentile thresholds depend on the current
 * population (which compendiums are enabled right now), so that part
 * can't be cached across calls the way the raw stats can.
 *
 * @param {object[]} monsterIndex - entries from loadMonsterIndex() (need .uuid, .cr, .name)
 * @param {{onProgress?: (done:number, total:number) => void}} [options]
 * @returns {Promise<Map<string, string[]>>} uuid -> roles
 */
export async function computeMonsterRoles(monsterIndex, { onProgress } = {}) {
  const toFetch = monsterIndex.filter((m) => !rawStatsCache.has(m.uuid));

  for (let i = 0; i < toFetch.length; i++) {
    const monster = toFetch[i];
    try {
      const stats = await fetchRawStats(monster);
      if (stats) rawStatsCache.set(monster.uuid, stats);
    } catch (err) {
      console.warn(`Encounter Builder | failed to fetch role data for "${monster.name}"`, err);
    }
    onProgress?.(i + 1, toFetch.length);
  }

  const population = [];
  for (const monster of monsterIndex) {
    const stats = rawStatsCache.get(monster.uuid);
    if (stats) population.push({ uuid: monster.uuid, ...stats });
  }
  return assignRolesToPopulation(population);
}

/** True if every monster in the index already has cached raw stats — lets the UI skip the "computing…" state on repeat opens. */
export function areRolesFullyCached(monsterIndex) {
  return monsterIndex.every((m) => rawStatsCache.has(m.uuid));
}
