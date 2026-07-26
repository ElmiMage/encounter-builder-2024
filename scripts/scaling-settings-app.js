/**
 * Settings-menu editor for Boss-ify's tier percentages/AC/ability bonuses
 * and Minion-ify's XP cost percentage — registered via
 * game.settings.registerMenu() in main.js instead of exposing 10 separate
 * raw fields in Foundry's default Module Settings list. Backing storage is
 * two hidden (config:false) settings: "bossifyTierConfig" (a partial
 * override object, merged onto BOSSIFY_TIERS defaults by
 * mergeTierConfig() — see bossify-scaling.js) and "minionXpMultiplier" (a
 * plain 0-100 percent number).
 *
 * Client-scoped (like this module's other preferences) — each GM tunes
 * their own values, consistent with autoSyncParty/defaultDifficulty/
 * defaultLootBasis in main.js.
 */

import { BOSSIFY_TIERS, BOSSIFY_TIER_ORDER, mergeTierConfig } from "./bossify-scaling.js";
import { MINION_XP_MULTIPLIER } from "./minion-scaling.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const MODULE_ID = "encounter-builder-2024";
const TUNABLE_TIERS = BOSSIFY_TIER_ORDER.filter((tier) => tier !== "raw");

export class ScalingSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "encounter-builder-2024-scaling-settings",
    tag: "form",
    window: {
      title: "Boss-ify / Minion-ify Values",
      icon: "fa-solid fa-sliders",
      resizable: false,
    },
    position: { width: 480 },
    actions: {
      save: ScalingSettingsApp.#onSave,
      resetDefaults: ScalingSettingsApp.#onResetDefaults,
      cancel: ScalingSettingsApp.#onCancel,
    },
  };

  static PARTS = {
    form: { template: "modules/encounter-builder-2024/templates/scaling-settings.hbs" },
  };

  async _prepareContext() {
    const tiers = mergeTierConfig(game.settings.get(MODULE_ID, "bossifyTierConfig"));
    const minionXpPercent = game.settings.get(MODULE_ID, "minionXpMultiplier");

    return {
      tierRows: TUNABLE_TIERS.map((key) => ({ key, ...tiers[key] })),
      minionXpPercent,
    };
  }

  /** Reads every number input directly off the form at Save time — no live preview needed here, so no _onRender change-tracking like BossifyDialog. */
  static async #onSave(event, target) {
    const readNum = (name, fallback) => {
      const el = this.element.querySelector(`[name="${name}"]`);
      const val = Number(el?.value);
      return Number.isFinite(val) ? val : fallback;
    };

    const tierConfig = {};
    for (const tier of TUNABLE_TIERS) {
      tierConfig[tier] = {
        percent: readNum(`${tier}-percent`, BOSSIFY_TIERS[tier].percent),
        acBonus: readNum(`${tier}-acBonus`, BOSSIFY_TIERS[tier].acBonus),
        abilityBonus: readNum(`${tier}-abilityBonus`, BOSSIFY_TIERS[tier].abilityBonus),
      };
    }
    const minionXpPercent = readNum("minionXpPercent", Math.round(MINION_XP_MULTIPLIER * 100));

    await game.settings.set(MODULE_ID, "bossifyTierConfig", tierConfig);
    await game.settings.set(MODULE_ID, "minionXpMultiplier", minionXpPercent);

    ui.notifications.info("Boss-ify / Minion-ify values saved.");
    this.close();
  }

  static async #onResetDefaults(event, target) {
    await game.settings.set(MODULE_ID, "bossifyTierConfig", {});
    await game.settings.set(MODULE_ID, "minionXpMultiplier", Math.round(MINION_XP_MULTIPLIER * 100));
    this.render();
  }

  static #onCancel(event, target) {
    this.close();
  }
}
