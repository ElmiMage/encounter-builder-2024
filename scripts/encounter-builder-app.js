import { computeBudget, evaluateSpend, xpForChallengeRating } from "./xp-budget.js";
import { listMonsterCompendiums, loadMonsterIndex, loadFullActor, getAvailableCreatureTypes, getAvailableSubtypes, getAvailableSizes, getAvailableHabitats } from "./compendium-browser.js";
import { groupPacksBySource } from "./pack-grouping.js";
import { computeSpiralPositions, clampToSceneBounds } from "./token-placement.js";
import { autoFillEncounter, autoFillBossEncounter } from "./auto-fill.js";
import { pickCanvasPoint } from "./canvas-picker.js";
import { createLootActor, suggestLootPlan, suggestSmoothedLootPlan, rerollMagicItems, listItemCompendiums, loadItemIndex, getAvailableRarities, RARITY_TIERS } from "./loot-generator.js";
import { rollIndividualTreasureForEncounter } from "./individual-treasure-tables.js";
import { humanizeToken } from "./format.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class EncounterBuilderApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "encounter-builder-2024",
    tag: "form",
    window: {
      title: "Encounter Builder (2024 Rules)",
      icon: "fa-solid fa-dragon",
      resizable: true,
    },
    position: { width: 960, height: 780 },
    actions: {
      syncParty: EncounterBuilderApp.#onSyncParty,
      toggleCompendium: EncounterBuilderApp.#onToggleCompendium,
      toggleCompendiumGroup: EncounterBuilderApp.#onToggleCompendiumGroup,
      addMonster: EncounterBuilderApp.#onAddMonster,
      viewMonster: EncounterBuilderApp.#onViewMonster,
      removeMonster: EncounterBuilderApp.#onRemoveMonster,
      deleteMonster: EncounterBuilderApp.#onDeleteMonster,
      toggleLair: EncounterBuilderApp.#onToggleLair,
      createCombat: EncounterBuilderApp.#onCreateCombat,
      autoFill: EncounterBuilderApp.#onAutoFill,
      reset: EncounterBuilderApp.#onReset,
      generateLoot: EncounterBuilderApp.#onGenerateLoot,
      switchTab: EncounterBuilderApp.#onSwitchTab,
      rollLoot: EncounterBuilderApp.#onRollLoot,
      rerollLoot: EncounterBuilderApp.#onRerollLoot,
      rollIndividualTreasure: EncounterBuilderApp.#onRollIndividualTreasure,
      toggleLootCompendium: EncounterBuilderApp.#onToggleLootCompendium,
      toggleLootGroup: EncounterBuilderApp.#onToggleLootGroup,
      addLootItem: EncounterBuilderApp.#onAddLootItem,
      removeLootItem: EncounterBuilderApp.#onRemoveLootItem,
      deleteLootItem: EncounterBuilderApp.#onDeleteLootItem,
      viewLootItem: EncounterBuilderApp.#onViewLootItem,
    },
  };

  static PARTS = {
    form: { template: "modules/encounter-builder-2024/templates/encounter-builder.hbs" },
  };

  /** @type {{collection:string,label:string,total:number,enabled:boolean}[]} */
  compendiums = [];
  /** @type {object[]} full monster index across enabled compendiums */
  monsterIndex = [];
  /** @type {Map<string, {monster:object, count:number}>} keyed by uuid */
  encounter = new Map();

  partyLevel = 4;
  partySize = 4;
  // Tracks whether we've already auto-pulled Party Level/Size from
  // Foundry's own designated Party actor (dnd5e's game.actors.party) for
  // this "session" of the app being open — a one-time default on open,
  // not re-applied every render, so manual edits during a session aren't
  // silently overwritten. Reset on close so reopening re-syncs.
  #partyAutoSynced = false;
  difficulty = "moderate";
  searchTerm = "";
  desiredCount = 4;
  creatureTypeFilter = "any";
  crFilter = "any";
  sizeFilter = "any";
  subtypeFilter = "any";
  habitatFilter = "any";
  bossMode = false;
  autoFillWarning = null;

  // Persists <details> open/closed state across re-renders — a full
  // render replaces the DOM from scratch, which would otherwise reset
  // every collapsible section back to closed on every single click.
  compendiumTreeOpen = false;
  openGroups = new Set();
  lootCompendiumTreeOpen = false;
  openLootGroups = new Set();

  activeTab = "encounter";
  /** @type {object|null} shape from suggestLootPlan(), edited in place by the UI */
  lootPlan = null;
  // "auto" = follow Party Level via the RAW tier tables (current/default
  // behavior); a string "1".."20" = homebrew smoothed per-level table
  // (see smoothed-loot-tables.js), overriding Party Level for the Hoard
  // tab only.
  hoardLootBasis = "auto";
  /** @type {object[]} lazy-loaded index of all items across all Item compendiums */
  lootItemIndex = [];
  /** @type {{collection:string,label:string,total:number,enabled:boolean}[]} */
  lootCompendiums = [];
  // Search/rarity filter for the item browser is kept separate per tab —
  // otherwise typing in one tab's search box would still be applied after
  // switching to the other tab, which reads as "connected" fields.
  hoardSearchTerm = "";
  hoardRarityFilter = "any";
  individualSearchTerm = "";
  individualRarityFilter = "any";

  /** @type {{coins:{cp:number,sp:number,ep:number,gp:number,pp:number}, rolledCount:number}|null} last Individual Treasure roll for the "loot" tab */
  individualTreasureResult = null;

  /** Formats a numeric CR the way D&D usually displays it (fractions below 1). */
  #formatCR(cr) {
    if (cr === 0.125) return "1/8";
    if (cr === 0.25) return "1/4";
    if (cr === 0.5) return "1/2";
    return String(cr);
  }

  /** Checks the 5 dropdown-based filters, optionally skipping one — used to compute cascading dropdown options (e.g. Subtype should only list values that still exist given the current Type/Size/CR/Habitat selection). */
  #matchesSelectFilters(m, excludeKey) {
    const checks = {
      type: () => this.creatureTypeFilter === "any" || m.creatureType === this.creatureTypeFilter,
      cr: () => this.crFilter === "any" || m.cr === Number(this.crFilter),
      size: () => this.sizeFilter === "any" || m.size === this.sizeFilter,
      subtype: () => this.subtypeFilter === "any" || m.subtype === this.subtypeFilter,
      habitat: () => this.habitatFilter === "any" || m.habitats.includes(this.habitatFilter),
    };
    return Object.entries(checks).every(([key, fn]) => key === excludeKey || fn());
  }

  /** Monsters matching every dropdown filter except `excludeKey` — the basis for that dropdown's own option list. */
  #getMonstersExcluding(excludeKey) {
    return this.monsterIndex.filter((m) => this.#matchesSelectFilters(m, excludeKey));
  }

  #getFilteredMonsters() {
    return this.monsterIndex.filter((m) => {
      const matchesSearch = m.name.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesSearch && this.#matchesSelectFilters(m, null);
    });
  }

  #getHighestCr() {
    return Math.max(0, ...[...this.encounter.values()].map((e) => e.monster.cr ?? 0));
  }

  /**
   * XP to use for budget-spending purposes for one encounter entry — the
   * monster's normal XP, or the CR+1 value if the GM has marked it as
   * fighting in its own lair (only meaningful for monsters that actually
   * have lair actions per hasLairActions). Matches the 2024/2025 Monster
   * Manual's own fix for a 2014-MM oversight, where lair-fighting
   * monsters didn't get any XP bump at all — verified against the dnd5e
   * system source (system.resources.lair.value/.inside), which computes
   * the same CR+1 adjustment internally on a fully-loaded Actor.
   */
  #getEffectiveXp(entry) {
    if (entry.inLair && entry.monster.hasLairActions && entry.monster.cr != null) {
      return xpForChallengeRating(entry.monster.cr + 1) ?? entry.monster.xp ?? 0;
    }
    return entry.monster.xp ?? 0;
  }

  /** Item search/rarity filter state is kept separate per tab (hoardSearchTerm/hoardRarityFilter vs individualSearchTerm/individualRarityFilter) so typing in one tab's search box doesn't leak into the other's — this reads whichever pair belongs to the currently active tab. */
  #getFilteredLootItems() {
    const searchTerm = this.activeTab === "loot" ? this.individualSearchTerm : this.hoardSearchTerm;
    const rarityFilter = this.activeTab === "loot" ? this.individualRarityFilter : this.hoardRarityFilter;
    return this.lootItemIndex.filter((i) => {
      const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRarity = rarityFilter === "any" || i.rarity === rarityFilter;
      return matchesSearch && matchesRarity;
    });
  }

  /** Escapes text inserted via innerHTML, since monster names/sources come from compendium data we don't fully control (homebrew, etc.). */
  #escapeHtml(text) {
    return String(text ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /** Builds the monster-list <li> markup directly, mirroring the Handlebars template, so the search handler can patch just this list without a full app re-render. */
  #buildMonsterListHtml(monsters) {
    return monsters
      .map(
        (m) => `
        <li class="monster-entry" data-action="viewMonster" data-uuid="${this.#escapeHtml(m.uuid)}" title="Click to view stat block">
          <img src="${this.#escapeHtml(m.img)}" width="24" height="24" />
          <span class="monster-name" title="${this.#escapeHtml(m.name)}">${this.#escapeHtml(m.name)}</span>
          <span class="monster-cr">CR ${this.#escapeHtml(m.cr)}</span>
          <span class="monster-xp">${m.xp ? this.#escapeHtml(m.xp) : "?"} XP</span>
          <span class="monster-source">${this.#escapeHtml(m.sourceLabel)}</span>
          <button type="button" class="add-item-btn square-btn" data-action="addMonster" data-uuid="${this.#escapeHtml(m.uuid)}" title="Add to encounter">+</button>
        </li>`
      )
      .join("");
  }

  /** Builds the loot-item-list <li> markup directly, mirroring the monster list's search-patch pattern. */
  #buildLootItemListHtml(items) {
    return items
      .map(
        (i) => `
        <li class="loot-item-entry" data-action="viewLootItem" data-uuid="${this.#escapeHtml(i.uuid)}" title="Click to view description">
          <img src="${this.#escapeHtml(i.img)}" width="24" height="24" />
          <span class="monster-name" title="${this.#escapeHtml(i.name)}">${this.#escapeHtml(i.name)}</span>
          <span class="monster-cr">${this.#escapeHtml(humanizeToken(i.rarity))}</span>
          <span class="monster-source">${this.#escapeHtml(i.sourceLabel)}</span>
          <button type="button" class="add-item-btn square-btn" data-action="addLootItem" data-uuid="${this.#escapeHtml(i.uuid)}" title="Add to plan">+</button>
        </li>`
      )
      .join("");
  }

  /**
   * Reads Foundry's own designated Party actor (dnd5e's Group/Party
   * feature — game.actors.party) and, if one is set with at least one
   * character in it, uses its average character level and character
   * count as Party Level/Size. Silent on first-open auto-sync (no need
   * to nag if the GM hasn't set up a Party actor); vocal when triggered
   * explicitly via the "Sync from Party" button, so a no-op has visible
   * feedback instead of looking like the button did nothing.
   */
  #syncFromPartyActor({ silent = false } = {}) {
    const party = game.actors.party;
    if (!party) {
      if (!silent) ui.notifications.warn("No Party actor is set in this world — open a Group actor's sheet and mark it as your Party first.");
      return;
    }
    const pcs = party.system.playerCharacters ?? [];
    if (pcs.length === 0) {
      if (!silent) ui.notifications.warn(`Your Party actor ("${party.name}") has no player characters in it yet.`);
      return;
    }
    this.partyLevel = party.system.level;
    this.partySize = pcs.length;
    if (!silent) ui.notifications.info(`Synced from Party "${party.name}": level ${this.partyLevel}, ${this.partySize} character(s).`);
  }

  async _prepareContext() {
    if (!this.#partyAutoSynced) {
      this.#partyAutoSynced = true;
      this.#syncFromPartyActor({ silent: true });
    }
    if (this.compendiums.length === 0) {
      const disabled = new Set(game.settings.get("encounter-builder-2024", "disabledMonsterCompendiums"));
      this.compendiums = (await listMonsterCompendiums()).map((c) => ({ ...c, enabled: !disabled.has(c.collection) }));
      await this.#refreshMonsterIndex();
    }
    if ((this.activeTab === "hoard" || this.activeTab === "loot") && this.lootCompendiums.length === 0) {
      const disabled = new Set(game.settings.get("encounter-builder-2024", "disabledLootCompendiums"));
      this.lootCompendiums = (await listItemCompendiums()).map((c) => ({ ...c, enabled: !disabled.has(c.collection) }));
      await this.#refreshLootItemIndex();
    }

    const budget = computeBudget(this.partyLevel, this.partySize, this.difficulty);
    const selectedXp = [...this.encounter.values()].flatMap((e) =>
      Array(e.count).fill(this.#getEffectiveXp(e))
    );
    const spend = evaluateSpend(budget, selectedXp);

    const creatureTypes = getAvailableCreatureTypes(this.#getMonstersExcluding("type"));
    const availableCrs = [...new Set(this.#getMonstersExcluding("cr").map((m) => m.cr))]
      .sort((a, b) => a - b)
      .map((cr) => ({ value: String(cr), label: this.#formatCR(cr) }));
    const availableSizes = getAvailableSizes(this.#getMonstersExcluding("size"));
    const availableSubtypes = getAvailableSubtypes(this.#getMonstersExcluding("subtype"));
    const availableHabitats = getAvailableHabitats(this.#getMonstersExcluding("habitat"));
    const filtered = this.#getFilteredMonsters();

    const availableLootRarities = getAvailableRarities(this.lootItemIndex);
    const filteredLootItems = this.#getFilteredLootItems();
    const rarityRows = RARITY_TIERS.map((rarity) => ({
      rarity,
      count: this.lootPlan?.rarityCounts?.[rarity] ?? 0,
    }));

    return {
      levelOptions: Array.from({ length: 20 }, (_, i) => i + 1),
      sizeOptions: Array.from({ length: 10 }, (_, i) => i + 1),
      desiredCountOptions: Array.from({ length: 10 }, (_, i) => i + 1),
      activeTab: this.activeTab,
      lootCompendiums: this.lootCompendiums,
      groupedLootCompendiums: groupPacksBySource(this.lootCompendiums).map((g) => ({
        ...g,
        isOpen: this.openLootGroups.has(g.groupKey),
      })),
      lootCompendiumTreeOpen: this.lootCompendiumTreeOpen,
      highestCr: this.#getHighestCr(),
      lootTierBasis: this.partyLevel,
      hoardLootBasis: this.hoardLootBasis,
      lootLevelOptions: Array.from({ length: 20 }, (_, i) => String(i + 1)),
      lootPlan: this.lootPlan,
      // Fallbacks so the Hoard tab's search/coins/gems/items UI can render
      // (and be edited) even before the GM has rolled anything, mirroring
      // the Loot tab's individualTreasure* fallbacks.
      lootPlanCoins: this.lootPlan?.coins ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      lootPlanGemsOrArt: this.lootPlan?.gemsOrArt ?? { type: "none", count: 0, unitValue: 0 },
      lootPlanItems: this.lootPlan?.items ?? [],
      rarityRows,
      lootItems: filteredLootItems,
      hoardSearchTerm: this.hoardSearchTerm,
      hoardRarityFilter: this.hoardRarityFilter,
      individualSearchTerm: this.individualSearchTerm,
      individualRarityFilter: this.individualRarityFilter,
      availableLootRarities,
      individualTreasureResult: this.individualTreasureResult,
      individualTreasureCreatureCount: [...this.encounter.values()].reduce((sum, e) => sum + e.count, 0),
      // Fallbacks so the Loot tab's search/coins/items UI can render (and
      // items can be added) even before the GM has rolled anything.
      individualTreasureCoins: this.individualTreasureResult?.coins ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      individualTreasureItems: this.individualTreasureResult?.items ?? [],
      individualTreasureRolledCount: this.individualTreasureResult?.rolledCount ?? 0,
      partyLevel: this.partyLevel,
      partySize: this.partySize,
      difficulty: this.difficulty,
      searchTerm: this.searchTerm,
      desiredCount: this.desiredCount,
      creatureTypeFilter: this.creatureTypeFilter,
      creatureTypes,
      crFilter: this.crFilter,
      availableCrs,
      sizeFilter: this.sizeFilter,
      availableSizes,
      subtypeFilter: this.subtypeFilter,
      availableSubtypes,
      habitatFilter: this.habitatFilter,
      availableHabitats,
      bossMode: this.bossMode,
      autoFillWarning: this.autoFillWarning,
      compendiums: this.compendiums,
      groupedCompendiums: groupPacksBySource(this.compendiums).map((g) => ({
        ...g,
        isOpen: this.openGroups.has(g.groupKey),
      })),
      compendiumTreeOpen: this.compendiumTreeOpen,
      monsters: filtered,
      encounterEntries: [...this.encounter.values()].map((e) => ({ ...e, effectiveXp: this.#getEffectiveXp(e) })),
      budget,
      spend,
      // For the progress bar: clamp visually at 100% even if over budget
      spendPercentClamped: Math.min(100, Math.round(spend.percentUsed * 100)),
    };
  }

  async #refreshMonsterIndex() {
    const enabledIds = this.compendiums.filter((c) => c.enabled).map((c) => c.collection);
    this.monsterIndex = await loadMonsterIndex(enabledIds);
  }

  #getEnabledLootCollections() {
    return this.lootCompendiums.filter((c) => c.enabled).map((c) => c.collection);
  }

  async #refreshLootItemIndex() {
    this.lootItemIndex = await loadItemIndex(this.#getEnabledLootCollections());
  }

  /** Persists which monster compendiums are currently OFF, so the choice survives reloading Foundry instead of resetting to "everything enabled" every time. */
  #persistCompendiumSelection() {
    const disabled = this.compendiums.filter((c) => !c.enabled).map((c) => c.collection);
    game.settings.set("encounter-builder-2024", "disabledMonsterCompendiums", disabled);
  }

  /** Same as #persistCompendiumSelection, for the Loot tab's item compendiums. */
  #persistLootCompendiumSelection() {
    const disabled = this.lootCompendiums.filter((c) => !c.enabled).map((c) => c.collection);
    game.settings.set("encounter-builder-2024", "disabledLootCompendiums", disabled);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Best-effort fix for Foundry's global Tab hotkey (likely bound to
    // "cycle controlled token") intercepting Tab before it reaches normal
    // browser form navigation. Capturing at the form root — rather than
    // on the individual fields — gives this the best chance of running
    // before a document/window-level listener, though if Foundry's
    // handler is itself registered with capture:true on document/window,
    // no module-side JS can fully preempt it; if Tab still misbehaves,
    // Enter (handled below) is a guaranteed-working alternative, or the
    // hotkey can be unbound in Foundry's own Settings > Configure Controls.
    const tabOrder = ["partyLevel", "partySize", "difficulty", "desiredCount", "creatureTypeFilter"];
    const advanceFocus = (currentName) => {
      const idx = tabOrder.indexOf(currentName);
      const next = tabOrder[idx + 1];
      if (next) this.element.querySelector(`[name="${next}"]`)?.focus();
    };

    this.element.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key !== "Tab" && ev.key !== "Enter") return;
        const name = ev.target?.name;
        if (!tabOrder.includes(name)) return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        advanceFocus(name);
      },
      { capture: true }
    );

    // NOTE: no special handling needed for the group checkbox living
    // inside a <summary> — modern Chromium (which Foundry runs on)
    // already excludes clicks on interactive descendants (inputs,
    // buttons, links) from triggering the parent <details> toggle, so
    // adding our own stopPropagation/preventDefault here previously
    // ended up blocking Foundry's own action-click handling instead,
    // silently breaking data-action="toggleCompendiumGroup" entirely.

    // Persist <details> open/closed state across re-renders — otherwise
    // every checkbox click (which triggers a full render) would snap
    // every tree/group back to closed, since the template has no memory
    // of what the user had manually expanded.
    const encounterTree = this.element.querySelector('.compendium-tree[data-tree="encounter"]');
    encounterTree?.addEventListener("toggle", () => { this.compendiumTreeOpen = encounterTree.open; });
    const lootTree = this.element.querySelector('.compendium-tree[data-tree="loot"]');
    lootTree?.addEventListener("toggle", () => { this.lootCompendiumTreeOpen = lootTree.open; });

    for (const groupEl of this.element.querySelectorAll(".compendium-group")) {
      const key = groupEl.dataset.group;
      const isLootGroup = !!lootTree?.contains(groupEl);
      const store = isLootGroup ? this.openLootGroups : this.openGroups;
      groupEl.addEventListener("toggle", () => {
        if (groupEl.open) store.add(key);
        else store.delete(key);
      });

      // Sets the native indeterminate DOM property (can't be done via
      // template/attribute) — the actual VISIBLE "mixed" styling comes
      // from the mixed-state class rendered directly in the template
      // (more reliable than matching elements up after the fact here).
      const groupData = [...(context.groupedCompendiums ?? []), ...(context.groupedLootCompendiums ?? [])].find(
        (g) => g.groupKey === key
      );
      const checkbox = groupEl.querySelector(':scope > summary input[type="checkbox"]');
      if (groupData && checkbox) {
        checkbox.indeterminate = groupData.mixed;
      }
    }

    this.element.querySelector('[name="partyLevel"]')?.addEventListener("change", (ev) => {
      this.partyLevel = Number(ev.target.value) || 1;
      this.render();
    });
    this.element.querySelector('[name="partySize"]')?.addEventListener("change", (ev) => {
      this.partySize = Number(ev.target.value) || 1;
      this.render();
    });
    this.element.querySelector('[name="difficulty"]')?.addEventListener("change", (ev) => {
      this.difficulty = ev.target.value;
      this.render();
    });
    this.element.querySelector('[name="searchTerm"]')?.addEventListener("input", (ev) => {
      // Deliberately does NOT call this.render() — a full re-render replaces
      // the input element itself, which resets focus and cursor position
      // after every keystroke. Instead, only the monster list markup is
      // patched directly, leaving the input (and the user's typing) alone.
      this.searchTerm = ev.target.value;
      const listEl = this.element.querySelector(".monster-list");
      if (listEl) listEl.innerHTML = this.#buildMonsterListHtml(this.#getFilteredMonsters());
    });
    this.element.querySelector('[name="desiredCount"]')?.addEventListener("change", (ev) => {
      this.desiredCount = Number(ev.target.value) || 1;
      this.render();
    });
    this.element.querySelector('[name="bossMode"]')?.addEventListener("change", (ev) => {
      this.bossMode = ev.target.checked;
    });
    this.element.querySelector('[name="creatureTypeFilter"]')?.addEventListener("change", (ev) => {
      this.creatureTypeFilter = ev.target.value;
      this.render();
    });
    this.element.querySelector('[name="crFilter"]')?.addEventListener("change", (ev) => {
      this.crFilter = ev.target.value;
      this.render();
    });
    this.element.querySelector('[name="sizeFilter"]')?.addEventListener("change", (ev) => {
      this.sizeFilter = ev.target.value;
      this.render();
    });
    this.element.querySelector('[name="subtypeFilter"]')?.addEventListener("change", (ev) => {
      this.subtypeFilter = ev.target.value;
      this.render();
    });
    this.element.querySelector('[name="habitatFilter"]')?.addEventListener("change", (ev) => {
      this.habitatFilter = ev.target.value;
      this.render();
    });

    // --- Loot tab ---
    for (const el of this.element.querySelectorAll(".eb-tab-button")) {
      el.classList.toggle("active", el.dataset.tab === this.activeTab);
    }

    // Same reasoning as the monster search field: patch the list directly
    // instead of this.render(), so typing doesn't lose focus. Hoard and
    // Loot tab each have their own search/rarity fields (see
    // hoardSearchTerm/individualSearchTerm etc.) so only one pair ever
    // matches an element in the DOM at a time.
    this.element.querySelector('[name="hoardSearchTerm"]')?.addEventListener("input", (ev) => {
      this.hoardSearchTerm = ev.target.value;
      const listEl = this.element.querySelector(".loot-item-list");
      if (listEl) listEl.innerHTML = this.#buildLootItemListHtml(this.#getFilteredLootItems());
    });
    this.element.querySelector('[name="hoardRarityFilter"]')?.addEventListener("change", (ev) => {
      this.hoardRarityFilter = ev.target.value;
      const listEl = this.element.querySelector(".loot-item-list");
      if (listEl) listEl.innerHTML = this.#buildLootItemListHtml(this.#getFilteredLootItems());
    });
    // Only updates state — takes effect on the next "Roll Suggested
    // Loot" / auto-roll, rather than immediately discarding whatever
    // plan (and any manually-added items) is already on screen.
    this.element.querySelector('[name="hoardLootBasis"]')?.addEventListener("change", (ev) => {
      this.hoardLootBasis = ev.target.value;
    });
    this.element.querySelector('[name="individualSearchTerm"]')?.addEventListener("input", (ev) => {
      this.individualSearchTerm = ev.target.value;
      const listEl = this.element.querySelector(".loot-item-list");
      if (listEl) listEl.innerHTML = this.#buildLootItemListHtml(this.#getFilteredLootItems());
    });
    this.element.querySelector('[name="individualRarityFilter"]')?.addEventListener("change", (ev) => {
      this.individualRarityFilter = ev.target.value;
      const listEl = this.element.querySelector(".loot-item-list");
      if (listEl) listEl.innerHTML = this.#buildLootItemListHtml(this.#getFilteredLootItems());
    });

    for (const coin of ["cp", "sp", "ep", "gp", "pp"]) {
      this.element.querySelector(`[name="lootCoin-${coin}"]`)?.addEventListener("change", (ev) => {
        this.#ensureLootPlan().coins[coin] = Math.max(0, Number(ev.target.value) || 0);
      });
      this.element.querySelector(`[name="individualCoin-${coin}"]`)?.addEventListener("change", (ev) => {
        this.#ensureIndividualTreasureResult().coins[coin] = Math.max(0, Number(ev.target.value) || 0);
      });
    }
    this.element.querySelector('[name="lootGemsArtCount"]')?.addEventListener("change", (ev) => {
      const plan = this.#ensureLootPlan();
      plan.gemsOrArt.count = Math.max(0, Number(ev.target.value) || 0);
      // Type is always "gems" now (Art Objects removed for simplicity) —
      // set it here too in case a plan was built before this change and
      // still carries an old "art"/"none" value.
      plan.gemsOrArt.type = "gems";
    });
    this.element.querySelector('[name="lootGemsArtValue"]')?.addEventListener("change", (ev) => {
      const plan = this.#ensureLootPlan();
      plan.gemsOrArt.unitValue = Math.max(0, Number(ev.target.value) || 0);
      plan.gemsOrArt.type = "gems";
    });
    for (const rarity of RARITY_TIERS) {
      this.element.querySelector(`[name="lootRarity-${rarity}"]`)?.addEventListener("change", (ev) => {
        this.#ensureLootPlan().rarityCounts[rarity] = Math.max(0, Number(ev.target.value) || 0);
      });
    }

    if (this._pendingScrollRestore) {
      const { selector, top } = this._pendingScrollRestore;
      const el = this.element.querySelector(selector);
      if (el) el.scrollTop = top;
      this._pendingScrollRestore = null;
    }
  }

  static #onSyncParty(event, target) {
    this.#syncFromPartyActor({ silent: false });
    this.render();
  }

  static async #onToggleCompendium(event, target) {
    const collection = target.dataset.collection;
    const entry = this.compendiums.find((c) => c.collection === collection);
    if (entry) entry.enabled = !entry.enabled;
    this.#persistCompendiumSelection();
    await this.#refreshMonsterIndex();
    this.render();
  }

  /** Toggles every pack within one source group (module/system/world) at once. */
  /**
   * Cascades EXACTLY the checkbox's new checked state to every pack in
   * the group — deliberately not "toggle relative to previous state",
   * since from a mixed (some-on/some-off) state that produced
   * unpredictable results (e.g. unchecking while mixed could flip
   * everything ON instead of OFF). Reading target.checked directly
   * means "uncheck the group" always means "every child goes off",
   * full stop, regardless of whatever mixed state it started from.
   */
  static async #onToggleCompendiumGroup(event, target) {
    const groupKey = target.dataset.group;
    const groupPacks = this.compendiums.filter((c) => c.groupKey === groupKey);
    for (const pack of groupPacks) pack.enabled = target.checked;
    this.#persistCompendiumSelection();
    await this.#refreshMonsterIndex();
    this.render();
  }

  /** Opens the monster's own sheet (stat block) so the GM can preview it before deciding whether to add it — read-only for locked compendium items, same as opening any other compendium document in Foundry. */
  static async #onViewMonster(event, target) {
    const monster = await fromUuid(target.dataset.uuid);
    if (!monster) {
      ui.notifications.warn("Could not load that monster.");
      return;
    }
    monster.sheet.render(true);
  }

  static #onAddMonster(event, target) {
    const uuid = target.dataset.uuid;
    const monster = this.monsterIndex.find((m) => m.uuid === uuid);
    if (!monster) return;
    this.#captureScroll(".encounter-list");
    const existing = this.encounter.get(uuid);
    if (existing) existing.count += 1;
    else this.encounter.set(uuid, { monster, count: 1, inLair: false });
    this.render();
  }

  static #onRemoveMonster(event, target) {
    const uuid = target.dataset.uuid;
    const existing = this.encounter.get(uuid);
    if (!existing) return;
    this.#captureScroll(".encounter-list");
    existing.count -= 1;
    if (existing.count <= 0) this.encounter.delete(uuid);
    this.render();
  }

  /** Removes a monster entry entirely, regardless of its current count. */
  static #onDeleteMonster(event, target) {
    this.#captureScroll(".encounter-list");
    this.encounter.delete(target.dataset.uuid);
    this.render();
  }

  /** Marks/unmarks an encounter entry as fighting in its own lair — only shown for monsters with hasLairActions, adjusts XP-budget spending via #getEffectiveXp. */
  static #onToggleLair(event, target) {
    const entry = this.encounter.get(target.dataset.uuid);
    if (!entry) return;
    entry.inLair = target.checked;
    this.render();
  }

  /**
   * Fills the REMAINING budget and slot count with auto-selected
   * monsters, without touching what's already been picked manually or
   * from a previous Auto-Fill click. Repeated clicks keep adding on top
   * of the current selection instead of starting over.
   *
   * Draws only from the same monster list currently shown in the browser
   * (search term + every dropdown filter: type, CR, size, subtype,
   * habitat) — so what the GM sees filtered on screen is exactly what
   * Auto-Fill is allowed to pick from, not the whole enabled compendium set.
   */
  static #onAutoFill(event, target) {
    const budget = computeBudget(this.partyLevel, this.partySize, this.difficulty);
    const currentEntries = [...this.encounter.values()];
    const alreadySpent = currentEntries.reduce((sum, e) => sum + (e.monster.xp ?? 0) * e.count, 0);
    const alreadyCount = currentEntries.reduce((sum, e) => sum + e.count, 0);
    const remainingSlots = this.desiredCount - alreadyCount;

    if (remainingSlots <= 0) {
      this.autoFillWarning = `Already at ${alreadyCount} creature(s), which meets or exceeds the desired count of ${this.desiredCount}. Raise the count or remove some monsters first.`;
      this.render();
      return;
    }

    const pool = this.#getFilteredMonsters();

    const result = this.bossMode
      ? autoFillBossEncounter(budget - alreadySpent, remainingSlots, pool, null)
      : autoFillEncounter(budget - alreadySpent, remainingSlots, pool, null);
    for (const entry of result.entries) {
      const existing = this.encounter.get(entry.monster.uuid);
      if (existing) existing.count += entry.count;
      else this.encounter.set(entry.monster.uuid, entry);
    }
    this.autoFillWarning = result.warning;
    this.render();
  }

  /**
   * Clears the current encounter selection only — party config, compendium
   * selection, and filters are kept, since those usually stay the same
   * across multiple encounters in one session. Deliberately leaves
   * lootPlan/individualTreasureResult alone, same as the Hoard tab
   * already did — the coin totals may end up rolled against a now-cleared
   * encounter, but clearing them automatically would also wipe out any
   * manually-added items, which aren't tied to the encounter at all.
   */
  static #onReset(event, target) {
    this.encounter = new Map();
    this.autoFillWarning = null;
    this.render();
  }

  /** Also reset automatically when the window is closed, so reopening starts clean even if the user forgot to click Reset. */
  async _onClose(options) {
    this.encounter = new Map();
    this.autoFillWarning = null;
    // Re-sync from the Party actor next time the app opens, in case
    // characters leveled up or the party roster changed while it was closed.
    this.#partyAutoSynced = false;
    return super._onClose?.(options);
  }

  /**
   * Imports the selected monsters into the world (reusing a previous
   * import if the same compendium monster was already brought in before,
   * tracked via a flag), places tokens on the canvas in a spiral
   * formation around a point the GM clicks, and creates a Combat
   * encounter from those tokens.
   */
  static async #onCreateCombat(event, target) {
    if (this.encounter.size === 0) {
      ui.notifications.warn("Add at least one monster before creating a combat.");
      return;
    }

    const scene = canvas.scene ?? game.scenes.current;
    if (!scene) {
      ui.notifications.error("No active scene to place tokens on.");
      return;
    }

    const folder =
      game.folders.find((f) => f.type === "Actor" && f.name === "Encounter Builder") ??
      (await Folder.create({ name: "Encounter Builder", type: "Actor" }));

    const gridSize = scene.grid?.size ?? 100;
    const dims = scene.dimensions ?? { width: scene.width, height: scene.height };

    // Minimize the app so the GM can actually see and click the canvas.
    // Falls back gracefully if minimize() isn't available for some reason.
    try { await this.minimize?.(); } catch (err) { console.warn("Encounter Builder | minimize failed", err); }
    const dropPoint = await pickCanvasPoint(scene);
    try { await this.maximize?.(); } catch (err) { console.warn("Encounter Builder | maximize failed", err); }

    // Flatten { monster, count } into one entry per individual creature,
    // so the spiral positions map 1:1 onto tokens.
    const spawnList = [...this.encounter.values()].flatMap(({ monster, count }) =>
      Array(count).fill(monster)
    );

    const positions = clampToSceneBounds(
      computeSpiralPositions(dropPoint.x, dropPoint.y, spawnList.length, gridSize),
      dims.width,
      dims.height
    );

    const tokenData = [];
    const failedMonsters = [];
    for (let i = 0; i < spawnList.length; i++) {
      const monster = spawnList[i];

      // Reuse a previously imported world Actor for this compendium monster
      // if one already exists, instead of duplicating it every encounter.
      let worldActor = game.actors.find(
        (a) => a.getFlag("encounter-builder-2024", "sourceUuid") === monster.uuid
      );
      if (!worldActor) {
        let sourceActor;
        try {
          sourceActor = await loadFullActor(monster.uuid);
        } catch (err) {
          console.warn(`Encounter Builder | failed to load monster "${monster.name}" (${monster.uuid})`, err);
        }
        if (!sourceActor) {
          failedMonsters.push(monster.name);
          continue;
        }
        const data = sourceActor.toObject();
        data.folder = folder.id;
        worldActor = await Actor.create(data);
        await worldActor.setFlag("encounter-builder-2024", "sourceUuid", monster.uuid);
      }

      const proto = worldActor.prototypeToken.toObject();
      const pos = positions[i];
      tokenData.push({
        ...proto,
        actorId: worldActor.id,
        x: pos.x - (proto.width * gridSize) / 2,
        y: pos.y - (proto.height * gridSize) / 2,
        name: spawnList.filter((m) => m === monster).length > 1 ? `${monster.name}` : proto.name,
      });
    }

    if (tokenData.length === 0) {
      ui.notifications.error("Could not load any of the selected monsters.");
      return;
    }

    const createdTokens = await scene.createEmbeddedDocuments("Token", tokenData);

    const combat = await Combat.create({ scene: scene.id });
    await combat.createEmbeddedDocuments(
      "Combatant",
      createdTokens.map((t) => ({ tokenId: t.id, sceneId: scene.id }))
    );

    ui.notifications.info(`Encounter created: ${createdTokens.length} token(s) placed and added to combat.`);
    if (failedMonsters.length > 0) {
      ui.notifications.warn(
        `${failedMonsters.length} monster instance(s) could not be loaded and were skipped: ${[...new Set(failedMonsters)].join(", ")}`
      );
    }
  }

  /**
   * Footer "Generate Loot" button — dispatches based on the active tab,
   * since the two loot tabs produce different Actors from different
   * state (a full Treasure Hoard plan vs. a per-creature Individual
   * Treasure roll).
   */
  static async #onGenerateLoot(event, target) {
    if (this.activeTab === "loot") return EncounterBuilderApp.#generateIndividualTreasureActor.call(this);
    return EncounterBuilderApp.#generateHoardActor.call(this);
  }

  /**
   * Rolls a fresh Hoard suggestion using whichever basis is currently
   * selected — the RAW party-level/tier tables (default), or the
   * homebrew smoothed per-level table if the GM picked a specific level
   * from the "Loot Basis" dropdown. Shared by the explicit "Roll
   * Suggested Loot" button and the auto-roll fallback in
   * #generateHoardActor, so both always agree on which basis to use.
   */
  #rollHoardPlan() {
    if (this.hoardLootBasis === "auto") {
      return suggestLootPlan(this.partyLevel, this.#getEnabledLootCollections());
    }
    return suggestSmoothedLootPlan(Number(this.hoardLootBasis), this.#getEnabledLootCollections());
  }

  /**
   * Generates a treasure hoard based on the party's level (not the
   * monsters' CR — ties loot to what the party can actually use,
   * matching the DMG's per-character budget philosophy elsewhere in
   * this module), and places it as a hidden, non-combat token.
   */
  static async #generateHoardActor() {
    // If the GM never visited the Treasure Hoard tab / never rolled a
    // suggestion, roll one now automatically rather than generating an
    // empty hoard. If a plan already exists (including a manually-built
    // empty one from #ensureLootPlan) it's left as-is — auto-rolling on
    // top of it would silently overwrite whatever the GM already edited.
    if (!this.lootPlan) this.lootPlan = await this.#rollHoardPlan();

    const { coins, gemsOrArt, items } = this.lootPlan;
    const hasCoins = Object.values(coins).some((v) => v > 0);
    const hasGemsOrArt = (gemsOrArt?.count ?? 0) > 0;
    if (!hasCoins && !hasGemsOrArt && items.length === 0) {
      ui.notifications.warn("Nothing to generate — roll Suggested Loot or add at least one item first.");
      return;
    }

    try { await this.minimize?.(); } catch (err) { console.warn("Encounter Builder | minimize failed", err); }
    await createLootActor(this.lootPlan, `Treasure Hoard (CR ${this.partyLevel})`);
    try { await this.maximize?.(); } catch (err) { console.warn("Encounter Builder | maximize failed", err); }

    if (this.lootPlan.confidence === "approximate") {
      ui.notifications.warn(
        `Loot generated using an APPROXIMATE table (tier ${this.lootPlan.tier}) — double-check against your DMG for high-level treasure.`
      );
    } else {
      ui.notifications.info("Loot generated, placed as a hidden token — not added to combat.");
    }
  }

  /**
   * Generates Individual Treasure — one roll per creature currently
   * selected in the Encounter tab, summed into a single purse, plus any
   * items manually added on the Loot tab — and places it as a hidden,
   * non-combat token. Reuses createLootActor with an empty gemsOrArt
   * payload since Individual Treasure never rolls gems/art itself.
   */
  static async #generateIndividualTreasureActor() {
    if (!this.individualTreasureResult) {
      this.individualTreasureResult = { ...EncounterBuilderApp.#rollIndividualTreasure.call(this), items: [] };
    }

    const { coins, rolledCount, items } = this.individualTreasureResult;
    const hasCoins = Object.values(coins).some((v) => v > 0);
    if (!hasCoins && items.length === 0) {
      ui.notifications.warn("Nothing to generate — roll Individual Treasure or add at least one item first.");
      return;
    }

    const actorName = `Loot (${rolledCount} creature${rolledCount === 1 ? "" : "s"})`;

    try { await this.minimize?.(); } catch (err) { console.warn("Encounter Builder | minimize failed", err); }
    await createLootActor({ coins, gemsOrArt: { type: "none", count: 0 }, items }, actorName);
    try { await this.maximize?.(); } catch (err) { console.warn("Encounter Builder | maximize failed", err); }

    ui.notifications.info("Individual treasure generated, placed as a hidden token — not added to combat.");
    this.render();
  }

  static async #onToggleLootCompendium(event, target) {
    const collection = target.dataset.collection;
    const entry = this.lootCompendiums.find((c) => c.collection === collection);
    if (entry) entry.enabled = !entry.enabled;
    this.#persistLootCompendiumSelection();
    await this.#refreshLootItemIndex();
    this.render();
  }

  /** Cascades EXACTLY the checkbox's new checked state to every pack in the group — see #onToggleCompendiumGroup for why. */
  static async #onToggleLootGroup(event, target) {
    const groupKey = target.dataset.group;
    const groupPacks = this.lootCompendiums.filter((c) => c.groupKey === groupKey);
    for (const pack of groupPacks) pack.enabled = target.checked;
    this.#persistLootCompendiumSelection();
    await this.#refreshLootItemIndex();
    this.render();
  }

  static #onSwitchTab(event, target) {
    this.activeTab = target.dataset.tab;
    this.render();
  }

  /** Rolls a fresh starting point (RAW tier, or the homebrew smoothed level table if selected) — coins, gems/art, AND resolved items, all previewed immediately. */
  static async #onRollLoot(event, target) {
    this.lootPlan = await this.#rollHoardPlan();
    this.render();
  }

  /** Re-rolls just the magic items using whatever rarity counts are currently in the boxes, keeping manually-added items untouched. */
  static async #onRerollLoot(event, target) {
    if (!this.lootPlan) {
      ui.notifications.warn('Click "Roll Suggested Loot" first.');
      return;
    }
    this.lootPlan.items = await rerollMagicItems(this.lootPlan, this.#getEnabledLootCollections());
    this.render();
  }

  /** Rolls Individual Treasure once per creature currently selected in the Encounter tab and sums it into one purse — shared by the explicit button below and the auto-roll fallback in #generateIndividualTreasureActor. */
  static #rollIndividualTreasure() {
    const entries = [...this.encounter.values()].map((e) => ({ cr: e.monster.cr ?? 0, count: e.count }));
    return rollIndividualTreasureForEncounter(entries);
  }

  /** Rerolls just the coin total — any manually-added items are kept, mirroring how Reroll Magic Items on the Hoard tab leaves manual items untouched. */
  static #onRollIndividualTreasure(event, target) {
    const existingItems = this.individualTreasureResult?.items ?? [];
    const rolled = EncounterBuilderApp.#rollIndividualTreasure.call(this);
    this.individualTreasureResult = { ...rolled, items: existingItems };
    this.render();
  }

  /** Captures the current scroll position of a container so it can be restored after the next render (a full render replaces the DOM, which otherwise snaps every scrollable panel back to the top). */
  #captureScroll(selector) {
    const el = this.element?.querySelector(selector);
    if (el) this._pendingScrollRestore = { selector, top: el.scrollTop };
  }

  /** Ensures individualTreasureResult exists (zero coins, no items, 0 rolled) so the Loot tab's coin/item inputs work even before the GM has explicitly rolled. */
  #ensureIndividualTreasureResult() {
    if (!this.individualTreasureResult) {
      this.individualTreasureResult = { coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, rolledCount: 0, items: [] };
    }
    return this.individualTreasureResult;
  }

  /** Ensures lootPlan exists (zero coins/gems, no items, no tier yet) so the Hoard tab's coin/gems/rarity/item inputs work even before the GM has clicked "Roll Suggested Loot". */
  #ensureLootPlan() {
    if (!this.lootPlan) {
      this.lootPlan = {
        tier: null,
        confidence: null,
        coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
        gemsOrArt: { type: "none", count: 0, unitValue: 0 },
        rarityCounts: Object.fromEntries(RARITY_TIERS.map((r) => [r, 0])),
        items: [],
      };
    }
    return this.lootPlan;
  }

  /**
   * Returns the items array that addLootItem/removeLootItem/deleteLootItem
   * should mutate for whichever tab is active — the Treasure Hoard plan's
   * items, or the Individual Treasure result's items.
   */
  #getActiveLootItemsContainer() {
    return this.activeTab === "loot" ? this.#ensureIndividualTreasureResult() : this.#ensureLootPlan();
  }

  static #onAddLootItem(event, target) {
    const uuid = target.dataset.uuid;
    const item = this.lootItemIndex.find((i) => i.uuid === uuid);
    if (!item) return;
    const container = this.#getActiveLootItemsContainer();
    if (!container) return;

    this.#captureScroll(".loot-plan-column");
    const existing = container.items.find((i) => i.uuid === uuid);
    if (existing) existing.count += 1;
    else container.items.push({ uuid: item.uuid, name: item.name, img: item.img, rarity: item.rarity, count: 1, source: "manual" });
    this.render();
  }

  /** Opens the item's own sheet (description, stats, etc.) so the GM can preview it before deciding whether to add it — read-only for locked compendium items, same as opening any other compendium document in Foundry. */
  static async #onViewLootItem(event, target) {
    const item = await fromUuid(target.dataset.uuid);
    if (!item) {
      ui.notifications.warn("Could not load that item.");
      return;
    }
    item.sheet.render(true);
  }

  static #onRemoveLootItem(event, target) {
    const uuid = target.dataset.uuid;
    const container = this.#getActiveLootItemsContainer();
    if (!container) return;
    const existing = container.items.find((i) => i.uuid === uuid);
    if (!existing) return;
    this.#captureScroll(".loot-plan-column");
    existing.count -= 1;
    if (existing.count <= 0) {
      container.items = container.items.filter((i) => i.uuid !== uuid);
    }
    this.render();
  }

  static #onDeleteLootItem(event, target) {
    const container = this.#getActiveLootItemsContainer();
    if (!container) return;
    this.#captureScroll(".loot-plan-column");
    container.items = container.items.filter((i) => i.uuid !== target.dataset.uuid);
    this.render();
  }
}
