import { xpForChallengeRating } from "./xp-budget.js";

/**
 * Reads monster data from ALL currently active Actor compendiums —
 * this includes system compendiums (dnd5e SRD), module compendiums,
 * and the GM's own world/module compendiums. Foundry does not
 * distinguish between these at the API level (game.packs is a single
 * flat collection), so no special-casing is needed for homebrew content.
 */

/** Fields we need from the index without loading full Actor documents. */
const INDEX_FIELDS = [
  "type",
  "system.details.cr",
  "system.details.xp.value",
  "system.details.type.value",
  "system.details.type.subtype",
  "system.traits.size",
  // Verified live (2026-08): shape is { value: [{type, subtype?}, ...], custom: "" }.
  "system.details.habitat",
  // Whether this monster HAS lair actions at all (system.resources.lair.value,
  // verified against the dnd5e source) — distinct from system.resources.lair.inside,
  // which is a live combat-state flag on a placed Actor, not compendium data,
  // and is set per-encounter in the app UI instead (see #onToggleLair).
  "system.resources.lair.value",
  "img",
];

/** An index entry counts as a "monster" if it's an NPC with a defined CR. */
function isMonsterEntry(entry) {
  return entry.type === "npc" && entry.system?.details?.cr !== undefined && entry.system?.details?.cr !== null;
}

/**
 * Returns { groupKey, groupLabel } identifying which module/system/world
 * a pack belongs to — used to build a collapsible, grouped compendium
 * picker (like Foundry's own sidebar) instead of one flat list.
 *
 * Foundry's Compendium Directory sidebar can organize packs into named
 * folders (e.g. dnd5e's own "D&D Legacy Content" vs "D&D Modern
 * Content", which matters a lot here since 2014 and 2024 SRD items
 * differ significantly). We prefer that folder — since it's the finer,
 * more meaningful distinction — and only fall back to grouping by
 * module/system/world if the pack isn't organized into one.
 *
 * NOTE: `pack.folder` could not be confirmed against a live Foundry
 * instance, so this is defensive: it accepts either a resolved Folder
 * document or a bare id string, and silently falls through to the
 * package-based grouping if neither resolves to a usable name.
 */
export function getPackGroupInfo(pack) {
  const rawFolder = pack.folder;
  if (rawFolder) {
    const folderDoc = typeof rawFolder === "string" ? game.folders?.get(rawFolder) : rawFolder;
    if (folderDoc) {
      // Walk up to the TOPMOST ancestor folder, not just the direct
      // parent — some packs sit two or more folders deep (e.g. dnd5e's
      // "D&D Legacy Content" > "Items & Spells" > actual pack), and
      // grouping by the direct parent alone would surface "Items &
      // Spells" as a top-level bucket instead of "D&D Legacy Content".
      const ancestors = folderDoc.ancestors ?? [];
      const root = ancestors.length > 0 ? ancestors[ancestors.length - 1] : folderDoc;
      if (root?.name) {
        return { groupKey: `folder:${root.id ?? root.name}`, groupLabel: root.name };
      }
    }
  }

  const packageType = pack.metadata.packageType;
  const packageName = pack.metadata.packageName;

  if (packageType === "module") {
    const mod = game.modules?.get(packageName);
    return { groupKey: `module:${packageName}`, groupLabel: mod?.title ?? packageName };
  }
  if (packageType === "system") {
    return { groupKey: "system", groupLabel: game.system?.title ?? "System" };
  }
  if (packageType === "world") {
    return { groupKey: "world", groupLabel: "World" };
  }
  return { groupKey: "other", groupLabel: "Other" };
}

/**
 * Builds a more identifiable display name for a compendium pack. Some
 * packs (especially from smaller third-party modules) ship with a
 * generic label like "Actors" rather than something distinctive like
 * "Monster Manual" — appending the owning module/system's own title
 * at least tells the GM WHERE it came from, even when the pack's own
 * label doesn't say much.
 */
export function getPackSourceLabel(pack) {
  const packLabel = pack.metadata.label ?? pack.metadata.name ?? "Compendium";
  const packageName = pack.metadata.packageName;

  if (pack.metadata.packageType === "module") {
    const mod = game.modules?.get(packageName);
    if (mod?.title && mod.title !== packLabel) return `${packLabel} (${mod.title})`;
  } else if (pack.metadata.packageType === "system") {
    const sysTitle = game.system?.title;
    if (sysTitle && sysTitle !== packLabel) return `${packLabel} (${sysTitle})`;
  } else if (pack.metadata.packageType === "world") {
    return `${packLabel} (World)`;
  }
  return packLabel;
}

/**
 * Returns metadata only for Actor compendiums that actually contain at
 * least one monster (NPC with a CR) — filters out PC-only folders,
 * vehicle compendiums, empty packs, etc. This does one index load per
 * pack, so it's a bit more work than a plain listing, but it's the only
 * reliable way to know what's actually inside without hardcoding
 * assumptions about pack naming.
 */
export async function listMonsterCompendiums() {
  const actorPacks = game.packs.filter((pack) => pack.documentName === "Actor");
  const results = [];

  for (const pack of actorPacks) {
    let index;
    try {
      index = await pack.getIndex({ fields: INDEX_FIELDS });
    } catch (err) {
      console.warn(`Encounter Builder | failed to read index for pack "${pack.collection}", skipping`, err);
      continue;
    }
    const monsterCount = index.filter(isMonsterEntry).length;
    if (monsterCount === 0) continue;

    const { groupKey, groupLabel } = getPackGroupInfo(pack);
    results.push({
      collection: pack.collection,
      label: pack.metadata.label ?? pack.metadata.name ?? "Compendium",
      packageName: pack.metadata.packageName,
      packageType: pack.metadata.packageType, // "system" | "module" | "world"
      groupKey,
      groupLabel,
      total: monsterCount,
    });
  }
  return results;
}

/**
 * Loads a lightweight index (name, img, CR, XP, creature type) for every
 * monster in the given compendium collections. Does NOT load full Actor
 * documents until one is actually added to an encounter.
 *
 * @param {string[]} collectionIds - values from pack.collection, as
 *   returned by listMonsterCompendiums(). If omitted, searches all
 *   Actor compendiums that contain monsters.
 */
export async function loadMonsterIndex(collectionIds = null) {
  const packs = game.packs.filter(
    (pack) =>
      pack.documentName === "Actor" &&
      (!collectionIds || collectionIds.includes(pack.collection))
  );

  const monsters = [];
  for (const pack of packs) {
    let index;
    try {
      index = await pack.getIndex({ fields: INDEX_FIELDS });
    } catch (err) {
      console.warn(`Encounter Builder | failed to read index for pack "${pack.collection}", skipping`, err);
      continue;
    }
    for (const entry of index) {
      if (!isMonsterEntry(entry)) continue;

      monsters.push({
        uuid: `Compendium.${pack.collection}.${entry._id}`,
        id: entry._id,
        name: entry.name,
        img: entry.img,
        cr: entry.system.details.cr,
        // Prefer an explicit stored XP (e.g. homebrew override), fall back
        // to the standard CR-derived value since the compendium index
        // often doesn't expose Foundry's runtime-computed XP field.
        xp: entry.system?.details?.xp?.value ?? xpForChallengeRating(entry.system.details.cr),
        creatureType: entry.system?.details?.type?.value || "unknown",
        subtype: entry.system?.details?.type?.subtype || null,
        size: entry.system?.traits?.size || null,
        // Verified live shape is {value: [...], custom: ""}; the extra
        // Array/Set branches in normalizeHabitat are defensive fallbacks
        // for other dnd5e versions, not the confirmed common case.
        habitats: normalizeHabitat(entry.system?.details?.habitat),
        // Verified against dnd5e source: system.resources.lair.value means
        // the monster has lair actions available at all (as opposed to
        // .inside, a live combat-state flag not present in compendium data).
        hasLairActions: !!entry.system?.resources?.lair?.value,
        sourcePack: pack.collection,
        sourceLabel: getPackSourceLabel(pack),
      });
    }
  }
  return monsters;
}

/**
 * Normalizes the habitat field into a flat array of strings. Confirmed
 * live shape is {value: [{type, subtype?}, ...], custom: ""}. The free-text
 * `custom` field is appended as its own entry when non-empty. The Array/Set
 * branches below are defensive fallbacks, not observed in practice.
 */
function normalizeHabitat(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(extractHabitatLabel).filter(Boolean);
  if (raw instanceof Set) return [...raw].map(extractHabitatLabel).filter(Boolean);
  if (raw.value) {
    const labels = normalizeHabitat(raw.value);
    const custom = typeof raw.custom === "string" ? raw.custom.trim().toLowerCase() : "";
    if (custom) labels.push(custom);
    return labels;
  }
  return [];
}

/**
 * Pulls a display string out of a single habitat entry, whatever shape it
 * turns out to be. When both type and subtype are present (e.g. planar
 * creatures: {type: "planar", subtype: "elemental plane of air"}), both
 * are kept — otherwise every planar creature would collapse into one
 * generic "planar" filter value regardless of which plane.
 *
 * Lower-cased like every other raw filter key in this module (creature
 * type, subtype, rarity) — display capitalization is applied later by
 * the `humanize` Handlebars helper, never baked into the stored value.
 * This also fixes a real filtering bug, not just cosmetics: the transcribed
 * subtype text is inconsistently cased across source compendiums (e.g.
 * "Shadowfell" vs "shadowfell"), and getAvailableHabitats dedupes by exact
 * string match — without normalizing here, picking one casing from the
 * dropdown would silently miss creatures tagged with the other casing.
 */
function extractHabitatLabel(entry) {
  if (typeof entry === "string") return entry.toLowerCase();
  if (entry?.type && entry?.subtype) return `${entry.type} (${entry.subtype})`.toLowerCase();
  if (entry?.value) return String(entry.value).toLowerCase();
  if (entry?.type) return entry.type.toLowerCase();
  if (entry?.label) return String(entry.label).toLowerCase();
  return null; // deliberately drop anything we can't make sense of, rather than showing "[object Object]"
}

/** Unique, sorted creature types present in a monster index — used to populate the filter dropdown. */
export function getAvailableCreatureTypes(monsterIndex) {
  return [...new Set(monsterIndex.map((m) => m.creatureType))].sort();
}

/** Unique, sorted creature subtypes (e.g. "goblinoid", "shapechanger") present in a monster index. */
export function getAvailableSubtypes(monsterIndex) {
  return [...new Set(monsterIndex.map((m) => m.subtype).filter(Boolean))].sort();
}

/** Standard dnd5e size keys, written out the way stat blocks display them. */
const SIZE_LABELS = {
  tiny: "Tiny",
  sm: "Small",
  med: "Medium",
  lg: "Large",
  huge: "Huge",
  grg: "Gargantuan",
};

/** Unique, sorted creature sizes present in a monster index, as {value, label} pairs (label is the spelled-out stat-block name). */
export function getAvailableSizes(monsterIndex) {
  const values = [...new Set(monsterIndex.map((m) => m.size).filter(Boolean))];
  const order = Object.keys(SIZE_LABELS);
  values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return values.map((value) => ({ value, label: SIZE_LABELS[value] ?? value }));
}

/** Unique, sorted habitats present in a monster index — empty if the field turns out not to exist in this dnd5e version. */
export function getAvailableHabitats(monsterIndex) {
  return [...new Set(monsterIndex.flatMap((m) => m.habitats))].sort();
}

/**
 * Full Actor document is only needed when actually placing the monster
 * into a scene/combat — this defers the more expensive load.
 */
export async function loadFullActor(uuid) {
  return fromUuid(uuid);
}
