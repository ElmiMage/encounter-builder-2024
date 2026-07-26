# Encounter Builder (2024 Rules) — Conventions

- Ordner-Name MUSS exakt der `id` in `module.json` entsprechen
  (`encounter-builder-2024`), sonst erkennt Foundry das Modul nicht.
- Pure Logic (xp-budget.js, auto-fill.js, treasure-tables.js,
  individual-treasure-tables.js, smoothed-loot-tables.js, format.js,
  pack-grouping.js, bossify-scaling.js, minion-scaling.js, hp-formula.js,
  compendium-browser.js's normalizeHabitat etc.) MUSS mit
  `node --check --input-type=module`
  getestet werden, bevor sie als fertig gilt. Auf dieser Node-Version (24)
  funktioniert das nur über Stdin, nicht mit Datei-Argument:
  `node --input-type=module --check < scripts/datei.js`. Bei
  Wahrscheinlichkeits-/Gating-Logik (z.B. Rarity-Verteilung in
  smoothed-loot-tables.js) reicht Syntax-Check allein nicht — mit
  simulierten Rolls (mehrere hundert/tausend Durchläufe) verifizieren.
  bossify-scaling.js/minion-scaling.js sind deterministisch (kein RNG),
  dort reicht Syntax-Check + ein paar Hand-Assertions.
- Foundry-abhängiger Code (canvas-picker.js, Token-Platzierung,
  Actor/Item-Erzeugung in loot-generator.js, Actor-Mutation in
  monster-scaling.js, die Boss-ify-Dialog-App in bossify-dialog.js) kann
  NICHT isoliert getestet werden — hier reicht
  sorgfältige Syntaxprüfung + klare Kommentierung, was ungetestet ist.
  Live-Testing läuft über eine Directory-Junction von Foundrys
  `Data/modules/encounter-builder-2024` auf dieses Repo — jede Änderung
  ist nach einem F5 in der laufenden Welt sofort sichtbar.
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
  Boss-ify-Feature (bossify-scaling.js, monster-scaling.js,
  bossify-dialog.js): durchlief mehrere Iterationen. v1/v2 versuchten,
  eine Ziel-CR anhand einer aus dem 2024-DMG abgetippten "Monster
  Statistics by Challenge Rating"-Tabelle anzusteuern (CR-Stufen-Buttons +
  Guideline-Delta-Berechnung, angelehnt an Boss Loot Monster Tools). Das
  wurde auf expliziten Nutzerwunsch verworfen — zu kompliziert, und die
  DMG-Tabelle wich an mehreren Stellen von Boss Loots eigener Tabelle ab
  (unterschiedliche Datenbasis, nicht nur AC). **v3 (aktuell, seit
  2026-07)**: kein CR-Konzept mehr. Der GM wählt eine benannte Boss-ify-
  Tier-Stufe (RAW 100% / Moderate 130% / High 150% / Deadly 200%,
  `BOSSIFY_TIERS` in bossify-scaling.js) — HP und Schadenswürfel skalieren
  direkt mit diesem Prozentsatz relativ zu den aktuellen Werten der
  Kreatur selbst (keine Tabellen-Nachschlage mehr nötig), AC und
  Ability Scores bekommen stattdessen einen kleinen festen Bonus pro Stufe
  (0/+1×+2/+2×+4/+3×+6), weil eine wörtliche Prozent-Skalierung dort
  unsinnige/unmögliche Werte ergäbe (Ability Score 20 bei 200% wäre 40).
  Alle Tier-Werte sind reine Hausregel, kein DMG-Wert — bewusster
  Abgrenzungspunkt zu Boss Loots CR-Tabellen-Ansatz.
  Minion-ify-Feature (minion-scaling.js, monster-scaling.js): CR→HP/Damage-
  Tabelle aus einem Buch-Scan von MCDM's *Flee, Mortals!* ("Minion
  Statistics by Challenge Rating") abgetippt, CR 0-20 (deckt den vollen
  Buch-Bereich ab), einfach-quellenverifiziert wie die übrigen abgetippten
  Tabellen in diesem Projekt. Bewusst eingeschränkter Funktionsumfang:
  Minion-ify setzt nur HP (fix auf den Tabellenwert) und Schaden (fix, kein
  Würfeln mehr, über `custom.formula`) — AC/Angriffsbonus bleiben
  unangetastet (die Buch-Tabelle hat dafür keine Spalten). Die eigentlichen
  Flee-Mortals-Kernregeln ("jeder Treffer tötet, Overkill-Schaden geht aufs
  nächste Minion über" und "Group Attack") sind explizit NICHT automatisiert
  — auf Nutzerwunsch bewusst als manuelles Tischwissen belassen, um
  Kampf-Zeit-Automatisierung (neues technisches Terrain für dieses Modul,
  bräuchte dnd5e-Damage-Hooks wie `dnd5e.preApplyDamage`) zu vermeiden.
  Reine Stat-Konvertierung, analog zum Scope von Boss-ify/Encounter-HP-Modus.
  `MINION_XP_MULTIPLIER` (minion-scaling.js, aktuell 0.1) senkt die für die
  Budget-Leiste/Auto-Fill gezählte XP eines minionifizierten Eintrags auf
  10% — MCDM's Tabelle hat keine XP-Spalte, das ist reine Hausregel-
  Schätzung, kein Buch-Wert. Nimmt Vorrang vor der Lager-XP-Anpassung, falls
  beides gleichzeitig gesetzt wäre.
- Keine Lokalisierung vorhanden — alle UI-Texte sind fest auf Englisch im
  Template/JS. Ein früheres, ungenutztes lang/en.json-Scaffold wurde
  entfernt (nie mit `localize`/`game.i18n` verdrahtet). Falls Übersetzung
  gewünscht ist, muss das als eigenes Feature neu aufgebaut werden.
