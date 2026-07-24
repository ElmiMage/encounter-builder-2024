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
