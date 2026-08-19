import { EncounterBuilderApp } from "./encounter-builder-app.js";
import { humanizeToken } from "./format.js";
import { ScalingSettingsApp } from "./scaling-settings-app.js";
import { MINION_XP_MULTIPLIER } from "./minion-scaling.js";
import { DEFAULT_BOSS_SHARE } from "./auto-fill.js";
import { loadFullActor } from "./compendium-browser.js";

let appInstance = null;

function openEncounterBuilder() {
  if (!appInstance) appInstance = new EncounterBuilderApp();
  appInstance.render(true);
}

Hooks.once("init", () => {
  console.log("Encounter Builder (2024 Rules) | Initializing");

  // Display-only formatting for raw system keys (rarity tiers, creature
  // types/subtypes, habitats) — e.g. "veryRare" -> "Very Rare",
  // "undead" -> "Undead". Filter values/option[value] stay the raw key;
  // only what's shown to the GM goes through this.
  Handlebars.registerHelper("humanize", humanizeToken);

  // Client-scoped (not world) so each GM keeps their own compendium
  // selection instead of overwriting each other's — stores only the
  // DISABLED collection ids, so any compendium added later (new module,
  // new pack) defaults to enabled without needing a migration.
  game.settings.register("encounter-builder-2024", "disabledMonsterCompendiums", {
    scope: "client",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register("encounter-builder-2024", "disabledLootCompendiums", {
    scope: "client",
    config: false,
    type: Array,
    default: [],
  });

  // World-scoped (not client) — presets are prepared encounter content, not
  // a personal tool preference, so every GM in the world sees the same
  // list. Each entry: {name, partyLevel, partySize, difficulty, entries:
  // [{uuid, count, inLair, isBoss, bossifyTier, minionify, applyAC,
  // applyHP, applyAbilities, applyDamageDice}, ...]}.
  game.settings.register("encounter-builder-2024", "encounterPresets", {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });

  // User-facing preferences, shown under Configure Settings > Module
  // Settings. Client-scoped like the compendium selection above — these
  // are personal tool preferences for whichever GM opens the app, not a
  // world-wide rule, and stay consistent with a multi-GM world not
  // overwriting each other's choices.
  game.settings.register("encounter-builder-2024", "autoSyncParty", {
    name: "Auto-sync Party Level/Size from Party actor",
    hint: "When opening the Encounter Builder, automatically set Party Level and Size from Foundry's designated Party actor (if one exists). Turn off if you prefer to always set these manually.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register("encounter-builder-2024", "defaultDifficulty", {
    name: "Default Difficulty",
    hint: "The Difficulty the Encounter Builder starts on each time you reload Foundry.",
    scope: "client",
    config: true,
    type: String,
    choices: { low: "Low", moderate: "Moderate", high: "High" },
    default: "moderate",
  });
  game.settings.register("encounter-builder-2024", "defaultLootBasis", {
    name: "Default Loot Basis (Treasure Hoard tab)",
    hint: "Whether the Treasure Hoard tab starts on the RAW tier table, or automatically on the homebrew smoothed table matching the current Party Level.",
    scope: "client",
    config: true,
    type: String,
    choices: { auto: "Tier (RAW)", partyLevel: "Match Party Level (smoothed)" },
    default: "auto",
  });
  game.settings.register("encounter-builder-2024", "defaultEncounterHpMode", {
    name: "Default Encounter HP",
    hint: "The Encounter HP mode the Encounter Builder starts on each time you reload Foundry.",
    scope: "client",
    config: true,
    type: String,
    choices: { raw: "RAW (printed)", minroll: "Minroll", maxroll: "Maxroll" },
    default: "raw",
  });
  game.settings.register("encounter-builder-2024", "defaultBossMode", {
    name: "Default Boss Encounter",
    hint: "Whether the 'Boss Encounter' checkbox starts checked each time you open the Encounter Builder.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  // Boss-ify/Minion-ify tuning values — hidden from the default settings
  // list (config:false, like the compendium-selection settings above) since
  // there are 10 individual numbers between them; edited instead through a
  // dedicated menu app (registerMenu below) that shows them as one small
  // table instead of 10 separate rows. bossifyTierConfig stores only
  // whatever the GM has actually changed (mergeTierConfig in
  // bossify-scaling.js layers it onto the built-in defaults), so it starts
  // as {} rather than a full copy of BOSSIFY_TIERS.
  game.settings.register("encounter-builder-2024", "bossifyTierConfig", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });
  game.settings.register("encounter-builder-2024", "minionXpMultiplier", {
    scope: "client",
    config: false,
    type: Number,
    default: Math.round(MINION_XP_MULTIPLIER * 100),
  });
  // Same "hidden raw value, edited via the menu app" pattern as the two
  // settings above — how much of the total XP budget Boss Encounter mode
  // reserves for the boss itself (the rest goes to supporting adds).
  game.settings.register("encounter-builder-2024", "bossBudgetSharePercent", {
    scope: "client",
    config: false,
    type: Number,
    default: Math.round(DEFAULT_BOSS_SHARE * 100),
  });
  game.settings.registerMenu("encounter-builder-2024", "scalingConfigMenu", {
    name: "Boss-ify / Minion-ify Values",
    label: "Configure Values",
    hint: "Edit the HP/damage percentages and AC/ability bonuses used by Boss-ify's tiers, the XP discount Minion-ify applies, and how much of the budget Boss Encounter mode reserves for the boss.",
    icon: "fa-solid fa-sliders",
    type: ScalingSettingsApp,
    restricted: true,
  });
});

// Adds a button to the Combat sidebar tab, next to the existing controls.
Hooks.on("renderCombatTracker", (app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || root.querySelector(".encounter-builder-2024-launch")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("encounter-builder-2024-launch");
  button.innerHTML = '<i class="fa-solid fa-dragon"></i> Encounter Builder';
  button.addEventListener("click", () => openEncounterBuilder());

  const header = root.querySelector(".directory-header, .directory-footer") ?? root;
  header.appendChild(button);
});

// Also expose as a global for macro users: game.modules.get(...).api.open()
Hooks.once("ready", () => {
  const mod = game.modules.get("encounter-builder-2024");
  if (mod) mod.api = { open: openEncounterBuilder };
});

Hooks.on("dropCanvasData", (canvas, data, event) => {
  // Foundry core's Canvas#_onDrop has no case for type "Item" (only Actor,
  // JournalEntry(Page), Macro, PlaylistSound, Tile) — dropping an Item on
  // the canvas (e.g. dragging one from our Loot tab) silently does nothing
  // unless a module like Item Piles registers its own dropCanvasData handler
  // for it. We don't implement a fallback pile ourselves; just tell the GM
  // why nothing happened instead of leaving it a silent no-op.
  if (data.type === "Item") {
    if (game.modules.get("item-piles")?.active) return;
    ui.notifications.warn(
      "Dropping items onto the canvas requires the Item Piles module — install and enable it to place loose items as pickups."
    );
    return;
  }

  // Only monsters dragged from our own Encounter tab list carry this marker
  // (set in encounter-builder-app.js's dragstart listener) — Actor drags
  // from anywhere else (Foundry's own compendium browser sidebar, etc.)
  // fall through untouched to Foundry's default handling below.
  if (data.type === "Actor" && data.encounterBuilder2024) {
    dropEncounterBuilderMonster(data, event);
    // Tells Canvas#_onDrop (client/canvas/board.mjs) not to also run its
    // own Actor case (TokenLayer#_onDropActorData) — otherwise we'd get
    // two tokens, one from us and one from Foundry's default import-a-
    // fresh-duplicate-Actor behavior.
    return false;
  }
});

/**
 * Creates (or reuses) a world Actor for a monster dragged from the
 * Encounter tab's list and drops a Token for it at the cursor position.
 *
 * Foundry's own TokenLayer#_onDropActorData (client/canvas/layers/
 * tokens.mjs) imports a brand-new, unfoldered world Actor from the
 * compendium on EVERY drop — no reuse, no folder. That's fine for a one-off
 * drag from the sidebar, but our own list already has a better convention
 * (used by the Encounter tab's "Create Combat" button): file world Actors
 * into a shared "Encounter Builder" folder, and tag them with an
 * `encounter-builder-2024.sourceUuid` flag so re-dropping the same monster
 * reuses the existing Actor instead of piling up duplicates. This mirrors
 * that exact lookup/creation logic for the canvas-drag path.
 */
async function dropEncounterBuilderMonster(data, event) {
  if (!game.user.can("TOKEN_CREATE")) {
    ui.notifications.warn("You do not have permission to create new Tokens!");
    return;
  }
  if (!canvas.dimensions.rect.contains(data.x, data.y)) return;

  let worldActor = game.actors.find(
    (a) =>
      a.getFlag("encounter-builder-2024", "sourceUuid") === data.uuid &&
      !a.getFlag("encounter-builder-2024", "bossifySnapshot") &&
      !a.getFlag("encounter-builder-2024", "minionifySnapshot")
  );

  if (!worldActor) {
    const sourceActor = await loadFullActor(data.uuid);
    if (!sourceActor) {
      ui.notifications.warn("Could not load that monster.");
      return;
    }
    const folder =
      game.folders.find((f) => f.type === "Actor" && f.name === "Encounter Builder") ??
      (await Folder.create({ name: "Encounter Builder", type: "Actor" }));
    const actorData = sourceActor.toObject();
    actorData.folder = folder.id;
    worldActor = await Actor.create(actorData);
    await worldActor.setFlag("encounter-builder-2024", "sourceUuid", data.uuid);
  }

  const token = await worldActor.getTokenDocument({}, { parent: canvas.scene });
  const gridSize = canvas.scene.grid.size;
  let x = data.x - ((token.width ?? 1) * gridSize) / 2;
  let y = data.y - ((token.height ?? 1) * gridSize) / 2;
  if (!event.shiftKey) {
    const snapped = canvas.grid.getSnappedPoint({ x, y }, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX });
    x = snapped.x;
    y = snapped.y;
  }
  token.updateSource({ x, y, hidden: game.user.isGM && event.altKey });

  canvas.tokens.activate();
  return canvas.scene.createEmbeddedDocuments("Token", [token.toObject()]);
}
