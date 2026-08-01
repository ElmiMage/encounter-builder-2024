# Encounter Builder (2024 Rules)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/elmimage)

Foundry VTT module for D&D 5e (2024 rules): builds encounters against the
2024 DMG's per-character XP budget, and generates 2024 DMG-style loot —
both a per-monster "Individual Treasure" purse and a full Treasure Hoard —
with a fully editable preview before creating anything.

## Features

**Encounter tab**

<img width="952" height="770" alt="Encounter Builder" src="https://cdn.jsdelivr.net/gh/ElmiMage/encounter-builder-2024@v0.3.3/screenshots/encounter-tab.jpg" />

- XP budget per 2024 DMG rules (Low/Moderate/High, no group multipliers)
- Browse monsters from ANY loaded Actor compendium (SRD + your own homebrew)
- Filters: search, CR, size, subtype, creature type, habitat (speculative,
  only shown if your dnd5e version actually has habitat data)
- Party Level/Size can be synced from Foundry's own designated Party actor
  (dnd5e's Group/Party feature) via a "Sync from Party" button — auto-pulled
  once when the app opens, never silently overwritten mid-session
- Auto-Fill Remaining (randomized variety + repeat cap, respects every
  active filter) and Boss Encounter mode (one strong creature + supporting
  adds — targets the full budget instead of leaving a chunk unspent when
  there's no room left for adds)
- **Boss-ify**: mark any monster (auto-picked or added by hand) as the
  boss, then scale its HP, damage, AC, and ability scores up by a chosen
  tier — RAW / Moderate / High / Deadly — so a single boss can actually
  threaten a full party. Fully reversible per-monster
- **Minion**: convert any monster to MCDM-style Minion stats (*Flee,
  Mortals!*) — fixed low HP and fixed, non-random damage per hit, at a
  fraction of its normal XP cost — for fast, disposable group fights.
  Also reversible
- **Encounter HP** mode (RAW / Average / Maxroll) controls how every
  monster's HP is set when placed, independent of Boss-ify/Minion
- Boss-ify's tier percentages/AC/ability bonuses and Minion's XP discount
  are GM-tunable per-user under Settings > Configure Settings > Module
  Settings > "Configure Values" (defaults match the numbers above)
- In-app **Help** button (next to the tabs) explains every button and
  field in plain language
- Lair Actions: monsters that have them get a per-encounter "Lair" toggle,
  adjusting their XP to CR+1 for budget purposes — matches the 2024/2025
  Monster Manual's fix for a 2014-era oversight where lair-fighting
  monsters got no XP bump at all
- Click a monster's name to open its stat block; a separate "+" button adds
  it — same pattern everywhere a monster or item is listed in this module
- Drag a monster straight from the search list onto the canvas to place a
  single, plain (un-scaled) token immediately — a quick-and-dirty
  alternative to the encounter list for a one-off placement; Boss-ify/
  Minion-ify still require adding it to the encounter list below instead
- Click-to-place token spiral formation on the canvas
- Creates a real Combat encounter when you're happy with the picks
- Compendium selection is remembered per-user across sessions

**Loot tab — Individual Treasure**

<img width="952" height="774" alt="Encounter Builder Loot" src="https://cdn.jsdelivr.net/gh/ElmiMage/encounter-builder-2024@v0.3.3/screenshots/loot-tab.jpg" />

- The 2024 DMG's smaller, separate "Individual Treasure" table: the
  incidental coin a single non-hoarding monster carries, as opposed to a
  full Treasure Hoard
- Rolled once per creature currently selected in the Encounter tab, summed
  into one purse — coins only (including electrum, which Treasure Hoard
  never rolls), fully editable afterward
- Search + manually add specific items from your own compendiums, on top
  of or instead of the rolled coins

**Treasure Hoard tab**

<img width="952" height="775" alt="Encounter Builder Loot Hoard" src="https://cdn.jsdelivr.net/gh/ElmiMage/encounter-builder-2024@v0.3.3/screenshots/treasure-hoard-tab.jpg" />

- The 2024 DMG's detailed Treasure Hoard tables — coins, gems/art, and
  resolved magic items with real names, not a blind roll
- Coin formulas for all four CR tiers (0-4, 5-10, 11-16, 17+) are
  cross-verified against independent sources and treated as confirmed; the
  gems/magic-item band shape is a restructured (probability-preserving,
  not row-by-row) approximation — see the confidence note in
  `treasure-tables.js`
- Hoard tier is based on **party level**, not monster CR — deliberate
  choice, matches common practice among experienced DMs more closely than
  strict RAW (see comments in `encounter-builder-app.js`)
- **Loot Basis** dropdown: "Tier (RAW)" (default, follows Party Level) or a
  specific character level 1-20, which uses an opt-in homebrew table that
  smooths out the DMG's 4 wide tier bands into a per-level curve —
  magnitudes interpolated log-linearly, magic-item rarity mix interpolated
  from the DMG's own "Magic Items Awarded by Level" table with a hard
  floor (very rare impossible below level 5, legendary below level 11) —
  see `smoothed-loot-tables.js` for the full methodology
- Reroll magic items using your own hand-edited rarity counts
- Search + add specific items from your own compendiums; rarity filter is
  ordered common→artifact, not alphabetically, and mundane (non-magical)
  gear is excluded from the loot browser entirely
- Creates a real Actor with real Items, placed as a **hidden, non-combat**
  token (never added to the Combat tracker — it doesn't fight)

## Install (local dev)

1. Clone this repo into your Foundry `Data/modules/` folder as
   `encounter-builder-2024` (folder name MUST match `module.json`'s `id`)
2. Enable it in a world under Settings > Manage Modules
3. Open the Combat tab — a button labeled "Encounter Builder" appears

## Releasing

1. Bump `version` in `module.json`, commit
2. Tag and push: `git tag -a vX.Y.Z -m "..."` then `git push origin master --tags`
3. A GitHub Actions workflow (`.github/workflows/release.yml`) automatically
   builds `module.zip` (module.json, LICENSE, README.md, scripts/, styles/,
   templates/ — matches exactly what Foundry needs to run the module) and
   opens it as a **draft** release with the built assets attached
4. Write the real release notes and publish: `gh release edit vX.Y.Z --notes "..." --draft=false`
   (or finish it in the GitHub web UI)

The manifest/download URLs in `module.json` always point at
`releases/latest`, so publishing the release is what makes Foundry's
"Update Module" check pick up the new version.

## Status

Actively developed. See `module.json` for the compatibility range
(V12 minimum, tested against V13). Foundry-dependent code (canvas
placement, Actor/Item creation and mutation, the Boss-ify dialog app)
can't be unit-tested outside a live Foundry session — everything else (all
pure-logic `scripts/*.js` files, including the treasure/loot tables, the
smoothed-level math, and the Boss-ify/Minion-ify stat math) has been
checked with plain Node, and probability/gating claims are verified with
simulated rolls before being called done. The Minion stat table is
transcribed from MCDM's *Flee, Mortals!*; Boss-ify's tier percentages are
an original house rule, not sourced from any book.

**Midi QoL compatibility**: Boss-ify's and Minion-ify's damage scaling has
been live-verified against [Midi QoL](https://foundryvtt.com/packages/midi-qol)
(v13.0.64, Foundry v13.351, dnd5e 5.3.3) — Midi subclasses dnd5e's own
Activity classes rather than replacing them, so it reads the same scaled
damage data as a normal roll, including weapons with "Include Base
Damage" enabled. Both the dice-based Boss-ify scaling and Minion-ify's
fixed `custom.formula` damage rolled correctly through Midi's own
`MidiAttackActivity` class.

## Support

This module is free and will stay free. If it saved you some prep time and
you feel like buying me a coffee, that's always appreciated — but never
expected: [ko-fi.com/elmimage](https://ko-fi.com/elmimage)
