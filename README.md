# Encounter Builder (2024 Rules)

Foundry VTT module for D&D 5e (2024 rules): builds encounters against the
2024 DMG's per-character XP budget, and generates DMG-style treasure hoards
with a full editable preview before creating anything.

## Features

**Encounter tab**
- XP budget per 2024 DMG rules (Low/Moderate/High, no group multipliers)
- Browse monsters from ANY loaded Actor compendium (SRD + your own homebrew)
- Filters: search, CR, size, subtype, creature type, habitat (speculative,
  only shown if your dnd5e version actually has habitat data)
- Auto-Fill Remaining (with randomized variety + repeat cap) and Boss
  Encounter mode (one strong creature + supporting adds)
- Click-to-place token spiral formation on the canvas
- Creates a real Combat encounter when you're happy with the picks

**Loot tab**
- DMG 2024 treasure hoard tables (Challenge 0-4 and 5-10 confirmed against
  the book; 11-16 and 17+ are marked approximate — see comments in
  treasure-tables.js)
- Hoard tier is based on **party level**, not monster CR
- Full preview before creating anything: coins, gems, and resolved magic
  items with real names — not a blind roll
- Reroll magic items with your own rarity counts
- Search + add specific items from your own compendiums
- Creates a real Actor with real Items, placed as a **hidden, non-combat**
  token (never added to the Combat tracker — it doesn't fight)

## Install (local dev)

1. Clone this repo into your Foundry `Data/modules/` folder as
   `encounter-builder-2024` (folder name MUST match `module.json`'s `id`)
2. Enable it in a world under Settings > Manage Modules
3. Open the Combat tab — a button labeled "Encounter Builder" appears

## Status

Actively developed. See `module.json` for the compatibility range
(V12 minimum, tested against V13). Canvas-dependent code
(`canvas-picker.js`, parts of `loot-generator.js`) can't be unit-tested
outside a live Foundry session — everything else has been checked with
plain Node.
