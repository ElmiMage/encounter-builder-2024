import { EncounterBuilderApp } from "./encounter-builder-app.js";

let appInstance = null;

function openEncounterBuilder() {
  if (!appInstance) appInstance = new EncounterBuilderApp();
  appInstance.render(true);
}

Hooks.once("init", () => {
  console.log("Encounter Builder (2024 Rules) | Initializing");
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
