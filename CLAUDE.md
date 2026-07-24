# Encounter Builder (2024 Rules) — Conventions

- Ordner-Name MUSS exakt der `id` in `module.json` entsprechen
  (`encounter-builder-2024`), sonst erkennt Foundry das Modul nicht.
- Pure Logic (xp-budget.js, auto-fill.js, treasure-tables.js,
  individual-treasure-tables.js, smoothed-loot-tables.js, format.js,
  pack-grouping.js, compendium-browser.js's normalizeHabitat etc.) MUSS
  mit `node --check --input-type=module` getestet werden, bevor sie als
  fertig gilt. Bei Wahrscheinlichkeits-/Gating-Logik (z.B. Rarity-Verteilung
  in smoothed-loot-tables.js) reicht Syntax-Check allein nicht — mit
  simulierten Rolls (mehrere hundert/tausend Durchläufe) verifizieren.
- Foundry-abhängiger Code (canvas-picker.js, Token-Platzierung,
  Actor/Item-Erzeugung in loot-generator.js) kann NICHT isoliert getestet
  werden — hier reicht sorgfältige Syntaxprüfung + klare Kommentierung,
  was ungetestet ist. Live-Testing läuft über eine Directory-Junction von
  Foundrys `Data/modules/encounter-builder-2024` auf dieses Repo — jede
  Änderung ist nach einem F5 in der laufenden Welt sofort sichtbar.
- Antworten knapp halten, keine vollständigen Datei-Inhalte im Chat
  wiederholen, wenn nur ein Snippet geändert wurde.
- Bei UI-Änderungen: prüfen, ob Handlebars-{{#if}}/{{#each}}-Blöcke
  balanciert sind (einfaches Grep-Zählskript reicht).
- Bekannte Unsicherheiten offen kommunizieren statt zu verschweigen.
  Aktueller Stand: Die Treasure-Hoard-Münzformeln sind für alle vier
  CR-Tiers (0-4/5-10/11-16/17+) gegen zwei unabhängige Quellen verifiziert
  und gelten als bestätigt (siehe Confidence-Note in treasure-tables.js).
  Weiterhin Näherung: das Gems/Magic-Item-Bänder-Modell (kein 1:1-Abbild
  der Buch-Tabelle, deckt nur Magic Item Tables A-G statt A-I ab), die
  Individual-Treasure-Tabellen (nur einfach quellenverifiziert), und das
  komplette smoothed-loot-tables.js-System (explizit als Hausregel
  gekennzeichnet, nicht RAW). Habitat-Feld-Struktur war nie live
  verifiziert (Dropdown erscheint nur, falls `availableHabitats` nicht
  leer ist — ob echte Werte durchkommen, unbestätigt).
- Keine Lokalisierung vorhanden — alle UI-Texte sind fest auf Englisch im
  Template/JS. Ein früheres, ungenutztes lang/en.json-Scaffold wurde
  entfernt (nie mit `localize`/`game.i18n` verdrahtet). Falls Übersetzung
  gewünscht ist, muss das als eigenes Feature neu aufgebaut werden.
