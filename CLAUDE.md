# Encounter Builder (2024 Rules) — Conventions

- Ordner-Name MUSS exakt der `id` in `module.json` entsprechen
  (`encounter-builder-2024`), sonst erkennt Foundry das Modul nicht.
- Pure Logic (xp-budget.js, auto-fill.js, treasure-tables.js, pack-grouping.js,
  compendium-browser.js's normalizeHabitat etc.) MUSS mit
  `node --check --input-type=module` getestet werden, bevor sie als fertig gilt.
- Foundry-abhängiger Code (canvas-picker.js, Token-Platzierung,
  Actor/Item-Erzeugung in loot-generator.js) kann NICHT isoliert getestet
  werden — hier reicht sorgfältige Syntaxprüfung + klare Kommentierung,
  was ungetestet ist.
- Antworten knapp halten, keine vollständigen Datei-Inhalte im Chat
  wiederholen, wenn nur ein Snippet geändert wurde.
- Bei UI-Änderungen: prüfen, ob Handlebars-{{#if}}/{{#each}}-Blöcke
  balanciert sind (einfaches Python-Zählskript reicht).
- Bekannte Unsicherheiten offen kommunizieren statt zu verschweigen (z.B.
  CR 11-16/17+ Treasure-Tabellen sind Näherungen, Habitat-Feld-Struktur
  war nie live verifiziert).
