/**
 * "Customize Item" dialog — lets the GM turn a mundane/generic loot-list
 * item into this encounter's specific magic find: a custom name, a flat
 * magic bonus (system.magicalBonus / system.armor.magicalBonus, same
 * fields the 2024 template magic items use), an extra damage type on top
 * of a weapon's own damage, or — for armor — an extra resistance type.
 * Homebrew, not a DMG table lookup — see item-customization.js.
 *
 * Loads the real compendium Item once (fromUuid) so the dialog knows
 * whether it's a weapon or armor (categorizeItem(), same categorization
 * item-categories.js already uses for the loot browser's type filter) —
 * only those two categories get the Magic Bonus field at all (other item
 * types don't mechanically use it — see item-customization.js), and only
 * one of Extra Damage Type (weapon) / Extra Resistance Type (armor) makes
 * sense per item. Mirrors BossifyDialog's lazy source-load pattern.
 *
 * Only writes the chosen customization back onto the loot-plan entry
 * (and, if the entry currently represents more than one copy, splits one
 * copy off into its own entry first — customizing shouldn't silently
 * turn every copy into the same magic item). The actual Item mutation
 * happens later, at "Place Loot" (see applyItemCustomization() /
 * createLootActor() in loot-generator.js).
 *
 * The Custom Name field auto-fills from the bonus/damage/resistance
 * selection (suggestItemName() in item-customization.js — e.g. "Longsword"
 * + bonus 2 + acid → "Acid Longsword +2") for as long as the GM hasn't
 * typed their own name; typing anything switches to manual mode so the
 * suggestion stops overwriting it (see customNameTouched).
 */

import { EXTRA_DAMAGE_TYPES, EXTRA_RESISTANCE_TYPES, DAMAGE_DENOMINATIONS, suggestItemName, suggestRarity } from "./item-customization.js";
import { categorizeItem } from "./item-categories.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class ItemCustomizeDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Full compendium source Item, fetched lazily/once in _prepareContext — undefined until first fetch, null if the fetch failed. */
  #sourceItem;

  /**
   * @param {object} entry - the loot-plan item entry ({key, uuid, name, img, rarity, category, count, source, customization?})
   * @param {{items: object[]}} container - the plan object owning `entry` (this.hoardPlan or this.individualTreasureResult) — items array gets a split-off entry pushed onto it if entry.count > 1
   * @param {object} encounterBuilderApp - the parent EncounterBuilderApp instance, re-rendered after Apply
   */
  constructor(entry, container, encounterBuilderApp, options = {}) {
    super(options);
    this.entry = entry;
    this.container = container;
    this.encounterBuilderApp = encounterBuilderApp;

    const existing = entry.customization;
    this.customName = existing?.name ?? "";
    // Once true, the auto-name suggestion (see #applyNameSuggestion)
    // stops overwriting whatever the GM typed. A previously-saved
    // customization.name counts as manually chosen; re-opening a fresh
    // entry with an empty name starts in auto mode.
    this.customNameTouched = !!existing?.name;
    this.magicalBonus = existing?.magicalBonus ?? 0;
    this.extraDamageEnabled = !!existing?.extraDamage;
    this.extraDamageNumber = existing?.extraDamage?.number ?? 1;
    this.extraDamageDenomination = existing?.extraDamage?.denomination ?? 6;
    this.extraDamageType = existing?.extraDamage?.type ?? "acid";
    this.extraResistanceEnabled = !!existing?.extraResistance;
    this.extraResistanceType = existing?.extraResistance ?? "fire";
  }

  static DEFAULT_OPTIONS = {
    id: "encounter-builder-2024-item-customize-dialog",
    tag: "form",
    window: {
      title: "Customize Item",
      icon: "fa-solid fa-wand-magic-sparkles",
      resizable: false,
    },
    position: { width: 420 },
    actions: {
      apply: ItemCustomizeDialog.#onApply,
      cancel: ItemCustomizeDialog.#onCancel,
    },
  };

  static PARTS = {
    form: { template: "modules/encounter-builder-2024/templates/item-customize-dialog.hbs" },
  };

  get title() {
    return `Customize: ${this.entry.name}`;
  }

  /** "Weapon" / "Armor" / etc. (see item-categories.js) — null while the source item hasn't loaded (or failed to). */
  #category() {
    if (!this.#sourceItem) return null;
    return categorizeItem(this.#sourceItem.type, this.#sourceItem.system?.type?.value);
  }

  /**
   * The bonus this SPECIFIC compendium item already innately has (e.g. a
   * "Longsword +1" entry, as opposed to a customization layered on top
   * via this dialog) — read from whichever field actually applies for its
   * category (see item-customization.js for why armor uses a different
   * path than everything else). 0 for a mundane item or while the source
   * item hasn't loaded yet.
   */
  #existingBonus(category) {
    if (!this.#sourceItem) return 0;
    const raw = category === "Armor" ? this.#sourceItem.system?.armor?.magicalBonus : this.#sourceItem.system?.magicalBonus;
    return Number(raw) || 0;
  }

  /**
   * The bonus that will actually end up on the item: whatever's picked in
   * the Magic Bonus dropdown if it's a real choice, otherwise the item's
   * own existing bonus (leaving the dropdown on "None" keeps that
   * untouched — see applyItemCustomization). Shared by the name
   * suggestion and the rarity suggestion so both agree on "how magic is
   * this item, really" — an already-"+1" item that only gets an extra
   * damage/resistance type picked should read as "Acid Longsword +1" AND
   * price/rarity itself as if it has a +1, not silently drop it from
   * either.
   */
  #effectiveBonus() {
    return this.magicalBonus > 0 ? this.magicalBonus : this.#existingBonus(this.#category());
  }

  /**
   * Re-suggests the name from the TRUE base item (this.#sourceItem — the
   * pristine compendium source, never a previously-customized name, so
   * re-suggesting after already-customized state doesn't compound e.g.
   * "Acid Longsword +2" → "Fire Acid Longsword +2") whenever the bonus or
   * extra damage/resistance selection changes — but only while the GM
   * hasn't typed their own name (see customNameTouched in the
   * constructor). No-ops once nothing is selected (suggestItemName
   * returns "" — leaves whatever's already there alone rather than
   * clearing a name the GM might still want).
   */
  #applyNameSuggestion() {
    if (this.customNameTouched || !this.#sourceItem) return;
    const suggested = suggestItemName(this.#sourceItem.name, {
      magicalBonus: this.#effectiveBonus(),
      extraDamageType: this.extraDamageEnabled ? this.extraDamageType : null,
      extraResistanceType: this.extraResistanceEnabled ? this.extraResistanceType : null,
    });
    if (suggested) this.customName = suggested;
  }

  async _prepareContext() {
    if (this.#sourceItem === undefined) {
      try {
        this.#sourceItem = await fromUuid(this.entry.uuid);
      } catch (err) {
        console.warn(`Encounter Builder | Customize Item dialog failed to load "${this.entry.name}"`, err);
        this.#sourceItem = null;
      }
    }

    const category = this.#category();
    const isWeapon = category === "Weapon";
    const isArmor = category === "Armor";
    const existingBonus = this.#existingBonus(category);

    return {
      itemName: this.entry.name,
      customName: this.customName,
      magicalBonus: this.magicalBonus,
      // Picking +1 on an item that's already a +2 would silently
      // DOWNGRADE it (applyItemCustomization overwrites, it doesn't add
      // to, the item's own bonus) — disable anything at or below what
      // the item already innately has. "None" (0) stays enabled at any
      // existing bonus: it means "leave the item's own bonus alone", not
      // "set it to 0".
      bonusOptions: [0, 1, 2, 3].map((value) => ({ value, disabled: value > 0 && value <= existingBonus })),
      existingBonus,
      // Magic Bonus only mechanically does anything on weapons (attack/
      // damage rolls) and armor (AC) — see item-customization.js for why
      // it's a genuinely different field for each. Extra Damage Type only
      // makes sense on weapons (only they have an attack Activity to hang
      // a damage part off of); Extra Resistance Type only on armor.
      showBonusField: isWeapon || isArmor,
      isWeapon,
      isArmor,
      sourceItemUnknown: this.#sourceItem === null,
      extraDamageEnabled: this.extraDamageEnabled,
      extraDamageNumber: this.extraDamageNumber,
      extraDamageDenomination: this.extraDamageDenomination,
      extraDamageType: this.extraDamageType,
      damageTypeOptions: EXTRA_DAMAGE_TYPES,
      denominationOptions: DAMAGE_DENOMINATIONS,
      extraResistanceEnabled: this.extraResistanceEnabled,
      extraResistanceType: this.extraResistanceType,
      resistanceTypeOptions: EXTRA_RESISTANCE_TYPES,
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelector('[name="customName"]')?.addEventListener("input", (ev) => {
      this.customName = ev.target.value;
      // Clearing the field back to empty hands naming control back to
      // the auto-suggestion (next bonus/type change fills it in again);
      // typing anything switches to manual mode.
      this.customNameTouched = ev.target.value.trim() !== "";
    });
    this.element.querySelector('[name="magicalBonus"]')?.addEventListener("change", (ev) => {
      this.magicalBonus = Number(ev.target.value) || 0;
      this.#applyNameSuggestion();
      this.render();
    });
    this.element.querySelector('[name="extraDamageEnabled"]')?.addEventListener("change", (ev) => {
      this.extraDamageEnabled = ev.target.checked;
      this.#applyNameSuggestion();
      this.render();
    });
    this.element.querySelector('[name="extraDamageNumber"]')?.addEventListener("change", (ev) => {
      this.extraDamageNumber = Math.max(1, Number(ev.target.value) || 1);
    });
    this.element.querySelector('[name="extraDamageDenomination"]')?.addEventListener("change", (ev) => {
      this.extraDamageDenomination = Number(ev.target.value);
    });
    this.element.querySelector('[name="extraDamageType"]')?.addEventListener("change", (ev) => {
      this.extraDamageType = ev.target.value;
      this.#applyNameSuggestion();
      this.render();
    });
    this.element.querySelector('[name="extraResistanceEnabled"]')?.addEventListener("change", (ev) => {
      this.extraResistanceEnabled = ev.target.checked;
      this.#applyNameSuggestion();
      this.render();
    });
    this.element.querySelector('[name="extraResistanceType"]')?.addEventListener("change", (ev) => {
      this.extraResistanceType = ev.target.value;
      this.#applyNameSuggestion();
      this.render();
    });
  }

  static #onApply(event, target) {
    const customization = {
      name: this.customName.trim() || null,
      magicalBonus: this.magicalBonus > 0 ? this.magicalBonus : 0,
      extraDamage: this.extraDamageEnabled
        ? { number: this.extraDamageNumber, denomination: this.extraDamageDenomination, type: this.extraDamageType }
        : null,
      extraResistance: this.extraResistanceEnabled ? this.extraResistanceType : null,
    };
    const hasCustomization =
      !!customization.name || customization.magicalBonus > 0 || !!customization.extraDamage || !!customization.extraResistance;

    // Rarity scales with the EFFECTIVE bonus (see #effectiveBonus), same
    // reasoning as the name suggestion — computed here (not just in
    // applyItemCustomization at "Place Loot" time) so the plan list shows
    // the new rarity immediately, matching how the name already updates.
    if (hasCustomization) {
      customization.rarity = suggestRarity(this.entry.rarity, {
        magicalBonus: this.#effectiveBonus(),
        extraDamage: !!customization.extraDamage,
        extraResistance: !!customization.extraResistance,
        category: this.#category(),
      });
    }

    const effectiveName = customization.name || this.#sourceItem?.name || this.entry.name;
    const effectiveRarity = customization.rarity || this.entry.rarity;

    if (this.entry.count > 1) {
      // Leave the rest of the stack as plain copies; split one off as the
      // customized find.
      this.entry.count -= 1;
      this.container.items.push({
        key: foundry.utils.randomID(),
        uuid: this.entry.uuid,
        name: effectiveName,
        img: this.entry.img,
        rarity: effectiveRarity,
        category: this.entry.category,
        count: 1,
        source: this.entry.source,
        customization: hasCustomization ? customization : undefined,
      });
    } else {
      // Assign a key even here if this entry never had one (e.g. a
      // rolled magic item) — otherwise it'd keep falling back to its
      // uuid, which could collide with another keyless entry of the
      // same source item still sitting in the list.
      this.entry.key ??= foundry.utils.randomID();
      this.entry.name = effectiveName;
      this.entry.rarity = effectiveRarity;
      this.entry.customization = hasCustomization ? customization : undefined;
    }

    this.encounterBuilderApp.render();
    this.close();
  }

  static #onCancel(event, target) {
    this.close();
  }
}
