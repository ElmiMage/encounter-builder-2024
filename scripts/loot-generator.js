import { generateHoard } from "./treasure-tables.js";
import { pickCanvasPoint } from "./canvas-picker.js";
import { getPackSourceLabel, getPackGroupInfo } from "./compendium-browser.js";

/**
 * Simplified mapping from DMG Magic Item Table letter to a dnd5e item
 * rarity. The real tables mix specific item types with sub-weightings
 * per rarity; this collapses each letter to its dominant rarity so we
 * can pull a real, correctly-built item from the GM's own compendiums
 * instead of maintaining a separate hardcoded item list.
 */
const MAGIC_TABLE_TO_RARITY = {
  A: "common",
  B: "uncommon",
  C: "uncommon",
  D: "rare",
  E: "rare",
  F: "veryRare",
  G: "legendary",
};

/** Fixed rarity tiers shown as adjustable count rows, regardless of what's actually present in the GM's compendiums. */
export const RARITY_TIERS = ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"];

/**
 * dnd5e stores a LOT of non-physical things as "Item" documents too —
 * feats, spells, classes, subclasses, backgrounds, races, class
 * features. None of those are lootable gear, so we restrict everything
 * loot-related to just the physical item subtypes.
 */
const PHYSICAL_ITEM_TYPES = new Set(["weapon", "equipment", "consumable", "tool", "loot", "container", "backpack"]);

function isPhysicalItemEntry(entry) {
  if (!PHYSICAL_ITEM_TYPES.has(entry.type)) return false;
  // Monster natural attacks (Bite, Claw, etc.) are also stored as
  // type "weapon" in dnd5e, distinguished only by this sub-type flag —
  // exclude them, since they're monster features, not lootable gear.
  if (entry.type === "weapon" && entry.system?.type?.value === "natural") return false;
  return true;
}

/** Finds every Item-type compendium currently active (system + module + world), optionally restricted to a given set of collection IDs. */
function getItemPacks(collectionIds = null) {
  return game.packs.filter(
    (pack) => pack.documentName === "Item" && (!collectionIds || collectionIds.includes(pack.collection))
  );
}

/**
 * Returns metadata only for Item compendiums that actually contain at
 * least one physical, lootable item — filters out compendiums that are
 * entirely feats, spells, classes, backgrounds, etc. (mirrors how
 * listMonsterCompendiums() filters Actor packs down to actual NPCs).
 */
export async function listItemCompendiums() {
  const results = [];
  for (const pack of getItemPacks()) {
    const index = await pack.getIndex({ fields: ["type", "system.type.value"] });
    const physicalCount = index.filter(isPhysicalItemEntry).length;
    if (physicalCount === 0) continue;

    const { groupKey, groupLabel } = getPackGroupInfo(pack);
    results.push({
      collection: pack.collection,
      label: pack.metadata.label ?? pack.metadata.name ?? "Compendium",
      groupKey,
      groupLabel,
      total: physicalCount,
    });
  }
  return results;
}

/**
 * Loads a lightweight index (name, img, rarity, type) of every
 * PHYSICAL item in every active Item compendium — used for the
 * searchable loot browser. Does NOT load full Item documents until one
 * is actually added to a loot plan.
 */
export async function loadItemIndex(collectionIds = null) {
  const items = [];
  for (const pack of getItemPacks(collectionIds)) {
    const index = await pack.getIndex({ fields: ["type", "system.type.value", "system.rarity", "img"] });
    for (const entry of index) {
      if (!isPhysicalItemEntry(entry)) continue;
      items.push({
        uuid: `Compendium.${pack.collection}.${entry._id}`,
        name: entry.name,
        img: entry.img,
        rarity: entry.system?.rarity || "mundane",
        itemType: entry.type,
        sourcePack: pack.collection,
        sourceLabel: getPackSourceLabel(pack),
      });
    }
  }
  return items;
}

/** Unique, sorted rarities actually present in an item index — used to populate the filter dropdown. */
export function getAvailableRarities(itemIndex) {
  return [...new Set(itemIndex.map((i) => i.rarity))].sort();
}

/** Finds every physical item of a given rarity across the given (or all) Item compendiums (name/img/uuid only, for random picking). */
async function getCandidatesForRarity(rarity, collectionIds = null) {
  const candidates = [];
  for (const pack of getItemPacks(collectionIds)) {
    const index = await pack.getIndex({ fields: ["type", "system.type.value", "system.rarity", "img"] });
    for (const entry of index) {
      if (isPhysicalItemEntry(entry) && entry.system?.rarity === rarity) {
        candidates.push({ uuid: `Compendium.${pack.collection}.${entry._id}`, name: entry.name, img: entry.img });
      }
    }
  }
  return candidates;
}

/**
 * Randomly resolves actual items for a { rarity: count } map — this is
 * what makes the loot plan a real preview instead of a blind roll: the
 * GM sees exactly which items were picked before ever creating the
 * Actor, and can reroll or hand-edit from there.
 *
 * @returns {{uuid,name,img,rarity,count,source:"rolled"}[]}
 */
export async function resolveMagicItems(rarityCounts, collectionIds = null) {
  const resolved = new Map(); // uuid -> entry
  const shortages = [];

  for (const rarity of RARITY_TIERS) {
    const count = rarityCounts?.[rarity] ?? 0;
    if (count <= 0) continue;

    const candidates = await getCandidatesForRarity(rarity, collectionIds);
    if (candidates.length === 0) {
      shortages.push(rarity);
      continue;
    }

    for (let i = 0; i < count; i++) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const existing = resolved.get(pick.uuid);
      if (existing) existing.count += 1;
      else resolved.set(pick.uuid, { uuid: pick.uuid, name: pick.name, img: pick.img, rarity, count: 1, source: "rolled" });
    }
  }

  if (shortages.length > 0) {
    ui.notifications.warn(`No items found for rarity: ${shortages.join(", ")} — none loaded in your active compendiums.`);
  }

  return [...resolved.values()];
}

/**
 * Rolls a DMG-suggested hoard AND immediately resolves the actual magic
 * items for preview (unlike earlier versions, which only stored counts
 * and resolved items invisibly at creation time).
 */
export async function suggestLootPlan(cr, collectionIds = null) {
  const hoard = generateHoard(cr);
  const rarityCounts = Object.fromEntries(RARITY_TIERS.map((r) => [r, 0]));
  if (hoard.gemsOrArt.magicItemTable && hoard.gemsOrArt.magicItemCount > 0) {
    const rarity = MAGIC_TABLE_TO_RARITY[hoard.gemsOrArt.magicItemTable];
    rarityCounts[rarity] = (rarityCounts[rarity] ?? 0) + hoard.gemsOrArt.magicItemCount;
  }

  const items = await resolveMagicItems(rarityCounts, collectionIds);

  return {
    tier: hoard.tier,
    confidence: hoard.confidence,
    coins: hoard.coins,
    gemsOrArt: {
      // Simplified deliberately: the DMG table can roll either "gems"
      // or "art objects", but the module only exposes a single
      // "Gems" field to keep the UI simple — both roll outcomes are
      // treated the same way here (count + per-unit value).
      type: hoard.gemsOrArt.type === "none" ? "none" : "gems",
      count: hoard.gemsOrArt.count ?? 0,
      unitValue: hoard.gemsOrArt.unitValue ?? 0,
    },
    rarityCounts,
    items, // {uuid, name, img, rarity, count, source: "rolled"|"manual"}[]
  };
}

/**
 * Re-rolls just the magic items using the CURRENT rarityCounts on the
 * plan (which the GM may have hand-edited since the initial roll),
 * replacing only the previously auto-rolled entries — anything added
 * manually via search is left untouched.
 */
export async function rerollMagicItems(plan, collectionIds = null) {
  const rolled = await resolveMagicItems(plan.rarityCounts, collectionIds);
  const manual = plan.items.filter((i) => i.source === "manual");
  return [...rolled, ...manual];
}

/**
 * Creates a loot Actor from an (possibly GM-edited) loot plan — real
 * Items in its inventory (currency, gems/art as a loot item, the exact
 * items shown in the plan preview), then places it on the current
 * scene as a token that is hidden (invisible to players) and —
 * critically — is never added to any Combat encounter, since it
 * doesn't fight.
 *
 * @param {object} plan - shape returned by suggestLootPlan(), optionally edited
 * @param {number} representativeCR - only used for the Actor's display name
 */
export async function createLootActor(plan, representativeCR) {
  try {
    const folder =
      game.folders.find((f) => f.type === "Actor" && f.name === "Encounter Builder Loot") ??
      (await Folder.create({ name: "Encounter Builder Loot", type: "Actor" }));

    const actor = await Actor.create({
      name: `Treasure Hoard (CR ${representativeCR})`,
      type: "npc",
      img: "icons/containers/chest/chest-worn-oak-tan.webp",
      folder: folder.id,
      system: {
        currency: { cp: plan.coins.cp, sp: plan.coins.sp, ep: plan.coins.ep, gp: plan.coins.gp, pp: plan.coins.pp },
        details: { cr: 0 }, // harmless placeholder — this actor is loot, not a combatant
      },
    });
    if (!actor) throw new Error("Actor.create() returned nothing.");

    const itemsToAdd = [];

    if (plan.gemsOrArt && plan.gemsOrArt.type !== "none" && plan.gemsOrArt.count > 0) {
      const label = "Gemstones";
      itemsToAdd.push({
        name: `${label} (${plan.gemsOrArt.unitValue} gp each)`,
        type: "loot",
        img: "icons/commodities/gems/gem-faceted-navette-red.webp",
        system: { quantity: plan.gemsOrArt.count, price: { value: plan.gemsOrArt.unitValue, denomination: "gp" } },
      });
    }

    // Items are already fully resolved on the plan (no more randomness
    // happening here) — this loop just materializes exactly what the
    // GM saw in the preview.
    for (const planItem of plan.items ?? []) {
      const fullItem = await fromUuid(planItem.uuid);
      if (!fullItem) {
        console.warn(`Encounter Builder Loot | fromUuid() failed for ${planItem.uuid} (${planItem.name})`);
        continue;
      }
      const data = fullItem.toObject();
      if (data.system?.quantity !== undefined) data.system.quantity = planItem.count ?? 1;
      itemsToAdd.push(data);
    }

    console.log(`Encounter Builder Loot | creating ${itemsToAdd.length} item(s) on the loot actor`, itemsToAdd);
    if (itemsToAdd.length > 0) {
      await actor.createEmbeddedDocuments("Item", itemsToAdd);
    }

    const scene = canvas.scene ?? game.scenes.current;
    if (scene) {
      ui.notifications.info("Click on the canvas to place the treasure hoard.");
      const dropPoint = await pickCanvasPoint(scene);
      const proto = actor.prototypeToken.toObject();
      await scene.createEmbeddedDocuments("Token", [
        {
          ...proto,
          actorId: actor.id,
          x: dropPoint.x - (proto.width * (scene.grid?.size ?? 100)) / 2,
          y: dropPoint.y - (proto.height * (scene.grid?.size ?? 100)) / 2,
          // The whole point: invisible to players, and deliberately never
          // added as a Combatant anywhere in this codebase — loot doesn't fight.
          hidden: true,
        },
      ]);
    } else {
      ui.notifications.warn("No active scene — loot Actor was created but no token was placed.");
    }

    return actor;
  } catch (err) {
    console.error("Encounter Builder Loot | createLootActor failed:", err);
    ui.notifications.error(`Loot generation failed: ${err.message}. Check the console (F12) for details.`);
    throw err;
  }
}
