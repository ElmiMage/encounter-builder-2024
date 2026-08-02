/**
 * Applies a GM-chosen customization (custom name, flat magic bonus, extra
 * damage type on weapons, extra resistance type on armor) onto a plain item
 * data object — the same shape `Item#toObject()` produces, which is what
 * createLootActor() already works with (see loot-generator.js). Deliberately
 * homebrew, no DMG table backing it (unlike Boss-ify's tiers) — this is
 * "reflavor a mundane item as this encounter's magic find", not a RAW magic
 * item generator.
 *
 * Mechanically piggybacks on real dnd5e fields rather than inventing
 * anything, all verified live against the installed dnd5e system (see
 * CLAUDE.md):
 * - Flat magic bonus: `system.magicalBonus` for weapons and non-armor
 *   equipment (rings, rods, wands, wondrous items — same field the 2024
 *   "Weapon, +1, +2, or +3" / "Wand of the War Mage, +1, +2, or +3"
 *   template items use), but `system.armor.magicalBonus` (nested!) for
 *   actual armor/shields — confirmed against the 2024 "Armor, +1, +2, or
 *   +3" and "Shield, +1, +2, or +3" template items' own Active Effects,
 *   which target that nested path specifically. Using the wrong one is a
 *   silent no-op (the AC calc only reads the armor-nested field), which is
 *   exactly the bug this categorization fixes.
 * - Extra weapon damage type: a new entry in the weapon's attack Activity's
 *   `damage.parts` (verified shape: `system.activities` is a plain object
 *   keyed by activity id once `.toObject()`'d, matching how
 *   monster-scaling.js already addresses it).
 * - Extra armor resistance type: a new Active Effect with
 *   `transfer: true` and a `system.traits.dr.value` ADD change — verified
 *   against real resistance-granting items (Ring of Fire Resistance, the
 *   2024 "Armor of Resistance" family), which grant resistance exactly
 *   this way rather than through any item-level "resistance" field.
 * - Attunement: `system.attunement` is a plain string field, NOT a
 *   boolean — verified against the live installed dnd5e system (a real
 *   2024 "Ring of Protection" reads `"required"`; the 2024 "Weapon, +1,
 *   +2, or +3" template item, which needs none, reads `""`, not `null`/
 *   `"none"`). `CONFIG.DND5E.attunementTypes` only defines `"required"`
 *   and `"optional"` as real choices — this feature only ever writes
 *   `"required"` (optional attunement isn't exposed here, no user request
 *   for it), and only when explicitly checked; unchecked leaves the base
 *   item's own attunement requirement alone rather than clearing it.
 * - Custom description: overwrites `system.description.value` wholesale,
 *   not appended — a half-generic/half-custom description read worse
 *   than either alone, so the GM either writes the whole thing or leaves
 *   the base item's own description untouched.
 *
 * The `"mgc"` (magical) properties flag is set whenever a magic bonus,
 * extra damage/resistance, or attunement requirement applies, matching
 * how real magic items are flagged — a custom description alone doesn't
 * imply magical (reflavoring fluff text isn't the same claim).
 */

import { categorizeItem } from "./item-categories.js";
import { RARITY_TIERS } from "./treasure-tables.js";

export const EXTRA_DAMAGE_TYPES = [
  "acid",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "poison",
  "psychic",
  "radiant",
  "thunder",
];

// Armor can additionally be made resistant to the three physical damage
// types (a very common real magic-armor effect) — weapons never need to
// deal "extra bludgeoning damage" via this feature, so this list is
// deliberately separate from EXTRA_DAMAGE_TYPES rather than reusing it.
export const EXTRA_RESISTANCE_TYPES = [...EXTRA_DAMAGE_TYPES, "bludgeoning", "piercing", "slashing"];

export const DAMAGE_DENOMINATIONS = [4, 6, 8, 10, 12];

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Suggests a display name from the base item's name plus whichever
 * customizations are currently selected — e.g. "Longsword" + bonus 2 +
 * extraDamageType "acid" → "Acid Longsword +2"; "Studded Leather Armor" +
 * bonus 1 + extraResistanceType "fire" → "Studded Leather Armor of Fire
 * +1". Bonus always goes last regardless of category (on user request —
 * originally sat right after the base name for armor, ahead of "of X",
 * which read wrong). Resistance uses a bare "of X" — no trailing
 * "Resistance" word (on user request; the type alone reads as intended,
 * "Armor of Fire" not "Armor of Fire Resistance"). Strips any existing
 * "+N" suffix from the base name first, so re-suggesting after picking a
 * higher bonus on an already-"+1"-named item doesn't stack ("Longsword +1
 * +2"). Returns "" (no suggestion) if nothing is actually selected yet,
 * so callers can fall back to leaving the name field untouched/empty.
 *
 * @param {string} baseName
 * @param {{magicalBonus?:number, extraDamageType?:string|null, extraResistanceType?:string|null}} [options]
 */
export function suggestItemName(baseName, { magicalBonus = 0, extraDamageType = null, extraResistanceType = null } = {}) {
  if (!magicalBonus && !extraDamageType && !extraResistanceType) return "";
  let name = (baseName ?? "").replace(/\s*\+\d+\s*$/, "").trim();
  if (extraDamageType) name = `${capitalize(extraDamageType)} ${name}`;
  if (extraResistanceType) name = `${name} of ${capitalize(extraResistanceType)}`;
  if (magicalBonus > 0) name = `${name} +${magicalBonus}`;
  return name;
}

// Armor lands one rarity step higher than a weapon with the same bonus/
// extras — verified against the real 2024 template items: "Armor +1" is
// "rare" (weapon's is only "uncommon"), "Armor +2" is "veryRare" ("rare"
// for weapon), "Armor +3" is "legendary" ("veryRare" for weapon) — a
// consistent +1 offset. The armor-only "Armor of Resistance" family (no
// numeric bonus at all) is "rare" too, which is exactly what this +1
// offset predicts for a single "extra" step (1 + 1 offset = index 2 =
// "rare") — the same formula covers both known real data points, not
// just the bonus case, so it's not just curve-fit to one example.
const RARITY_OFFSET_BY_CATEGORY = { Armor: 1 };

/**
 * Homebrew rarity bump — Stephan's own heuristic ("jeder +1 Bonus erhöht
 * es um eine Stufe, jedes Extra zählt auch als +1"), not an official DMG
 * table, but calibrated to land exactly on the real 2024 template items'
 * own rarities (see RARITY_OFFSET_BY_CATEGORY above) rather than being
 * purely invented: each point of magic bonus, PLUS one more for an extra
 * damage type (weapon) or extra resistance type (armor) if either is
 * picked, moves the item up that many steps on RARITY_TIERS starting
 * from "common" — with armor starting one step higher than weapons for
 * the same inputs (on user request — other, later-relevant things
 * distinguish armor rarity from weapon rarity, so the book's own
 * asymmetry here is worth keeping rather than simplifying away). Never
 * downgrades: the higher of the item's current rarity and the computed
 * one wins.
 *
 * @param {string} currentRarity - the item's rarity before this customization (RARITY_TIERS key, or ""/unset for a mundane item)
 * @param {{magicalBonus?:number, extraDamage?:boolean, extraResistance?:boolean, category?:string}} [options]
 * @returns {string} a RARITY_TIERS key
 */
export function suggestRarity(currentRarity, { magicalBonus = 0, extraDamage = false, extraResistance = false, category = null } = {}) {
  const steps = (Number(magicalBonus) || 0) + (extraDamage ? 1 : 0) + (extraResistance ? 1 : 0);
  if (steps <= 0) return currentRarity;
  const offset = RARITY_OFFSET_BY_CATEGORY[category] ?? 0;
  const currentIndex = Math.max(0, RARITY_TIERS.indexOf(currentRarity));
  const targetIndex = Math.min(RARITY_TIERS.length - 1, steps + offset);
  return RARITY_TIERS[Math.max(currentIndex, targetIndex)];
}

/**
 * @param {object} itemData - plain item data (e.g. from Item#toObject())
 * @param {{name?:string, customization:{magicalBonus?:number, extraDamage?:{number:number, denomination:number, type:string}|null, extraResistance?:string|null, requiresAttunement?:boolean, description?:string|null, rarity?:string}}} planItem
 * @returns {object} a new, modified item data object — itemData itself is untouched
 */
export function applyItemCustomization(itemData, planItem) {
  const customization = planItem?.customization;
  if (!customization) return itemData;

  const data = JSON.parse(JSON.stringify(itemData));

  if (planItem.name) data.name = planItem.name;

  if (customization.description) {
    data.system.description ??= {};
    data.system.description.value = customization.description;
  }

  const category = categorizeItem(data.type, data.system?.type?.value);
  const bonus = Number(customization.magicalBonus) || 0;
  const extraDamage = customization.extraDamage;
  const extraResistance = customization.extraResistance;

  if (bonus > 0) {
    if (category === "Armor") {
      data.system.armor ??= {};
      data.system.armor.magicalBonus = String(bonus);
    } else {
      data.system.magicalBonus = String(bonus);
    }
  }

  if (customization.requiresAttunement) {
    data.system.attunement = "required";
  }

  if (extraDamage && extraDamage.number > 0 && extraDamage.denomination && extraDamage.type) {
    const activities = data.system.activities ?? {};
    for (const activity of Object.values(activities)) {
      if (activity.type !== "attack") continue;
      activity.damage ??= { parts: [] };
      activity.damage.parts ??= [];
      activity.damage.parts.push({
        number: extraDamage.number,
        denomination: extraDamage.denomination,
        bonus: "",
        types: [extraDamage.type],
        custom: { enabled: false, formula: "" },
        scaling: { mode: "", number: null, formula: "" },
      });
    }
  }

  if (extraResistance) {
    data.effects ??= [];
    data.effects.push({
      name: `${capitalize(extraResistance)} Resistance`,
      transfer: true,
      changes: [{ key: "system.traits.dr.value", value: extraResistance, mode: 2, priority: null }],
    });
  }

  if (bonus > 0 || extraDamage || extraResistance || customization.requiresAttunement) {
    const properties = new Set(data.system.properties ?? []);
    properties.add("mgc");
    data.system.properties = [...properties];
  }

  if (customization.rarity) {
    data.system.rarity = customization.rarity;
  }

  return data;
}
