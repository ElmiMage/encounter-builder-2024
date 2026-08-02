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
  monster-scaling.js, die Boss-ify-Dialog-App in bossify-dialog.js, die
  Settings-Editor-App in scaling-settings-app.js) kann NICHT isoliert
  getestet werden — hier reicht
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
  gekennzeichnet, nicht RAW). Habitat-Feld: seit 2026-08 live gegen eine
  laufende Foundry-Welt verifiziert (`system.details.habitat` =
  `{value: [{type, subtype?}, ...], custom: ""}`, bestätigt u.a. an
  `dnd-monster-manual.actors`, `dnd5e.actors24`,
  `dnd-players-handbook.actors`, MCDM Flee-Mortals-Bestiary). Dropdown und
  Filter funktionieren wie vorgesehen (13 reale Werte, Filter auf
  "mountain" liefert 102 plausible Treffer). Zwei bei der Verifikation
  gefundene Lücken wurden direkt mitbehoben: `extractHabitatLabel`
  kombiniert jetzt `.type`+`.subtype` bei planaren Einträgen (z.B.
  "planar (elemental plane of air)" statt nur "planar" für alle
  Ebenen — sonst wären 22 verschiedene Planar-Werte in einem
  Filtereintrag verschmolzen), und `normalizeHabitat` hängt das freie
  `.custom`-Textfeld als eigenen Eintrag an, statt es zu verwerfen. Mit
  Hand-Assertions gegen die live bestätigte Datenform abgesichert.
  Dritter Nebenbefund, ebenfalls behoben: die Kompendium-Quelldaten
  selbst sind an einigen Stellen uneinheitlich großgeschrieben (z.B.
  "Shadowfell" vs. "shadowfell" für dieselbe Ebene) — das war kein rein
  kosmetisches Problem, sondern ein echter Filter-Bug, weil
  `getAvailableHabitats` per exaktem String-Vergleich dedupliziert:
  ein GM, der eine Schreibweise aus dem Dropdown wählt, hätte Monster
  mit der jeweils anderen Groß-/Kleinschreibung unsichtbar verpasst.
  `extractHabitatLabel` lowercased jetzt konsequent wie alle anderen
  rohen Filterkeys in diesem Modul (Creature Type, Subtype, Rarity) —
  Anzeige-Großschreibung kommt weiterhin vom bestehenden `humanize`-
  Handlebars-Helper (`format.js`/`humanizeToken`), nie im gespeicherten
  Wert selbst. Live verifiziert: "planar (Shadowfell)"/
  "planar (shadowfell)" verschmelzen jetzt zu einem Dropdown-Eintrag
  (33 statt 34 Werte). Bewusst NICHT angefasst: der echte Tippfehler
  "elementalplane of air" (fehlendes Leerzeichen) bleibt als eigener
  Eintrag bestehen — das ist kein Schreibweisen-, sondern ein
  Zeichenfehler ohne generische Korrekturmöglichkeit; eine Hardcoded-
  Korrekturliste für einzelne bekannte Tippfehler wäre fragil und wurde
  bewusst nicht gebaut.
  Vierter Nebenbefund, per Live-Screenshot vom Nutzer gemeldet und
  behoben (2026-08): das Habitat-Dropdown zeigte zwei ununterscheidbare
  "Any"-Einträge, und Klicken auf "Any Habitat" hatte sichtbar keine
  Wirkung. Ursache: der literale Rohwert `"any"` ist ein echter,
  buchlegitimer Habitat-Tag (bedeutet "in jedem Habitat anzutreffen",
  z.B. Archmage) — und kollidiert exakt mit diesem Moduls eigenem
  Platzhalter-Wert `value="any"` für "kein Filter aktiv". Zwei
  `<option>` mit identischem `value` sind für den Browser ein einziger,
  nicht unterscheidbarer Zustand. `getAvailableHabitats()` filtert den
  Rohwert `"any"` jetzt aus der Dropdown-Liste heraus (live verifiziert:
  32 statt 33 Werte, kein doppelter "Any"-Eintrag mehr). Zusätzlich war
  das vorher auch eine echte Filter-Ungenauigkeit, nicht nur kosmetisch:
  ein Monster mit Habitat `"any"` hätte bei einem konkreten Filter wie
  "Mountain" fälschlich NICHT auftauchen dürfen, obwohl es laut Buch
  überall vorkommt — die Filterprüfung in `encounter-builder-app.js`
  behandelt `habitats.includes("any")` jetzt als Treffer für JEDEN
  spezifischen Filter, nicht nur für den unfilterten Zustand (live
  verifiziert: Archmage erscheint jetzt korrekt im "Mountain"-Filter).
- Boss-ify-Feature (bossify-scaling.js, monster-scaling.js,
  bossify-dialog.js, scaling-settings-app.js): durchlief mehrere
  Iterationen. v1/v2 versuchten, eine Ziel-CR anhand einer aus dem
  2024-DMG abgetippten "Monster Statistics by Challenge Rating"-Tabelle
  anzusteuern (CR-Stufen-Buttons + Guideline-Delta-Berechnung, angelehnt
  an Boss Loot Monster Tools) — auf expliziten Nutzerwunsch verworfen (zu
  kompliziert, und die DMG-Tabelle wich an mehreren Stellen von Boss
  Loots eigener Tabelle ab, nicht nur AC).
  **v3 (aktuell, seit 2026-07)**: kein CR-Konzept mehr. Der GM wählt eine
  benannte Tier-Stufe (RAW 100% / Moderate 130% / High 150% / Deadly 200%,
  `BOSSIFY_TIERS` in bossify-scaling.js) — HP und Schadenswürfel skalieren
  direkt mit diesem Prozentsatz relativ zu den aktuellen Werten der
  Kreatur selbst (keine Tabellen-Nachschlage mehr nötig). AC und Ability
  Scores bekommen stattdessen einen kleinen festen Bonus pro Stufe
  (0/+1×+2/+2×+4/+3×+6), weil eine wörtliche Prozent-Skalierung dort
  unsinnige/unmögliche Werte ergäbe (Ability Score 20 bei 200% wäre 40).
  Alle Tier-Werte sind reine Hausregel, kein DMG-Wert — bewusster
  Abgrenzungspunkt zu Boss Loots CR-Tabellen-Ansatz.
  Seit 2026-07 sind diese Tier-Werte (Prozent/AC-Bonus/Ability-Bonus für
  Moderate/High/Deadly, RAW bleibt fix) sowie der Minion-XP-Multiplikator
  (siehe Minion-ify-Absatz unten) pro GM einstellbar über einen
  Settings-Menu-Eintrag (`scaling-settings-app.js`/`scaling-settings.hbs`,
  `game.settings.registerMenu`) statt 10 einzelne rohe Felder in Foundrys
  Standard-Settings-Liste — bewusst eine kleine editierbare Tabelle statt
  vieler Einzelzeilen. Gespeichert als zwei `config:false`-Settings
  (`bossifyTierConfig` als partielles Override-Objekt, gemergt via
  `mergeTierConfig()` auf die Code-Defaults; `minionXpMultiplier` als
  0-100-Prozentzahl) — client-scoped wie die übrigen Preference-Settings
  in main.js, jeder GM stellt also seine eigenen Werte ein.
- Boss-ify-Schadensskalierung — zwei dnd5e-Schema-Fallstricke, beide beim
  Live-Testen entdeckt und gegen die installierte dnd5e-5.3.3-Quelle
  verifiziert (`monster-scaling.js`):
  1. `scaleDamagePart` rundet die Würfelanzahl bewusst AB (nicht auf/
     nächstgelegen) und gleicht die Rundungsdifferenz als festen Bonus
     aus (z.B. 1d8 bei 130% → "1d8 + 1" statt ungenau unverändert "1d8")
     — Abrunden verhindert, dass der Ausgleichsbonus je negativ wird
     ("-N" auf einem hochskalierten Monster wäre verwirrend). Der
     Ausgleich wird an ein evtl. vorhandenes `bonus`-Feld angehängt (nie
     ersetzt/ausgewertet), funktioniert also auch bei dynamischen Formeln
     wie `@abilities.str.mod`. Gilt nur für den regulären
     Würfelanzahl/-größe/Bonus-Pfad, nicht für `custom.formula`-
     Schadensangaben (bleiben bei reiner Roll.alter-Würfel-Skalierung).
     Kompatibilität mit Midi QoL seit 2026-08 live verifiziert (zuvor nur
     statisch): Midi subklassifiziert dnd5e's `AttackActivity` tatsächlich
     zu `MidiAttackActivity` (bestätigt über `activity.constructor.name`
     und einen Error-Stack, live gegen Foundry 13.351 / dnd5e 5.3.3 /
     Midi QoL 13.0.64 getestet). Boss-ify (Tier High, 150%) an einem
     Goblin mit "Include Base Damage"-Scimitar (der Sonderfall aus Punkt 2
     oben) ergab beim Schadenswurf über Midis Klasse `1d6 + 2 + 4`
     (abgerundete Würfelzahl + unser Rundungs-Ausgleichsbonus + der
     dynamisch aus der ebenfalls hochskalierten DEX berechnete Ability-
     Mod-Term) — kein Crash, keine doppelte Basis-Schadenszeile
     (`preparedPartsCount: 1`). Danach zusätzlich über die ECHTE Midi-Chat-
     Karten-UI wiederholt (Attack-Button → Konfigurationsdialog → Normal,
     Damage-Button → Konfigurationsdialog → Normal, mit `autoRollAttack`/
     `autoCheckHit`/`autoRollDamage` testweise hochgedreht): identisches
     Ergebnis (`1d20 + 4 + 2` Treffer, `1d6 + 2 + 4` Schaden) — UI-Pfad und
     direkter API-Aufruf stimmen überein. Minion-ify (fixer
     `custom.formula`-Schaden statt Würfel) separat getestet: ein Orc→
     Minion-Greataxe (`custom.formula: "1"`) rollt über dieselbe
     `MidiAttackActivity`-Klasse korrekt `1` Slashing-Schaden, von Midis
     eigenem `createDamageDetail()` richtig typisiert. `completeActivityUse`
     (Midis Headless-Convenience-Funktion) und der direkte `.use()`-Aufruf
     ohne Button-Klick blieben in dieser automatisierten Browser-Session
     wirkungslos (keine Rolls, kein Fehler) — erst der echte UI-Klick auf
     die Chat-Karten-Buttons brachte die Rolls zustande; das automatische
     Fortschreiten ohne Klick (`autoRollAttack`/`autoRollDamage`) hat in
     diesem Testaufbau nie ausgelöst, ebenso wenig `autoApplyDamage: "yes"`
     (Ziel-HP blieb unverändert trotz korrekt berechnetem Schaden). Mit
     einem Kontrolltest geklärt, ob das an unseren skalierten Daten liegt:
     derselbe Ablauf (Karte → Attack-Klick → Konfigurationsdialog) mit
     einem KOMPLETT UNVERÄNDERTEN, nicht boss-ifizierten Goblin zeigt
     exakt dasselbe Verhalten — derselbe Konfigurationsdialog erscheint,
     kein automatisches Durchlaufen. Damit eindeutig belegt: das
     Ausbleiben des vollautomatischen Fortschreitens ist ein generelles
     Verhalten dieser automatisierten Browser-Testumgebung (vermutlich
     Dialog-/Fokus-bedingt bei rein skriptgesteuerter Bedienung, nicht
     GM-Socket-bedingt), unabhängig von Boss-ify/Minion-ify — betrifft
     also nicht unsere Schadensdaten, die in JEDEM getesteten Pfad
     (direkter Rollcall, echter UI-Klick, Midis `createDamageDetail`)
     korrekt ankamen. Nicht getestet: Auto-Target und Reaktionen
     (außerhalb des Scopes von Boss-ify/Minion-ify-Kompatibilität).
  2. Eine Activity mit "Include Base Damage" bekommt bei JEDER
     Datenaufbereitung eine `base:true, locked:true`-Kopie von
     `item.system.damage.base` vorne in `activity.damage.parts`
     eingeschoben (`AttackActivity#prepareFinalData` in dnd5e.mjs) — rein
     abgeleitete Anzeige-Daten, nicht gespeichert. `buildDamagePartUpdates`
     filtert solche `part.base === true`-Einträge jetzt heraus, bevor
     Activity-Parts skaliert werden (sonst: doppelte Grund-Schadenszeile
     UND Typ-Verlust, da diese Kopien DataModel-Instanzen statt reiner
     Objekte sind — `{...part}` verliert dabei Felder wie `types`;
     `toPlainPart()` normalisiert jetzt jeden Part über `.toObject()` vor
     dem Spreaden).
- Minion-ify-Feature (minion-scaling.js, monster-scaling.js): CR→HP/Damage-
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
  `MINION_XP_MULTIPLIER` (minion-scaling.js, Default 0.1 = 10%, per
  Settings-Menu überschreibbar — siehe Boss-ify-Absatz oben) senkt die für
  die Budget-Leiste/Auto-Fill gezählte XP eines minionifizierten Eintrags
  entsprechend — MCDM's Tabelle hat keine XP-Spalte, das ist reine
  Hausregel-Schätzung, kein Buch-Wert. Nimmt Vorrang vor der
  Lager-XP-Anpassung, falls beides gleichzeitig gesetzt wäre.
- Keine Lokalisierung vorhanden — alle UI-Texte sind fest auf Englisch im
  Template/JS. Ein früheres, ungenutztes lang/en.json-Scaffold wurde
  entfernt (nie mit `localize`/`game.i18n` verdrahtet). Falls Übersetzung
  gewünscht ist, muss das als eigenes Feature neu aufgebaut werden.
- Foundry-abhängiger Code seit 2026-08 erstmals live durchgeklickt (statt
  nur syntaktisch geprüft), über eine Wegwerf-Szene in der Testwelt:
  Encounter-Tab (Monster hinzufügen, Boss markieren, Boss-ify-Dialog live
  mit korrekter Preview — AC/HP/Ability/Damage-Werte stimmten exakt mit
  `computeBossifyScale` überein — Apply, Create Combat), Loot-Tab (Roll
  Individual Treasure, Generate Loot). Dabei einen echten Bug gefunden
  und behoben: der `bossMode`-Checkbox-Listener in
  `encounter-builder-app.js` (`_onRender`, `[name="bossMode"]`) setzte
  `this.bossMode` korrekt, rief aber nie `this.render()` auf — anders als
  jeder Nachbar-Listener im selben Block. Ein GM, der "Boss Encounter"
  anklickt, sah dadurch keine Reaktion (die Pro-Monster-"Boss"-Checkbox
  blieb unsichtbar), bis zufällig ein anderer Re-Render ausgelöst wurde
  (z.B. Filter ändern). Live reproduziert (Checkbox angeklickt, Boss-
  Checkbox blieb im DOM unsichtbar, obwohl `bossMode` intern bereits
  `true` war) und nach dem Fix erneut verifiziert (Checkbox erscheint
  jetzt ohne Umweg). `canvas-picker.js`s `pointerdown`-Listener lässt
  sich in einer rein skriptgesteuerten Browser-Session nicht über
  synthetische PointerEvents auf dem PIXI-Canvas auslösen (PIXIs
  Event-System nimmt sie nicht an) — stattdessen direkt gegen
  `canvas.stage.emit("pointerdown", {getLocalPosition: () => ({x,y})})`
  getestet, was exakt denselben Code-Pfad wie ein echter Klick durchläuft
  und die Promise korrekt auflöste; Token-Spiral-Platzierung
  (`computeSpiralPositions`/`clampToSceneBounds`) und die anschließende
  echte `Combat`- bzw. Loot-`Actor`-Erzeugung liefen dabei fehlerfrei.
  `toggleMinionify`/`toggleBoss` selbst laufen über das ApplicationV2-
  Actions-Framework (nicht den fehlerhaften `bossMode`-Listener-Pattern)
  und wurden per Code-Review auf denselben Fehler geprüft — kein
  Analogon gefunden. `scaling-settings-app.js` (Settings-Editor) und die
  komplette Minion-ify-UI-Klickkette blieben in dieser Runde ungetestet.
- Drag & Drop einzelner Monster aus der Encounter-Tab-Suchliste direkt
  auf die Canvas (seit 2026-08, auf Nutzerwunsch): `draggable="true"` auf
  dem `.monster-entry`-`<li>` (Template UND die JS-Rebuild-Variante in
  `#buildMonsterListHtml`, die bei jedem Tastendruck im Suchfeld per
  `.innerHTML`-Patch neu aufgebaut wird) plus ein in `_onRender`
  delegierter (nicht pro-Zeile gebundener) `dragstart`-Listener auf
  `this.element` — überlebt dadurch den Suchfeld-Patch, ohne dass der
  Listener neu gebunden werden müsste. Payload-Form (`{type:"Actor",
  uuid}`) stammt 1:1 aus Foundrys eigener `Document#toDragData()`-
  Konvention (im Core-Bundle nachgelesen), daher übernimmt Foundrys
  eingebautes Canvas-Drop-Handling (`Canvas#_onDrop` →
  `TokenLayer#_onDropActorData`) die Token-Erzeugung komplett selbst,
  kein eigener Drop-Handler nötig. Live verifiziert: echter Foundry-
  Core-Handler hängt per natives `element.addEventListener("drop", …)`
  direkt am PIXI-Canvas-DOM-Element (`canvas.app.view`), NICHT an PIXIs
  Pointer-Event-System — anders als der `pointerdown`-Fall oben ließ
  sich das Drop-Verhalten deshalb erfolgreich über ein echtes
  synthetisches `DragEvent("drop", {dataTransfer, clientX, clientY})`
  direkt auf `canvas.app.view` testen (inkl. vorherigem `"dragstart"` auf
  der Zeile selbst, um das reale Payload zu erzeugen) und erzeugte
  korrekt einen echten, unskalierten Token samt Actor. Bewusst
  eingeschränkter Scope (Nutzerwunsch): kein Boss-ify/Minion-ify beim
  Drag — das bleibt dem bestehenden "Zur Encounter-Liste hinzufügen +
  Create Combat"-Pfad vorbehalten. Item-Drag aus dem Loot-Tab wäre
  identisch umsetzbar, war aber nicht Teil dieses Auftrags.
- Item-Drag aus dem Loot-Tab (s.o.) landete anfangs stillschweigend
  nirgends, wenn kein Item-Piles-Modul aktiv ist — Ursache in Foundry
  Core selbst gefunden: `Canvas#_onDrop` (`client/canvas/board.mjs`)
  hat einen `switch(data.type)` mit Fällen für `Actor`, `JournalEntry(Page)`,
  `Macro`, `PlaylistSound`, `Tile`, aber KEINEN für `Item` — unser
  Drag-Payload ist korrekt, Core tut damit einfach nichts. Item Piles
  funktioniert nur, weil es selbst einen `dropCanvasData`-Hook
  registriert. Auf Nutzerwunsch bewusst kein eigener Fallback-Loot-Pile
  gebaut (das wäre deutlich mehr Scope); stattdessen in `main.js` ein
  eigener `dropCanvasData`-Hook, der bei `type === "Item"` und fehlendem
  aktivem `item-piles`-Modul eine `ui.notifications.warn` zeigt statt des
  stillen Fehlschlags. Live verifiziert (2026-08): Warnung erscheint
  ohne Item Piles, kein Verhaltensunterschied mit aktivem Item Piles.
- Party-Sync (`#syncFromPartyActor`, encounter-builder-app.js) zählte
  bisher immer die volle Roster-Liste von `game.actors.party` (dnd5e's
  Group-Actor-`playerCharacters`-Getter), unabhängig davon, wer an einem
  Spielabend tatsächlich dabei ist — auf Nutzerwunsch (Gruppe hat 6
  Charaktere im Party-Actor, spielt aber oft nur zu 3-4) erweitert:
  zählt jetzt zuerst, wie viele Roster-Mitglieder einen Token auf der
  aktiven Szene haben (`canvas.scene.tokens` gegen die
  `playerCharacters`-Actor-IDs abgeglichen) und nimmt bei Treffern nur
  deren Anzahl/Level (gleiche Rundungslogik wie dnd5e's eigener
  `GroupData#level`-Getter, hier repliziert, da wir nur die
  Präsenz-Teilmenge mitteln wollen). Fällt auf die volle Roster-Liste
  zurück, wenn niemand vom Roster einen Token auf der Szene hat (Planung
  vor dem Platzieren, oder Theater-of-the-Mind ohne Tokens). Live
  verifiziert (2026-08): mit 6 Roster-Charakteren, aber nur 3-4
  platzierten Spieler-Tokens auf der Szene, berechnet "Sync from Party"
  Level/Size korrekt nur aus den anwesenden 3-4.
- Minion-ify/Boss-ify-Actor-Reuse bei Create Combat (encounter-builder-app.js,
  monster-scaling.js): live gegen die laufende Welt getestet (2026-08, 7x
  Goblin mit Minion-ify in einer Encounter-Liste, "Create Combat"). Ergebnis
  wie erwartet — 7 Tokens, aber genau EIN Actor `"Goblin (Minion)"` im
  "Encounter Builder"-Ordner (`sourceUuid`-Flag korrekt gesetzt,
  `minionifySnapshot` vorhanden, `prototypeToken.actorLink: false`).
  Sicherheitscheck bestätigt: einem der 7 Tokens per `token.actor.update()`
  HP abgezogen — nur dieser Token fiel auf 1 HP, die übrigen 6 blieben bei
  6 HP, der zugrunde liegende Actor selbst ebenfalls bei 6 HP (unlinked
  Tokens tragen ihre eigene HP-Kopie, kein geteilter Pool). Cross-Run-Reuse
  (Lookup über `game.actors.find` mit `sourceUuid` + `minionifySnapshot`,
  für einen HYPOTHETISCHEN zweiten Create-Combat-Lauf mit derselben
  Konfiguration) direkt gegen die Live-Datenbank verifiziert — findet den
  bereits erzeugten Actor korrekt. Boss-ify-Variante (tier-spezifischer
  Key) strukturell identisch, aber in dieser Runde nicht separat live
  durchgeklickt. Anmerkung zur Testumgebung: automatisierte Klicks auf
  ApplicationV2-Actions-Buttons (`data-action="..."`) benötigen in dieser
  Browser-Session einen empirisch ermittelten Skalierungsfaktor (~2.54)
  zwischen den vom Screenshot-Tool erwarteten Koordinaten und echten
  Seiten-Pixeln — sonst treffen Klicks daneben, ohne Fehlermeldung. Zwei
  produktive Nebenfunde dabei: Foundrys eigener Encounter-Tracker-Header
  hat einen "Create Encounter"-Button mit demselben `data-action="createCombat"`
  wie unser eigener Button (Namenskollision) — ein zu ungenauer
  `document.querySelector('[data-action="createCombat"]')`-Aufruf trifft
  sonst den falschen; per Scoping auf `#encounter-builder-2024` behoben.
  Und: gehoverte/mit Mittelklick "gepinnte" Compendium-Tooltips
  (`.dnd5e-tooltip.item-tooltip`, "Middle-click to lock") können sich als
  eigenständiges Overlay über der App legen und deren Buttons blockieren —
  liegt an Foundrys eigenem Tooltip-System, nicht an diesem Modul.
- Encounter-Presets (speichern/laden, seit 2026-08): world-scoped
  `config:false`-Setting `encounterPresets` (main.js) — bewusst nicht
  client-scoped wie die übrigen Preference-Settings, da Presets
  vorbereiteter Inhalt sind, kein persönliches Tool-Preference; jeder GM
  in der Welt sieht dieselbe Liste. Speichert pro Preset nur
  Party Level/Size/Difficulty plus je Monster uuid+count+Boss-/Minion-ify-
  Konfiguration (keine Monster-Snapshot-Kopie) — beim Laden wird jedes
  uuid frisch gegen `this.monsterIndex` (nur aktuell aktivierte
  Kompendien) aufgelöst; nicht auffindbare Einträge (Kompendium
  deaktiviert oder Inhalt entfernt) werden übersprungen, mit einer
  Sammel-Warnung, analog zum bestehenden `failedMonsters`-Muster in
  `#onCreateCombat`. UI: neue `.preset-row` im Encounter-Tab
  (Dropdown + Load/Save As…/Delete), "Save As…" nutzt
  `DialogV2.input` für die Namensabfrage (überschreibt bei
  Namenskollision), "Delete" nutzt `DialogV2.confirm`. Live verifiziert
  (2026-08): Preset mit 2 Monstern (eines davon Boss/Moderate-Tier mit
  gemischten Apply-Flags) gespeichert, Encounter-Liste geleert, Preset
  geladen — alle Felder (Party Level/Size/Difficulty, Count, isBoss,
  bossifyTier, alle vier Apply-Flags) kamen 1:1 zurück, inklusive
  automatisch wieder aktiviertem `bossMode` (sonst wäre die Boss-Checkbox
  für den geladenen Eintrag unsichtbar gewesen). Delete-Dialog
  (Yes/No-Bestätigung) ebenfalls live durchgeklickt, Setting danach
  korrekt leer. Erzeugt keine Actors/Tokens/Combats, daher kein
  Cleanup-Bedarf nach dem Test.
  Nachtrag (noch 2026-08, auf Nutzerwunsch): der Treasure-Hoard-Plan
  (`this.lootPlan` — Coins, Gems/Art, Rarity-Zähler, die flache
  Item-Liste inkl. `source:"rolled"|"manual"`) wird jetzt mitgespeichert,
  falls beim Save schon einer gerollt wurde — bewusst nicht die
  Individual-Treasure-Liste (Loot-Tab), das war nicht Teil des Wunsches
  und ist ohnehin an die aktuelle Encounter-Zusammensetzung gekoppelt.
  `lootPlan`/`hoardLootBasis` werden nur gesetzt, wenn im Preset
  vorhanden — ältere Presets ohne dieses Feld laden weiterhin
  fehlerfrei, ohne den aktuell offenen Hoard zu überschreiben. Live
  verifiziert: Hoard gerollt (Party Level 5, Tier "5-10"), zusätzlich
  ein Item manuell per Suche hinzugefügt (`source:"manual"`), als Preset
  gespeichert, App-State geleert, Preset geladen — beide Items (das
  gerollte UND das manuell hinzugefügte) kamen exakt zurück, inklusive
  Coins/Gems/`hoardLootBasis`, im Hoard-Tab auch visuell bestätigt.
  Zweiter Nachtrag (noch 2026-08, auf Nutzerwunsch nach eigener
  Feldnamen-Durchsicht): zwei Umbenennungen mit Rückwärtskompatibilität.
  (1) Preset-Schema `entries` → `monsters` (las sich in einem rohen
  Settings-Dump nicht sofort als Monsterliste); Laden liest
  `preset.monsters ?? preset.entries`, alte Presets funktionieren
  weiter. (2) Das App-interne Feld `this.lootPlan` (samt
  `#ensureLootPlan`/`lootPlanCoins`/`lootPlanGemsOrArt`/`lootPlanItems`/
  `lootTierBasis`, den Form-Feldnamen `lootCoin-*`/`lootGemsArt*`/
  `lootRarity-*` und den Actions `rollLoot`/`rerollLoot`) hieß
  verwirrend ähnlich wie der tatsächliche **"Loot"-Tab** (Individual
  Treasure, `individualTreasureResult`), meinte aber immer den
  **Hoard**-Tab-Plan — komplett auf `hoardPlan`/`#ensureHoardPlan`/
  `hoardPlanCoins`/`hoardPlanGemsOrArt`/`hoardPlanItems`/
  `hoardTierBasis`/`hoardCoin-*`/`hoardGemsArt*`/`hoardRarity-*`/
  `rollHoard`/`rerollHoard` umbenannt (Methode `#rollHoardPlan()` hieß
  schon vorher richtig — Inkonsistenz war der Auslöser für den Fund).
  Preset-Feld entsprechend `lootPlan` → `hoardPlan`, Laden liest
  `preset.hoardPlan ?? preset.lootPlan`. `lootItemIndex`/
  `lootCompendiums`/`disabledLootCompendiums`/`toggleLootCompendium`/
  `addLootItem` etc. bewusst NICHT umbenannt — die sind echt geteilte
  Item-Infrastruktur für beide Tabs, nicht Hoard-spezifisch. Zusätzlich:
  neue `.preset-row`-CSS-Regel (`display:flex`), damit Dropdown +
  Load/Save As…/Delete in einer Zeile statt gestapelt erscheinen
  (Nutzer-Feedback per Screenshot). Live verifiziert: Preset mit Hoard
  gespeichert → Settings-Objekt trägt korrekt `monsters`/`hoardPlan`;
  ein synthetisch injiziertes Alt-Format-Preset (`entries`+`lootPlan`)
  lud trotzdem korrekt (Monster UND Hoard-Tier kamen zurück) — Fallback
  bestätigt. Preset-Zeile rendert jetzt einzeilig (32px Höhe statt
  gestapelt).
  Dritter Nachtrag (noch 2026-08): zwei weitere UI-Text-Korrekturen aus
  derselben Feldnamen-Durchsicht (nicht Code, sondern sichtbare Labels)
  — der Tab hieß schlicht "Loot" (Navigation), obwohl er laut eigener
  Tab-Überschrift "Individual Treasure" ist, uneindeutig neben
  "Treasure Hoard"; jetzt "Individual Treasure" in der Nav. Der
  Hoard-Tab-Button hieß "Roll Suggested Loot (DMG 2024)", jetzt "Roll
  Suggested Hoard (DMG 2024)". Help-Dialog entsprechend mitgezogen
  (`<h3>Loot</h3>` → `<h3>Individual Treasure</h3>`), plus ein neuer
  Absatz zu Save As…/Load/Delete (fehlte bisher komplett).
- Item-Typ-Filter für Loot-/Hoard-Tab (`item-categories.js`, seit
  2026-08, auf Nutzerwunsch): dnd5e hat KEIN eigenes Feld für
  DMG-Sprachgebrauch wie "Armor" vs. "Wondrous Item" — beide sind
  `type: "equipment"`, nur über `system.type.value` unterscheidbar.
  Mapping gegen die live installierte dnd5e-5.3.3-Quelle verifiziert
  (`CONFIG.DND5E.equipmentTypes`/`consumableTypes`/`lootTypes`), nicht
  geraten: Armor = `type:"equipment"` + Subtyp
  light/medium/heavy/natural/shield; Ring/Rod/Wand je eigene Kategorie;
  alles übrige `equipment` (clothing/trinket/vehicle/"wondrous"/leer)
  → "Wondrous Item" (dnd5e's eigener Catch-all-Subtyp "wondrous" wird
  tatsächlich von ~201 Items im installierten Content genutzt, z.B.
  Belts of Giant Strength, Ioun Stones — live gegen den Index gezählt).
  `type:"loot"` (Subtypen art/gear/gem/junk/material/resource/trade/
  treasure) bekommt eine eigene Kategorie "Loot", NICHT "Wondrous
  Item" — das sind Werte/Sachgüter, keine Magic-Item-Table-Einträge.
  Kategorie wird einmalig beim Index-Aufbau berechnet
  (`loadItemIndex()` in loot-generator.js, neues `category`-Feld pro
  Eintrag) und wie `getAvailableRarities` nur mit tatsächlich
  vorhandenen Werten befüllt (`getAvailableCategories`). Reine,
  deterministische Zuordnungslogik (kein RNG) — mit
  `node --check` + 22 Hand-Assertions abgesichert (jede Kombination
  aus itemType+typeValue aus der obigen Aufzählung, plus Edge Cases
  wie unbekannter itemType → "Other"). Live verifiziert: Filter auf
  "Weapon" reduziert die Item-Liste korrekt von 1035 auf 318 (nur
  Waffennamen); "Armor" zeigt ausschließlich echte Rüstungsteile
  (Studded Leather, Plate, Chain Shirt, …); "Wondrous Item" zeigt
  klassische Wondrous Items (Ioun Stone, Rope of Climbing, Robe of
  Useful Items, …) OHNE die Ring/Rod/Wand-Einträge, die ihre eigene
  Kategorie bekommen — genau der Trennungsfall, wegen dem die feinere
  (statt der einfachen Top-Level-`itemType`-) Variante gewählt wurde.
- Footer-Buttons umbenannt (seit 2026-08, auf Nutzerwunsch): "Generate
  Loot" → "Place Loot", "Create Combat" → "Deploy Encounter" — reine
  Anzeigetext-Änderung, `data-action="generateLoot"`/`"createCombat"`
  und die zugehörigen Methodennamen (`#onGenerateLoot`/
  `#onCreateCombat`) blieben unverändert, da sie weiterhin exakt
  beschreiben was im Code passiert (ein Loot-Actor wird generiert, ein
  Combat-Dokument wird erzeugt). Bewusst NICHT "Place Monster(s)" für
  den zweiten Button gewählt (ursprünglicher Vorschlag) — der Button
  legt tatsächlich ein echtes `Combat`-Dokument an und trägt jedes
  Monster als Combatant ein (`encounter-builder-app.js:1351-1357`),
  nicht nur Tokens; "Place Monster(s)" hätte das verschleiert und mit
  dem bestehenden reinen Token-Drag-and-Drop verwechselbar gemacht.
  Help-Dialog-Text und ein Code-Kommentar entsprechend mitgezogen.
  Live verifiziert: "Deploy Encounter" legt weiterhin korrekt Token +
  Combat mit Combatant an (funktional unverändert, nur der Label-Text
  ist neu).
- Item-Customize-Feature ("Customize…"-Button je Loot-/Hoard-Item, seit
  2026-08, auf Nutzerwunsch — analog zu Boss-ify, aber für Items statt
  Monster): Homebrew-Dialog, mit dem ein GM ein mundanes/generisches
  Loot-Item VOR dem Materialisieren (vor "Place Loot") individualisiert
  — eigener Name, fester Magic-Bonus (0/+1/+2/+3), zusätzlicher
  Schadenstyp (z.B. "+1d6 Acid" oben drauf). Bewusst kein DMG-Tabellen-
  Nachschlagen wie bei Boss-ify — es gibt dafür keine offizielle
  Tabelle, ist explizit als Hausregel gekennzeichnet (Hinweistext im
  Dialog).
  Mechanik (`item-customization.js`, reine Logik, `node --check` + 6
  Hand-Assertions): nutzt ausschließlich echte dnd5e-Felder statt
  irgendwas Neues zu erfinden — `system.magicalBonus` (dasselbe Feld,
  das die 2024-Template-Magic-Items nutzen, siehe voriger Eintrag) für
  den Bonus, ein neuer Eintrag in der Attack-Activity's
  `damage.parts`-Array für den Zusatzschaden, `"mgc"`-Properties-Flag
  automatisch gesetzt sobald irgendwas davon greift. Datenform
  `system.activities` beim Anwenden ist ein Objekt (keyed by activity
  id), NICHT ein Array — verifiziert gegen `Item#toObject()` auf einem
  echten Kompendium-Item (Longsword +1), dieselbe Form, die
  `createLootActor()` schon nutzt. Wichtiger Stolperstein, live
  entdeckt: `item.system.activities` auf einem LIVE/instanziierten
  Foundry-Dokument ist NICHT das gleiche wie auf dem `.toObject()`-
  Ergebnis — `Object.values(activities)` liefert auf der Live-Instanz
  fälschlich `[]` (Collection statt Plain Object), erst
  `.contents` liefert die echten Activity-Objekte. Betrifft nur
  Debugging/Verifikation gegen Live-Actors, nicht die eigentliche
  Anwendungslogik (die läuft ausschließlich auf `.toObject()`-Daten,
  also korrekt als Objekt).
  Datenmodell/Timing (`item-customize-dialog.js`,
  `encounter-builder-app.js`): Items im Loot-Plan sind bis "Place Loot"
  nur eine leichte Vorschau (`{key, uuid, name, img, rarity, count,
  source, customization?}`), noch kein echtes Foundry-Item — der Dialog
  schreibt die Anpassung nur auf den Plan-Eintrag zurück (mirrort
  BossifyDialog: schreibt nur `bossifyTier`+Apply-Flags auf den
  Encounter-Eintrag, wendet nichts direkt an), `applyItemCustomization`
  läuft erst in `createLootActor()` beim Materialisieren. Hat count>1
  ein Eintrag, wird beim Anpassen EINE Kopie abgespalten (count-1 auf
  dem Original, neuer Eintrag mit count:1 + der Customization) —
  verhindert, dass "Anpassen" versehentlich alle Kopien eines Stacks
  gleichzeitig verzaubert. Das erforderte eine echte Architektur-
  Änderung: Loot-Items wurden bisher ausschließlich per `uuid`
  identifiziert (`data-uuid` in den +/−/×-Buttons, `container.items.
  find(i => i.uuid === uuid)`) — sobald zwei Zeilen dieselbe Quelle
  teilen (ein normaler Stack + eine abgespaltene Custom-Kopie), wäre
  das mehrdeutig geworden (erster Treffer im Array gewinnt). Jeder
  Eintrag bekommt jetzt zusätzlich ein stabiles `key`-Feld
  (`foundry.utils.randomID()`); +/−/×/Customize auf einer Plan-Zeile
  zielen jetzt auf `key` (mit Fallback `i.key ?? i.uuid` für alte, vor
  diesem Feature gespeicherte Presets/Einträge ohne `key`), während der
  "+"-Button aus der Kompendium-Browserliste weiterhin klassisch nach
  `uuid` einen passenden NICHT-customized Stack sucht oder neu anlegt
  (`#onAddLootItem` unterscheidet die zwei Aufrufer über
  `target.dataset.key` vs. `target.dataset.uuid`). Extra-Schadenstyp-
  Feld im Dialog nur sichtbar, wenn das per `fromUuid()` frisch
  geladene Quell-Item `type === "weapon"` ist (Rüstung/Wand/etc.
  bekommen nur Name+Bonus). Live verifiziert (2026-08): "Longsword +1"
  mit count 2 in den Hoard-Plan gelegt, eine Kopie über "Customize…" zu
  "Acid Longsword" (Bonus +2, +1d6 Acid) gemacht → Plan zeigt danach
  korrekt zwei getrennte Zeilen (1x "Longsword +1" unverändert, 1x
  "Acid Longsword" mit ✨-Marker). Nach "Place Loot": echtes Item
  "Acid Longsword" auf dem Hoard-Actor mit `magicalBonus:"2"`,
  `properties` enthält `"mgc"`, Attack-Activity hat zwei Damage-Parts
  (Basis 1d8 slashing + injizierter 1d6 acid) — die unangetastete
  zweite Kopie ("Longsword +1") blieb korrekt bei `magicalBonus:"1"`
  ohne Zusatzschaden.
  Echter Bug, vom Nutzer gemeldet und noch am selben Tag behoben
  (2026-08): "im Treasure-Hoard-Tab reagiert keiner der Item-Buttons
  mehr (+/−/×/Customize), im Individual-Treasure-Tab aber schon".
  Ursache: `resolveMagicItems()` (loot-generator.js, von
  `suggestLootPlan`/`suggestSmoothedLootPlan` genutzt — der Pfad, den
  "Roll Suggested Hoard" tatsächlich nimmt) erzeugte Items bislang OHNE
  das neue `key`-Feld aus dem vorigen Nachtrag. Das Template rendert
  dann `data-key=""` (leerer String, nicht das Wort "undefined"), die
  Klick-Handler suchen aber `(i.key ?? i.uuid) === ""` — `i.uuid` ist
  nie ein leerer String, also nie ein Treffer: jeder Button auf einem
  gerollten Item war ein stiller No-op. Der Individual-Treasure-Tab
  betraf das nicht, weil der Nutzer dort Items über die durchsuchbare
  Liste manuell hinzugefügt hatte (`#onAddLootItem`s Browser-Pfad
  vergibt schon immer einen echten `key`) — "Roll Individual Treasure"
  selbst legt gar keine Items an, nur Coins. Doppelt behoben: (1)
  `resolveMagicItems()` vergibt jetzt auch `key: foundry.utils.
  randomID()` direkt beim Erzeugen. (2) Neue defensive Absicherung
  `#withDisplayFields()` (ursprünglich `#withDisplayKey()`, seit dem
  Nachtrag unten um `canCustomize` erweitert und umbenannt) in
  `_prepareContext` mappt `hoardPlanItems`/`individualTreasureItems` so,
  dass ausnahmslos jedes Item, das beim Template ankommt, einen
  nutzbaren `key` hat (Fallback auf `uuid`, wenn keiner gesetzt ist) —
  schützt zusätzlich vor genau diesem Leerstring-Mismatch bei jeder
  zukünftigen Item-Erzeugungsstelle und bei alten, vor diesem Fix
  gespeicherten Presets. Live reproduziert (Hoard gerollt, `data-key=""`
  am Button bestätigt, Klick verifiziert wirkungslos) und nach dem Fix
  erneut verifiziert (`data-key` trägt jetzt eine echte ID, "−" entfernt
  korrekt das richtige gerollte Item, "Customize…" öffnet den Dialog für
  das richtige Item).
  Nachtrag (noch 2026-08, Nutzer-Bugreport): Magic Bonus auf Rüstungen
  wurde im Dialog akzeptiert, landete aber nie auf dem echten Item.
  Ursache live gegen die 2024-Template-Items verifiziert: Waffen (und
  Wands, Rings, Rods, Wondrous Items — alles NICHT-Rüstungs-`equipment`)
  nutzen den Top-Level-Pfad `system.magicalBonus`, aber Rüstungen UND
  Schilde (equipment mit Subtyp light/medium/heavy/natural/shield)
  nutzen stattdessen den verschachtelten Pfad
  `system.armor.magicalBonus` — bestätigt an den offiziellen 2024
  "Armor, +1, +2, or +3"/"Shield, +1, +2, or +3"/"Wand of the War Mage,
  +1, +2, or +3"-Items (deren eigene Active Effects genau diese
  Pfad-Aufteilung zeigen). `applyItemCustomization()` bestimmt jetzt die
  Kategorie über `categorizeItem()` (dieselbe Funktion wie der
  Item-Typ-Filter) und schreibt auf den jeweils richtigen Pfad.
  Zusätzlich auf Nutzerwunsch: (1) der "Customize…"-Button erscheint in
  der Liste jetzt nur noch für Weapon/Armor-Einträge (`canCustomize` in
  `#withDisplayFields`, siehe oben) — andere Kategorien können
  mechanisch ohnehin keinen Magic Bonus nutzen; Einträge ohne bekannte
  `category` (alte Presets) zeigen den Button weiterhin sicherheitshalber.
  (2) Für Rüstungen ersetzt "Extra Resistance Type" das bei Waffen
  gezeigte "Extra Damage Type" — Mechanik live gegen echte
  Resistenz-Items (Ring of Fire Resistance, 2024 "Armor of Resistance")
  verifiziert: ein neuer Active Effect mit `transfer:true` und
  `system.traits.dr.value`-ADD-Change, NICHT ein `damage.parts`-Eintrag
  (komplett anderer Mechanismus als Extra-Schaden). Resistenz-Dropdown
  enthält zusätzlich zu den 10 Energie-Typen auch Bludgeoning/Piercing/
  Slashing (`EXTRA_RESISTANCE_TYPES` in item-customization.js) — reine
  physische Resistenz ohne "nur gegen nichtmagische Angriffe"-Nuance
  (`traits.dr.bypasses`), bewusst nicht nachgebildet, um den Scope klein
  zu halten. `resolveMagicItems()`/`#onAddLootItem`s Browser-Pfad
  schreiben jetzt beide ein `category`-Feld auf jeden Plan-Eintrag
  (vorher nur im Item-Browser-Index vorhanden, nicht auf dem Plan
  selbst). Hand-Assertions erweitert (7 Fälle: Waffen-Bonus top-level,
  Rüstungs-Bonus verschachtelt, Schild-Bonus verschachtelt, Wand-Bonus
  top-level, Resistenz-Effect-Form, physischer Resistenztyp,
  No-Op-Fall). Live verifiziert: "Studded Leather Armor +3" mit Bonus
  +2 und Fire-Resistance angepasst → nach "Place Loot" hat das echte
  Item `system.armor.magicalBonus:"2"` (NICHT `system.magicalBonus`),
  `"mgc"`-Flag, und einen Effect `{name:"Fire Resistance", transfer:
  true, changes:[{key:"system.traits.dr.value", value:"fire", mode:2}]}`
  — exakt die gegen echte Items verifizierte Form. "Ring of Protection"
  (Kategorie "Wondrous Item") zeigt korrekt keinen Customize-Button mehr.
  Nachtrag (noch 2026-08, auf Nutzerwunsch): der Magic-Bonus-Dropdown
  im Dialog deaktiviert jetzt Optionen, die kleiner-gleich dem bereits
  vorhandenen Bonus der Quell-Waffe/-Rüstung sind (z.B. bei "Longsword
  +1" ist "+1" ausgegraut, "+2"/"+3" bleiben wählbar; bei "Longsword +3"
  sind alle drei Stufen ausgegraut) — verhindert, dass eine Auswahl das
  Item versehentlich HERABSTUFT, da `applyItemCustomization()` den
  Bonus überschreibt statt addiert. "None" bleibt immer wählbar (lässt
  den vorhandenen Bonus unangetastet, siehe Kommentar in
  `applyItemCustomization()`). Vorhandener Bonus wird pro Kategorie am
  frisch geladenen Quell-Item gelesen (`system.armor.magicalBonus` für
  Armor, sonst `system.magicalBonus`) — derselbe Pfad-Unterschied wie
  im vorigen Nachtrag. Live verifiziert: "Longsword +1" → nur "+1"
  deaktiviert; "Longsword +3" → alle drei Stufen deaktiviert, nur
  "None" bleibt übrig.
  Nachtrag (noch 2026-08, auf Nutzerwunsch): Custom-Name-Feld füllt
  sich jetzt automatisch aus Basisname + gewähltem Bonus/Schadenstyp/
  Resistenztyp — `suggestItemName()` in item-customization.js, reine
  Logik mit 7 Hand-Assertions. Beispiel genau wie vom Nutzer gewünscht:
  "Longsword" + Bonus 2 + Schadenstyp Acid → "Acid Longsword +2".
  Rüstungen nutzen das DMG-typische "of X Resistance"-Suffix statt
  eines Präfixes (z.B. "Studded Leather Armor +1 of Fire Resistance"),
  passend zu den echten "Armor of Resistance"/"Ring of Fire
  Resistance"-Namensmustern. Vorschlag basiert IMMER auf dem frisch
  geladenen Original-Kompendium-Item (`#sourceItem.name`), nie auf dem
  aktuellen (evtl. schon vorher customized) Plan-Namen — sonst würde
  ein erneutes Anpassen Präfixe/Suffixe aufstapeln statt zu ersetzen.
  Vorhandene "+N"-Endung im Basisnamen wird vor dem Neuaufbau entfernt.
  Automatik schaltet sich ab, sobald der GM selbst ins Namensfeld
  tippt (`customNameTouched`-Flag) — danach überschreiben weitere
  Bonus-/Typ-Änderungen den manuell eingegebenen Namen nicht mehr;
  Leeren des Felds aktiviert die Automatik wieder. Live verifiziert:
  "Longsword +1" → Bonus +2 gewählt → Name wurde zu "Longsword +2";
  danach Acid-Schaden aktiviert → Name automatisch zu "Acid Longsword
  +2" aktualisiert; danach manuell zu "Vitriol Blade" umbenannt und
  Schadenstyp auf Fire geändert → Name blieb korrekt bei "Vitriol
  Blade" (keine Überschreibung mehr).
  Korrektur (noch 2026-08, auf Nutzerwunsch nach erstem Test): Format
  für Rüstungen war noch nicht ganz richtig. Zwei Änderungen: (1) Der
  Bonus steht jetzt bei JEDER Kategorie am Ende, nicht mehr direkt
  nach dem Basisnamen bei Rüstungen — vorher "Armor +1 of Fire",
  jetzt "Armor of Fire +1". (2) Resistenz zeigt nur noch den reinen
  Typ ohne das Wort "Resistance" — vorher "of Fire Resistance", jetzt
  schlicht "of Fire", analog zum Präfix-Muster bei Waffen ("Acid
  Longsword", kein "Acid Damage Longsword"). Live verifiziert:
  "Studded Leather Armor +3" → Bonus +1 + Fire-Resistance →
  "Studded Leather Armor of Fire +1".
  Zweite Korrektur (noch 2026-08, Nutzer-Feedback): war ein bereits
  vorhandener Bonus auf der Quell-Waffe/-Rüstung (z.B. "Longsword +1")
  gesetzt und der GM wählte im Dialog NUR Extra-Schaden/-Resistenz
  ohne den Magic-Bonus-Dropdown anzufassen (bleibt auf "None" — das
  lässt den vorhandenen Bonus mechanisch bewusst unangetastet, siehe
  `applyItemCustomization`), fehlte der vorhandene Bonus im
  Namensvorschlag komplett ("Acid Longsword" statt "Acid Longsword
  +1"). `#applyNameSuggestion()` in item-customize-dialog.js nutzt
  jetzt den EFFEKTIVEN Bonus (gewählter Dropdown-Wert, falls >0, sonst
  der bereits vorhandene Bonus über `#existingBonus()`) statt nur den
  rohen Dropdown-Wert. Live verifiziert: "Longsword +1", Bonus-Dropdown
  unverändert auf "None" belassen, nur Acid-Schaden aktiviert →
  Namensvorschlag korrekt "Acid Longsword +1". Auf Nutzerwunsch auch
  für Armor nachgetestet: "Studded Leather Armor +1", Bonus-Dropdown
  auf "None" belassen, nur Fire-Resistance aktiviert → korrekt
  "Studded Leather Armor of Fire +1" (vorhandener Bonus erscheint auch
  hier korrekt am Ende, Kategorie-Pfad-Unterscheidung funktioniert für
  beide Fälle identisch).
- Rarity-Skalierung beim Item-Customize (seit 2026-08, auf
  Nutzerwunsch): explizit Stephans eigene Hausregel-Vermutung
  ("jeder +1 Bonus erhöht es um eine Stufe, jedes Extra zählt auch als
  +1"), keine DMG-Tabelle — `suggestRarity()` in item-customization.js.
  Stufen = effektiver Bonus (siehe voriger Nachtrag) + 1 pro aktiviertem
  Extra (Schadenstyp bei Waffen, Resistenz bei Rüstungen), gezählt ab
  "common" (Index 0) auf `RARITY_TIERS`. Deckungsgleich mit den echten
  2024-Template-Items für Waffen (Bonus 1 allein → Index 1 = "uncommon",
  genau wie "Weapon +1"; Bonus 2 → "rare", wie "Weapon +2") — bewusst
  NICHT die Buch-Asymmetrie nachgebildet, dass Rüstungs-Boni offiziell
  eine Stufe seltener sind als gleich hohe Waffen-Boni (siehe
  vorletzter Nachtrag) — dieselbe Formel für beide Kategorien, um bei
  Stephans einfacher Regelbeschreibung zu bleiben. Nie eine Abwertung:
  das Maximum aus aktueller Rarity und berechneter Ziel-Rarity gewinnt.
  Wird im Dialog beim Apply berechnet (nicht erst beim Materialisieren)
  und direkt auf den Plan-Eintrag geschrieben, damit die Liste sofort
  die neue Seltenheit zeigt — `applyItemCustomization()` liest beim
  "Place Loot" nur noch `customization.rarity` statt es erneut zu
  berechnen. 8 Hand-Assertions (u.a. Bonus-1-allein-Fall gegen die
  echten Template-Items geprüft, Downgrade-Schutz, Artifact-Deckelung).
  Live verifiziert: "Longsword +1" (uncommon) → Bonus +2 + Acid-Schaden
  gewählt (effektiver Bonus 2 + 1 Extra = 3 Stufen) → Plan zeigt
  sofort "veryRare"; nach "Place Loot" hat das echte Item
  `system.rarity:"veryRare"` und `system.magicalBonus:"2"`.
  Korrektur (noch 2026-08, auf Nutzerwunsch): Rüstung und Waffe
  sollten sich UNTERSCHEIDEN statt derselben Formel zu folgen — auf
  Nachfrage stellte sich heraus, dass das exakt die echte DMG-2024-
  Asymmetrie zwischen Waffen- und Rüstungs-Boni widerspiegelt, die vorher
  bewusst vereinfacht ignoriert wurde (siehe voriger Nachtrag). Jetzt an
  den echten Template-Items kalibriert statt nur erfunden: Rüstung
  bekommt einen festen `+1`-Offset auf die berechnete Stufe
  (`RARITY_OFFSET_BY_CATEGORY` in item-customization.js). Das trifft
  NICHT nur den Bonus-Fall (Armor+1/+2/+3 = rare/veryRare/legendary vs.
  Weapon+1/+2/+3 = uncommon/rare/veryRare, beides live gegen die
  2024-Template-Items bestätigt), sondern auch den bonuslosen
  Resistenz-Fall: die echte "Armor of Resistance"-Familie (kein
  Zahlenbonus, nur Resistenz) hat Rarity "rare" — genau das, was die
  Formel mit 1 Schritt (Extra) + 1 (Rüstungs-Offset) = Index 2 = "rare"
  vorhersagt. Zwei unabhängig gegen echte Buchdaten bestätigte
  Datenpunkte, nicht nur einer. 12 Hand-Assertions (u.a. alle drei
  Waffen- UND alle drei Rüstungs-Bonusstufen einzeln gegen die
  Template-Items, der bonuslose Resistenz-Fall, kombinierter Fall,
  Downgrade-Schutz, Artifact-Deckelung). Live verifiziert: "Studded
  Leather Armor +1" (Basis-Rarity bereits "rare", passend zum
  Buch-Wert) → Bonus-Dropdown auf "None" belassen, nur Fire-Resistance
  aktiviert (effektiver Bonus 1 + 1 Extra + 1 Rüstungs-Offset = 3
  Stufen) → korrekt "veryRare".
- Einzelnen Hoard-Loot-Slot neu würfeln (seit 2026-08, auf Nutzerwunsch):
  bisher gab es nur `rerollMagicItems(plan, collectionIds)` (bulk — ersetzt
  ALLE `source:"rolled"`-Einträge auf einmal). Neue, gezielte
  `rerollSingleItem(plan, key, collectionIds)` in `loot-generator.js`
  ersetzt genau EINEN Eintrag (per stabilem `key` identifiziert) durch
  einen frischen Zufallstreffer derselben Rarity, alle anderen Einträge
  (gerollt oder manuell) bleiben unangetastet. No-op, wenn der Eintrag
  nicht gefunden wird oder `source !== "rolled"` ist — manuelle Einträge
  sind wie beim Bulk-Reroll nicht rerollbar. Nutzt intern dieselbe
  `getCandidatesForRarity()`-Hilfsfunktion wie `resolveMagicItems()`,
  jetzt `export`iert statt modul-privat. Bevorzugt (wenn der Pool >1
  Kandidat hat) bewusst ein ANDERES Item als das aktuelle, damit ein
  Reroll-Klick nicht mit spürbarer Wahrscheinlichkeit sichtbar wirkungslos
  bleibt. Ein Detail, das über die reine Nutzervorgabe hinausgeht und beim
  Umsetzen selbst aufgefallen ist: eine evtl. vorhandene `customization`
  (Custom-Name/Magic-Bonus/Extra-Schaden- oder -Resistenztyp vom
  Item-Customize-Feature) auf dem gerollten Eintrag wird beim Reroll
  gelöscht, statt unverändert auf das neue Item übertragen zu werden —
  sie war auf das ALTE Basisitem zugeschnitten (Namensvorschlag, welche
  Felder je nach Waffe/Rüstung überhaupt gültig sind) und würde sonst
  inkonsistente Zustände erzeugen (z.B. eine Rüstungs-Resistenz-
  Customization, die nach dem Reroll plötzlich an einer Waffe hängt).
  UI: neuer 🎲-Button in der Item-Zeile, nur im Treasure-Hoard-Tab (nicht
  Individual Treasure, da dort nie Magic Items gerollt werden, nur Coins)
  und nur bei `source === "rolled"` sichtbar — analog zum bedingten
  Customize-Button. Handler `#onRerollItem` in encounter-builder-app.js
  folgt exakt dem Muster von `#onCustomizeLootItem`/`#onRemoveLootItem`
  (`#getActiveLootItemsContainer()` + `#captureScroll()` +
  `data-key`-Targeting). Foundry-abhängiger Code (nutzt
  `pack.getIndex`/`ui.notifications` über `getCandidatesForRarity`) —
  zunächst nur mit `node --check` syntaktisch geprüft plus Handlebars-
  Balance-Check auf dem Template (95/95 offene/schließende
  `{{#if}}`/`{{#each}}`), danach vom Nutzer selbst in seiner eigenen
  laufenden Foundry-Welt getestet und als funktionierend bestätigt.
