/**
 * Foundry-dependent apply layer for actor stat mutation: "Boss-ify" (mutates
 * a real NPC Actor's HP/damage dice scaled by percentage, AC/ability scores
 * by a flat per-tier bonus — see bossify-scaling.js's computeBossifyScale())
 * and "Minion-ify" (sets HP and a flat damage value straight from MCDM's
 * Minion table — see minion-scaling.js's getMinionStats()). Both snapshot
 * original values into an actor flag first so their matching revert*()
 * function can restore them.
 *
 * NOT unit-testable in isolation (no Foundry API outside a running world) —
 * only node --check syntax verification is possible here. Verified live via
 * the Data/modules/encounter-builder-2024 directory junction.
 *
 * Actor/item field paths below were confirmed against the actually-installed
 * dnd5e 5.3.3 system source (Data/systems/dnd5e/dnd5e.mjs) rather than
 * assumed:
 *  - For NPCs, ac.calc defaults to "natural", and both "natural" and "flat"
 *    calc modes read their base value from system.attributes.ac.flat (NOT
 *    .value, which is a derived/computed field) — Boss-ify only adjusts AC
 *    for those two calc modes and leaves anything else (worn-armor-based
 *    "default"/"custom" calc) untouched with a warning, rather than writing
 *    to a field the system would just overwrite on the next prepareData().
 *  - Weapon/attack damage lives in two places: system.damage.base /
 *    .versatile on the item itself, and system.activities.<id>.damage.parts
 *    on each attached Activity — both need updating for the change to show
 *    up wherever the sheet/roll pulls damage from.
 */

import { computeBossifyScale, mergeTierConfig } from "./bossify-scaling.js";
import { getMinionStats } from "./minion-scaling.js";
import { computeHpForMode } from "./hp-formula.js";

const MODULE_ID = "encounter-builder-2024";

function readActorSnapshot(actor) {
  const system = actor.system;
  const abilities = {};
  for (const key of Object.keys(CONFIG.DND5E.abilities)) {
    abilities[key] = system.abilities?.[key]?.value;
  }
  return {
    ac: { calc: system.attributes?.ac?.calc, flat: system.attributes?.ac?.flat },
    hp: { value: system.attributes?.hp?.value ?? 0, max: system.attributes?.hp?.max ?? 0 },
    abilities,
  };
}

/**
 * Multiplies a single damage part's dice count by `ratio`, closing the
 * whole-die rounding gap with a flat bonus top-up instead of quietly
 * losing it. Whole dice alone is too coarse at low dice counts — e.g. 1d8
 * at 130% (Moderate) would round to 1d8 with NO visible change at all — so
 * this floors the dice count (never rounds up) and adds the shortfall as
 * "+N" on the `bonus` field. Flooring means the top-up is always >= 0, so
 * a scaled-UP creature never shows a confusing "-N" penalty on its stat
 * block. `bonus` is a dnd5e FormulaField and can be a dynamic expression
 * (e.g. "@abilities.str.mod") — this only ever APPENDS a plain number to
 * whatever's already there, never evaluates or replaces it, so dynamic
 * bonuses keep working exactly as before (and separately, Boss-ify's own
 * ability-score bump already raises @mod-based bonuses on its own).
 *
 * Custom-formula damage parts (part.custom.enabled) are a different code
 * path — an arbitrary multi-term formula string, not a clean number/
 * denomination/bonus split — so they keep the simpler dice-only scaling
 * via Roll.alter() instead of this top-up logic.
 *
 * Returns { changed, part } so the caller only writes fields that actually
 * moved.
 */
function scaleDamagePart(part, ratio) {
  if (!part || ratio === 1) return { changed: false, part };

  if (part.custom?.enabled && part.custom?.formula) {
    let roll = new Roll(part.custom.formula);
    roll = roll.alter(ratio, 0);
    for (const term of roll.terms) {
      if (term instanceof foundry.dice.terms.DiceTerm) term.number = Math.max(1, Math.round(term.number ?? 1));
    }
    roll.resetFormula();
    if (roll.formula === part.custom.formula) return { changed: false, part };
    return { changed: true, part: { ...part, custom: { ...part.custom, formula: roll.formula } } };
  }

  const num = Number(part.number);
  const den = Number(part.denomination);
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) return { changed: false, part };

  const newNum = Math.max(1, Math.floor(num * ratio));

  const dieAvg = (den + 1) / 2;
  const remainder = Math.round(num * ratio * dieAvg - newNum * dieAvg);

  let newBonus = part.bonus;
  if (remainder > 0) {
    const trimmed = String(part.bonus ?? "").trim();
    newBonus = trimmed ? `${trimmed} + ${remainder}` : String(remainder);
  }

  if (newNum === num && newBonus === part.bonus) return { changed: false, part };
  return { changed: true, part: { ...part, number: newNum, bonus: newBonus } };
}

/** Replaces a single damage part's dice with a fixed, non-random value (via the custom-formula field) — Minion damage per MCDM's table is a flat number, not a die roll. Returns { changed, part } like scaleDamagePart, for the same shared buildDamagePartUpdates() below. */
function flattenDamagePart(part, flatValue) {
  if (!part) return { changed: false, part };
  const formula = String(flatValue);
  if (part.custom?.enabled && part.custom?.formula === formula) return { changed: false, part };
  return { changed: true, part: { ...part, custom: { enabled: true, formula } } };
}

/**
 * Damage parts read off derived/prepared item or activity data (as opposed
 * to raw source data) can be live DamageData DataModel instances rather
 * than plain objects — spreading one with `{...part, ...}` silently drops
 * fields like `types` (DataModel fields aren't necessarily own-enumerable
 * properties the spread operator picks up). Normalize through `.toObject()`
 * first whenever one is available, so every part we actually write is a
 * plain, complete object.
 */
function toPlainPart(part) {
  if (!part) return part;
  return typeof part.toObject === "function" ? part.toObject() : part;
}

/**
 * Walks every non-spell item's damage parts (base/versatile/each Activity's
 * damage.parts) and applies `transform(part) => {changed, part}` to each,
 * returning the updateEmbeddedDocuments("Item", ...) payload plus a matching
 * backup array for whatever actually changed. Shared by Boss-ify's ratio
 * scaling (scaleDamagePart) and Minion-ify's flat-value replacement
 * (flattenDamagePart) — same walk, different per-part transform.
 *
 * Activities with "Include Base Damage" enabled get a `base: true, locked:
 * true` CLONE of the item's own damage.base unshifted into their
 * damage.parts array every time dnd5e prepares derived data (see
 * AttackActivity#prepareFinalData in dnd5e.mjs — confirmed by reading the
 * installed system source) — it's an ephemeral display-only mirror, not
 * real stored data. We already scale the real item.system.damage.base
 * separately above, so these mirrored `base: true` entries are filtered
 * out here; writing them back as if they were real parts is what caused
 * an extra, type-less duplicate damage line to appear on the boss-ified
 * actor's sheet in live testing.
 */
function buildDamagePartUpdates(actor, transform) {
  const itemUpdates = [];
  const itemBackups = [];

  for (const item of actor.items) {
    if (item.type === "spell") continue;

    const update = { _id: item.id };
    const backup = { id: item.id };
    let changed = false;

    const base = toPlainPart(item.system.damage?.base);
    if (base) {
      const result = transform(base);
      if (result.changed) {
        update["system.damage.base"] = result.part;
        backup.base = foundry.utils.deepClone(base);
        changed = true;
      }
    }

    const versatile = toPlainPart(item.system.damage?.versatile);
    if (versatile) {
      const result = transform(versatile);
      if (result.changed) {
        update["system.damage.versatile"] = result.part;
        backup.versatile = foundry.utils.deepClone(versatile);
        changed = true;
      }
    }

    for (const activity of item.system.activities?.contents ?? []) {
      const parts = (activity.damage?.parts ?? []).filter((p) => !p?.base).map(toPlainPart);
      if (parts.length === 0) continue;

      const results = parts.map(transform);
      if (results.some((r) => r.changed)) {
        update[`system.activities.${activity.id}.damage.parts`] = results.map((r) => r.part);
        backup.activities ??= {};
        backup.activities[activity.id] = foundry.utils.deepClone(parts);
        changed = true;
      }
    }

    if (changed) {
      itemUpdates.push(update);
      itemBackups.push(backup);
    }
  }

  return { itemUpdates, itemBackups };
}

/** Builds the updateEmbeddedDocuments("Item", ...) payload plus a matching backup array, scaling every damage part on every non-spell item by damageRatio. */
function buildItemUpdates(actor, damageRatio) {
  if (damageRatio === 1) return { itemUpdates: [], itemBackups: [] };
  return buildDamagePartUpdates(actor, (part) => scaleDamagePart(part, damageRatio));
}

/** Builds the same update/backup payload shape as buildItemUpdates(), but replacing every damage part with a fixed flat value instead of scaling dice. */
function buildMinionItemUpdates(actor, flatDamage) {
  return buildDamagePartUpdates(actor, (part) => flattenDamagePart(part, flatDamage));
}

/**
 * Scales `actor` at the given Boss-ify tier ("raw"/"moderate"/"high"/
 * "deadly" — see BOSSIFY_TIERS in bossify-scaling.js): HP and damage dice
 * scale by the tier's percentage, AC and ability scores get the tier's flat
 * bonus. Snapshots original AC/HP/abilities/item-damage into a
 * `encounter-builder-2024.bossifySnapshot` flag before mutating, so
 * revertBossify() can undo it. Safe to call on any dnd5e NPC actor.
 */
export async function bossifyActor(actor, tier, options = {}) {
  const { applyAC = true, applyHP = true, applyAbilities = true, applyDamageDice = true } = options;
  try {
    const snapshot = readActorSnapshot(actor);
    const tierConfig = mergeTierConfig(game.settings.get(MODULE_ID, "bossifyTierConfig"));
    const scaled = computeBossifyScale(snapshot, tier, tierConfig);

    const actorUpdates = {};

    if (applyHP) {
      actorUpdates["system.attributes.hp.max"] = Math.max(1, snapshot.hp.max + scaled.hpMaxDelta);
      actorUpdates["system.attributes.hp.value"] = Math.max(0, snapshot.hp.value + scaled.hpValueDelta);
    }

    if (applyAC) {
      if (snapshot.ac.calc === "natural" || snapshot.ac.calc === "flat") {
        actorUpdates["system.attributes.ac.flat"] = Math.max(0, (snapshot.ac.flat ?? 0) + scaled.acDelta);
      } else if (scaled.acDelta !== 0) {
        ui.notifications.warn(
          `${actor.name} uses a "${snapshot.ac.calc}" Armor Class calculation (worn-armor-based) — Boss-ify left AC untouched. Adjust it manually if needed.`
        );
      }
    }

    if (applyAbilities) {
      for (const [key, val] of Object.entries(snapshot.abilities)) {
        if (typeof val !== "number" || val <= 10) continue;
        const newVal = Math.min(30, Math.max(10, val + scaled.abilityScoreDelta));
        if (newVal !== val) actorUpdates[`system.abilities.${key}.value`] = newVal;
      }
    }

    const { itemUpdates, itemBackups } = buildItemUpdates(actor, applyDamageDice ? scaled.damageRatio : 1);

    // Snapshot BEFORE mutating, so a Revert is available even if something
    // below throws partway through. tier + the four apply* flags together
    // fully determine the result, so encounter-builder-app.js's Create
    // Combat Actor-reuse lookup matches on all five to avoid reusing e.g.
    // an AC-only Deadly actor for what should be an AC+HP Deadly actor.
    await actor.setFlag(MODULE_ID, "bossifySnapshot", {
      tier,
      applyAC,
      applyHP,
      applyAbilities,
      applyDamageDice,
      appliedAt: Date.now(),
      actor: { ac: snapshot.ac, hp: snapshot.hp, abilities: snapshot.abilities },
      items: itemBackups,
    });

    await actor.update(actorUpdates);
    if (itemUpdates.length > 0) await actor.updateEmbeddedDocuments("Item", itemUpdates);

    ui.notifications.info(`${actor.name} boss-ified (${tierConfig[tier]?.label ?? tier}).`);
    return actor;
  } catch (err) {
    console.error("Encounter Builder | bossifyActor failed:", err);
    ui.notifications.error(`Boss-ify failed for ${actor?.name ?? "actor"}: ${err.message}. Check the console (F12) for details.`);
    throw err;
  }
}

/** Restores an actor's pre-Boss-ify AC/HP/abilities/item damage from its `bossifySnapshot` flag, then removes the flag. No-ops with a warning if the actor was never Boss-ified. */
export async function revertBossify(actor) {
  try {
    const snap = actor.getFlag(MODULE_ID, "bossifySnapshot");
    if (!snap) {
      ui.notifications.warn(`${actor.name} has no Boss-ify changes to revert.`);
      return null;
    }

    const actorUpdates = {
      "system.attributes.hp.max": snap.actor.hp.max,
      "system.attributes.hp.value": snap.actor.hp.value,
    };
    if (snap.actor.ac.calc === "natural" || snap.actor.ac.calc === "flat") {
      actorUpdates["system.attributes.ac.flat"] = snap.actor.ac.flat;
    }
    for (const [key, val] of Object.entries(snap.actor.abilities ?? {})) {
      if (typeof val === "number") actorUpdates[`system.abilities.${key}.value`] = val;
    }

    const itemUpdates = [];
    for (const backup of snap.items ?? []) {
      if (!actor.items.get(backup.id)) continue; // item was removed since Boss-ify — nothing to restore it onto
      const update = { _id: backup.id };
      if (backup.base) update["system.damage.base"] = backup.base;
      if (backup.versatile) update["system.damage.versatile"] = backup.versatile;
      for (const [activityId, parts] of Object.entries(backup.activities ?? {})) {
        update[`system.activities.${activityId}.damage.parts`] = parts;
      }
      itemUpdates.push(update);
    }

    await actor.update(actorUpdates);
    if (itemUpdates.length > 0) await actor.updateEmbeddedDocuments("Item", itemUpdates);
    await actor.unsetFlag(MODULE_ID, "bossifySnapshot");

    ui.notifications.info(`${actor.name} reverted to its original stats.`);
    return actor;
  } catch (err) {
    console.error("Encounter Builder | revertBossify failed:", err);
    ui.notifications.error(`Revert failed for ${actor?.name ?? "actor"}: ${err.message}. Check the console (F12) for details.`);
    throw err;
  }
}

/**
 * Converts `actor` to MCDM Minion stats for its current CR (getMinionStats()
 * in minion-scaling.js): HP set straight to the table value, every damage
 * part replaced with the table's flat damage number (no rolling). AC and
 * attack bonus are untouched — the book's table doesn't cover those.
 * Snapshots original HP/item-damage into a
 * `encounter-builder-2024.minionifySnapshot` flag first, so
 * revertMinionify() can undo it.
 */
export async function minionifyActor(actor) {
  try {
    const cr = actor.system.details?.cr ?? 0;
    const { row, warning } = getMinionStats(cr);
    if (warning) ui.notifications.warn(warning);

    const originalHp = {
      value: actor.system.attributes?.hp?.value ?? 0,
      max: actor.system.attributes?.hp?.max ?? 0,
    };

    const actorUpdates = {
      "system.attributes.hp.max": row.hp,
      "system.attributes.hp.value": row.hp,
    };

    const { itemUpdates, itemBackups } = buildMinionItemUpdates(actor, row.damage);

    // Snapshot BEFORE mutating, so a Revert is available even if something
    // below throws partway through.
    await actor.setFlag(MODULE_ID, "minionifySnapshot", {
      appliedAt: Date.now(),
      actor: { hp: originalHp },
      items: itemBackups,
    });

    await actor.update(actorUpdates);
    if (itemUpdates.length > 0) await actor.updateEmbeddedDocuments("Item", itemUpdates);

    ui.notifications.info(`${actor.name} minion-ified (${row.hp} HP, ${row.damage} damage per hit).`);
    return actor;
  } catch (err) {
    console.error("Encounter Builder | minionifyActor failed:", err);
    ui.notifications.error(`Minion-ify failed for ${actor?.name ?? "actor"}: ${err.message}. Check the console (F12) for details.`);
    throw err;
  }
}

/** Restores an actor's pre-Minion-ify HP/item damage from its `minionifySnapshot` flag, then removes the flag. No-ops with a warning if the actor was never Minion-ified. */
export async function revertMinionify(actor) {
  try {
    const snap = actor.getFlag(MODULE_ID, "minionifySnapshot");
    if (!snap) {
      ui.notifications.warn(`${actor.name} has no Minion-ify changes to revert.`);
      return null;
    }

    const actorUpdates = {
      "system.attributes.hp.max": snap.actor.hp.max,
      "system.attributes.hp.value": snap.actor.hp.value,
    };

    const itemUpdates = [];
    for (const backup of snap.items ?? []) {
      if (!actor.items.get(backup.id)) continue; // item was removed since Minion-ify — nothing to restore it onto
      const update = { _id: backup.id };
      if (backup.base) update["system.damage.base"] = backup.base;
      if (backup.versatile) update["system.damage.versatile"] = backup.versatile;
      for (const [activityId, parts] of Object.entries(backup.activities ?? {})) {
        update[`system.activities.${activityId}.damage.parts`] = parts;
      }
      itemUpdates.push(update);
    }

    await actor.update(actorUpdates);
    if (itemUpdates.length > 0) await actor.updateEmbeddedDocuments("Item", itemUpdates);
    await actor.unsetFlag(MODULE_ID, "minionifySnapshot");

    ui.notifications.info(`${actor.name} reverted to its original stats.`);
    return actor;
  } catch (err) {
    console.error("Encounter Builder | revertMinionify failed:", err);
    ui.notifications.error(`Revert failed for ${actor?.name ?? "actor"}: ${err.message}. Check the console (F12) for details.`);
    throw err;
  }
}

/**
 * Sets an actor's HP according to the chosen Encounter HP mode ("raw" =
 * leave the printed stat block alone, "average" = recompute from the hit-
 * point dice formula, "maxroll" = every hit die at max) — see
 * computeHpForMode() in hp-formula.js for the actual math. Deliberately
 * simple and NOT reversible — unlike Boss-ify, this has no flag/snapshot/
 * revert, matching the "just a general knob" scope the GM asked for
 * (ordinary encounter monsters never had a revert option either). Only
 * intended to be called once per freshly created Actor, whose HP is still
 * full (fresh from the compendium) — sets both value and max to the
 * computed number rather than preserving a damage ratio, since there's no
 * prior damage to preserve at this point in the flow.
 */
export async function scaleEncounterHp(actor, mode) {
  if (!mode || mode === "raw") return;

  try {
    const currentMax = actor.system.attributes?.hp?.max ?? 0;
    if (currentMax <= 0) return;

    const newMax = computeHpForMode(currentMax, actor.system.attributes?.hp?.formula, mode);
    if (!newMax || newMax === currentMax) return;

    await actor.update({
      "system.attributes.hp.max": newMax,
      "system.attributes.hp.value": newMax,
    });
  } catch (err) {
    console.error("Encounter Builder | scaleEncounterHp failed:", err);
    ui.notifications.error(`Encounter HP scaling failed for ${actor?.name ?? "actor"}: ${err.message}. Check the console (F12) for details.`);
    throw err;
  }
}
