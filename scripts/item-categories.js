/**
 * Maps dnd5e's own item type/subtype schema onto the loose, DMG-flavored
 * item categories a GM actually thinks in (Weapon, Armor, Wondrous Item,
 * ...) — dnd5e itself has no single field for this: "Armor" and "Wondrous
 * Item" are both `type: "equipment"`, distinguished only by
 * `system.type.value` (light/medium/heavy/shield/natural = Armor; ring/rod/
 * wand/clothing/trinket/vehicle/wondrous/unset = Wondrous Item). Verified
 * against the installed dnd5e system (CONFIG.DND5E.equipmentTypes/
 * consumableTypes/lootTypes) rather than guessed — see CLAUDE.md.
 *
 * Deliberately a many-to-one mapping (this file), not a lookup table the
 * GM edits — the DMG's own category boundaries aren't configurable per
 * campaign the way rarity/CR thresholds are.
 */

export const ITEM_CATEGORIES = [
  "Weapon",
  "Armor",
  "Ring",
  "Rod",
  "Wand",
  "Potion",
  "Scroll",
  "Wondrous Item",
  "Ammunition",
  "Tool",
  "Container",
  "Loot",
  "Other",
];

const ARMOR_SUBTYPES = new Set(["light", "medium", "heavy", "natural", "shield"]);

/**
 * @param {string} itemType - dnd5e Item#type ("weapon", "equipment", "consumable", "tool", "loot", "container", "backpack")
 * @param {string|undefined} typeValue - dnd5e Item#system.type.value (the subtype within itemType, e.g. "light" for equipment)
 * @returns {string} one of ITEM_CATEGORIES
 */
export function categorizeItem(itemType, typeValue) {
  switch (itemType) {
    case "weapon":
      return "Weapon";
    case "equipment":
      if (ARMOR_SUBTYPES.has(typeValue)) return "Armor";
      if (typeValue === "ring") return "Ring";
      if (typeValue === "rod") return "Rod";
      if (typeValue === "wand") return "Wand";
      // clothing, trinket, vehicle, "wondrous", or unset — the DMG's
      // catch-all category, and dnd5e's own catch-all subtype too.
      return "Wondrous Item";
    case "consumable":
      if (typeValue === "potion") return "Potion";
      if (typeValue === "scroll") return "Scroll";
      if (typeValue === "rod") return "Rod";
      if (typeValue === "wand") return "Wand";
      if (typeValue === "trinket" || typeValue === "wondrous") return "Wondrous Item";
      if (typeValue === "ammo") return "Ammunition";
      // food, poison, or unset — mundane consumables with a rarity set
      // (rare, but the source data occasionally does this).
      return "Other";
    case "tool":
      return "Tool";
    case "container":
    case "backpack":
      return "Container";
    case "loot":
      // art, gear, gem, junk, material, resource, trade, treasure — none
      // of these are magic-item-table categories, just valuables/gear.
      return "Loot";
    default:
      return "Other";
  }
}

/** Categories actually present in an item index, in ITEM_CATEGORIES' fixed order — same "only show what exists" pattern as getAvailableRarities() in loot-generator.js. */
export function getAvailableCategories(itemIndex) {
  const present = new Set(itemIndex.map((i) => i.category));
  return ITEM_CATEGORIES.filter((category) => present.has(category));
}
