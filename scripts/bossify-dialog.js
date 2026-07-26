/**
 * "Boss-ify" preview dialog — lets the GM pick a named difficulty tier
 * (RAW/Moderate/High/Deadly) that scales the boss's HP and damage dice by a
 * percentage, with a small flat bonus to AC/ability scores per tier. See
 * bossify-scaling.js for why this replaced an earlier CR-guideline-table
 * approach (dropped per user direction — this module deliberately does NOT
 * mirror Boss Loot Monster Tools' CR-lookup model).
 *
 * Loads the real compendium Actor once (loadFullActor) so the preview shows
 * this specific creature's actual current/projected HP, not a guideline
 * approximation — the boss's world Actor doesn't exist yet at
 * encounter-planning time, but the compendium source actor does.
 *
 * Only writes the chosen settings back onto the encounter entry
 * (bossifyTier + apply* flags) — bossifyActor() (monster-scaling.js)
 * applies it later, at Create Combat.
 */

import { computeBossifyScale, mergeTierConfig, BOSSIFY_TIER_ORDER } from "./bossify-scaling.js";
import { loadFullActor } from "./compendium-browser.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const MODULE_ID = "encounter-builder-2024";

export class BossifyDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Compendium source Actor, fetched lazily/once in _prepareContext for the preview — undefined until first fetch, null if the fetch failed. */
  #sourceActor;

  /**
   * @param {object} entry - the encounter Map entry for the boss ({monster, count, isBoss, bossifyTier, applyAC, applyHP, applyAbilities, applyDamageDice})
   * @param {object} encounterBuilderApp - the parent EncounterBuilderApp instance, re-rendered after Apply
   */
  constructor(entry, encounterBuilderApp, options = {}) {
    super(options);
    this.entry = entry;
    this.encounterBuilderApp = encounterBuilderApp;
    this.tier = entry.bossifyTier ?? "raw";
    this.applyAC = entry.applyAC ?? true;
    this.applyHP = entry.applyHP ?? true;
    this.applyAbilities = entry.applyAbilities ?? true;
    this.applyDamageDice = entry.applyDamageDice ?? true;
  }

  static DEFAULT_OPTIONS = {
    id: "encounter-builder-2024-bossify-dialog",
    tag: "form",
    window: {
      title: "Boss-ify",
      icon: "fa-solid fa-crown",
      resizable: false,
    },
    position: { width: 440 },
    actions: {
      setTier: BossifyDialog.#onSetTier,
      apply: BossifyDialog.#onApply,
      cancel: BossifyDialog.#onCancel,
    },
  };

  static PARTS = {
    form: { template: "modules/encounter-builder-2024/templates/bossify-dialog.hbs" },
  };

  get title() {
    return `Boss-ify: ${this.entry.monster.name}`;
  }

  async _prepareContext() {
    if (this.#sourceActor === undefined) {
      try {
        this.#sourceActor = await loadFullActor(this.entry.monster.uuid);
      } catch (err) {
        console.warn(`Encounter Builder | Boss-ify dialog failed to load "${this.entry.monster.name}" for preview`, err);
        this.#sourceActor = null;
      }
    }

    const tierConfig = mergeTierConfig(game.settings.get(MODULE_ID, "bossifyTierConfig"));

    const hp = this.#sourceActor?.system?.attributes?.hp;
    const snapshot = { hp: { value: hp?.value ?? hp?.max ?? 0, max: hp?.max ?? 0 } };
    const scaled = computeBossifyScale(snapshot, this.tier, tierConfig);

    const tierOptions = BOSSIFY_TIER_ORDER.map((key) => ({
      value: key,
      label: `${tierConfig[key].label} (${tierConfig[key].percent}%)`,
      selected: key === this.tier,
    }));

    return {
      monsterName: this.entry.monster.name,
      tierOptions,
      hpKnown: snapshot.hp.max > 0,
      hpCurrent: snapshot.hp.max,
      hpNew: snapshot.hp.max + scaled.hpMaxDelta,
      acDelta: scaled.acDelta,
      abilityScoreDelta: scaled.abilityScoreDelta,
      damagePercent: tierConfig[this.tier]?.percent ?? 100,
      applyAC: this.applyAC,
      applyHP: this.applyHP,
      applyAbilities: this.applyAbilities,
      applyDamageDice: this.applyDamageDice,
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    for (const name of ["applyAC", "applyHP", "applyAbilities", "applyDamageDice"]) {
      this.element.querySelector(`[name="${name}"]`)?.addEventListener("change", (ev) => {
        this[name] = ev.target.checked;
      });
    }
  }

  static #onSetTier(event, target) {
    this.tier = target.dataset.tier;
    this.render();
  }

  /** Writes the chosen tier + apply-what checkboxes back onto the encounter entry, then closes — the actual scaling happens later, at Create Combat. */
  static #onApply(event, target) {
    Object.assign(this.entry, {
      bossifyTier: this.tier,
      applyAC: this.applyAC,
      applyHP: this.applyHP,
      applyAbilities: this.applyAbilities,
      applyDamageDice: this.applyDamageDice,
    });
    this.encounterBuilderApp.render();
    this.close();
  }

  static #onCancel(event, target) {
    this.close();
  }
}
