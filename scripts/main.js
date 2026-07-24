import { EncounterBuilderApp } from "./encounter-builder-app.js";
import { humanizeToken } from "./format.js";

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
