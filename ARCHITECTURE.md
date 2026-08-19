# Architektur-Überblick

Diese Datei fasst zusammen, wie das Modul aufgebaut ist und warum zentrale
Design-Entscheidungen so getroffen wurden — als Referenz für spätere
Rückfragen (z.B. im Rahmen der Foundry-Package-Einreichung), unabhängig vom
Chat-Verlauf, in dem das ursprünglich erarbeitet wurde. Beschreibt den
aktuellen Stand, nicht die Entstehungsgeschichte einzelner Entscheidungen —
für das "warum" hinter einem konkreten Detail (Live-Verifikationen,
verworfene Alternativen, Datums-Historie) siehe `CLAUDE.md`.

## 1. Grundaufbau

Drei Kern-Bausteine:

- **`scripts/main.js`** — Startpunkt. Registriert alle Modul-Settings (siehe
  Abschnitt 8), hängt den "Encounter Builder"-Button in die Combat-Sidebar
  (`renderCombatTracker`-Hook), macht die App über eine Macro-API verfügbar
  (`game.modules.get(...).api.open()`), und registriert einen
  `dropCanvasData`-Hook für den Canvas-Drag-Pfad (siehe Abschnitt 4).
- **`scripts/encounter-builder-app.js`** — das Herzstück. Die eigentliche
  Foundry-`ApplicationV2` (mit drei Tabs: Encounter, Individual Treasure,
  Treasure Hoard), verwaltet den kompletten UI-Zustand (ausgewählte Monster,
  aktive Filter, Loot-Pläne, Rollen-Cache) und reagiert auf Nutzer-Aktionen
  über ein zentrales `actions`-Objekt (ApplicationV2-Konvention).
- **`templates/encounter-builder.hbs`** — die Handlebars-Vorlage für alle
  drei Tabs. Beschreibt die Struktur des Fensters; die App füllt sie über
  `_prepareContext()` mit Daten.

Alle anderen `scripts/*.js`-Dateien lassen sich in zwei Gruppen teilen:

- **Reine Rechen-/Datenmodule ohne Foundry-API-Abhängigkeit** — isoliert mit
  `node --check` bzw. eigenen Hand-Assertion-Skripten testbar, unabhängig
  von einer laufenden Foundry-Instanz: `xp-budget.js`, `treasure-tables.js`,
  `individual-treasure-tables.js`, `smoothed-loot-tables.js`,
  `auto-fill.js`, `pack-grouping.js`, `format.js`, `token-placement.js`,
  `hp-formula.js`, `bossify-scaling.js`, `minion-scaling.js`,
  `item-categories.js`, `item-customization.js`, `monster-roles.js`.
- **Foundry-abhängige Klebeschichten** — brauchen eine echte Foundry-Session
  (Actor/Item-Dokumente, Canvas, Dialoge), nur mit sorgfältiger
  Syntaxprüfung + Live-Test abgesichert: `compendium-browser.js`,
  `monster-role-data.js`, `loot-generator.js`, `monster-scaling.js`,
  `canvas-picker.js`, `bossify-dialog.js`, `item-customize-dialog.js`,
  `scaling-settings-app.js`.

## 2. XP-Budget-System (`xp-budget.js`)

Reine Mathematik nach dem 2024-DMG-System:

- `XP_BUDGET_PER_CHARACTER`: feste Tabelle, XP-Wert pro Charakterstufe
  (1-20) für drei Schwierigkeitsgrade (Low/Moderate/High).
- **Keine Gruppengrößen-Multiplikatoren** mehr (Unterschied zu den
  2014-Regeln) — Budget = Wert-pro-Charakter × Party-Größe, direkt.
- `CR_TO_XP`: feste Tabelle, bildet Challenge Rating auf den offiziellen
  XP-Wert ab. Wird als Fallback gebraucht, weil Foundrys leichte
  Kompendium-Vorschaudaten (siehe Abschnitt 3) den XP-Wert oft nicht
  mitliefern — der wird von Foundry normalerweise erst zur Laufzeit aus dem
  CR abgeleitet, was bei den Vorschaudaten nicht passiert. Für einzelne,
  bekannte Ausnahmen (vorgefertigte "Minion"-Statblöcke aus MCDM *Flee,
  Mortals!*, deren wahres XP noch niedriger als der CR-Fallback ist) liest
  `compendium-browser.js` stattdessen gezielt das volle Actor-Dokument.
- `computeBudget()`, `evaluateSpend()`, `xpForChallengeRating()` — die drei
  zentralen Funktionen, die aufeinander aufbauen.

## 3. Kompendium-Lesen (`compendium-browser.js`)

**Zwei Ladestufen**, bewusst getrennt, damit das Öffnen der App auch bei
riesigen Kompendium-Sammlungen (in der Testwelt: 1648 indexierte Monster)
schnell bleibt:

1. `loadMonsterIndex()` → `pack.getIndex({fields: [...]})` — leichte
   Vorschau (Name, Bild, CR, XP, Typ, Subtyp, Größe, Habitat, Lair-Flag) für
   **alle** Monster jedes aktivierten Kompendiums auf einmal. Füllt die
   durchsuchbare Liste. Ein kleiner, bekannter Sonderfall: Kompendien mit
   einem `MINION_ROLE_FLAGS`-Eintrag (aktuell nur MCDM Flee Mortals'
   `role: "minion"`-Flag) bekommen für genau diese geflaggten Einträge
   zusätzlich das volle Actor-Dokument geladen, weil deren echtes XP erst
   zur Laufzeit vom Quell-Modul berechnet wird und im leichten Index als
   leeres Objekt ankommt.
2. `loadFullActor(uuid)` → `fromUuid()` — lädt das **komplette**
   Actor-Dokument erst dann, wenn es tatsächlich gebraucht wird: beim
   Import in ein Combat, beim Ansehen des Stat-Blocks, oder (siehe
   Abschnitt 6) bei der Rollen-Klassifizierung.

Weitere wichtige Stellen:

- `isMonsterEntry(entry)`: filtert auf Typ `"npc"` mit gesetztem CR-Wert —
  Spielercharaktere/Fahrzeuge im selben Kompendium fallen raus.
- `normalizeHabitat(raw)`: live gegen echte Kompendium-Daten verifiziertes
  Format (`{value: [{type, subtype?}, ...], custom: ""}`), inkl.
  konsequentem Lowercasing (verhindert doppelte Dropdown-Einträge durch
  uneinheitliche Groß-/Kleinschreibung in Quelldaten) und Sonderbehandlung
  des Literalwerts `"any"` (buchlegitimer Habitat-Tag, kollidiert sonst mit
  dem eigenen "kein Filter"-Platzhalter gleichen Namens).
- `getPackSourceLabel`/`getPackGroupInfo`: gruppiert Kompendien nach
  Herkunfts-Modul/System für die aufklappbare Kompendium-Auswahl.

## 4. Encounter-Tab-Ablauf

- **Zustand**: `this.encounter` ist eine `Map`, Schlüssel = Monster-UUID,
  Wert = `{monster, count, inLair, isBoss, bossifyTier, isElite, minionify,
  applyAC, applyHP, applyAbilities, applyDamageDice}`. Eine Map statt Array,
  damit dieselbe Kreatur mehrfach vorkommen kann (`count` hochzählen statt
  Duplikate).
- **Hinzufügen vs. Ansehen vs. Ziehen**: pro Monster-Zeile mehrere getrennte
  Interaktions-Ziele — Name → `#onViewMonster` (öffnet Stat-Block via
  `fromUuid()` + `.sheet.render()`), separater "+"-Button → `#onAddMonster`,
  und die ganze Zeile ist `draggable="true"` für einen direkten Canvas-Drop
  (siehe unten). Foundry löst beim Klick den **nächstgelegenen**
  `data-action`-Handler auf, deswegen kollidieren die Klick-Ziele nicht.
- **Filter**: sieben unabhängige, UND-verknüpfte Kriterien (Suche + sechs
  Dropdowns: Type/CR/Size/Subtype/Habitat/Role) über
  `#matchesSelectFilters`. Die Dropdown-Optionen selbst werden jeweils
  **ohne** den eigenen Filter berechnet (`#getMonstersExcluding`), damit
  eine Auswahl die eigene Options-Liste nicht leerlaufen lässt — derselbe
  Helper liefert auch den Scope für die Rollen-Berechnung (Abschnitt 6).
- **Auto-Fill**: `autoFillEncounter()`/`autoFillBossEncounter()` aus
  `auto-fill.js` — greedy Algorithmus, wählt pro Slot unter den
  nächstpassenden Kandidaten zufällig aus (mit Wiederholungs-Deckel), damit
  nicht immer dieselbe Kombination entsteht. Sind Rollen-Constraints
  gesetzt, übernimmt stattdessen `autoFillEncounterWithRoles()`
  (Abschnitt 6) — ignoriert im Boss-Mode.
- **Boss / Elite / Minion**: drei Wege-exklusives Flag-Set pro Zeile (nie
  zwei gleichzeitig, siehe Abschnitt 5).
- **Encounter HP-Modus**: RAW (gedruckter Wert) / Minroll (jeder Trefferwürfel
  = 1) / Maxroll (jeder Trefferwürfel = Maximum) — `hp-formula.js`, greift
  nur bei frisch erzeugten, nicht Boss/Elite/Minion-skalierten Actors (die
  bestimmen ihre HP bereits selbst).
- **Lair Actions**: Checkbox setzt `entry.inLair = true`;
  `#getEffectiveXp()` rechnet dann mit `CR+1` statt normalem CR für die
  Budget-Anzeige — nur bei Monstern mit `hasLairActions === true`.
- **Presets**: `game.settings`-basiert (world-scoped, `encounterPresets`),
  speichert Party-Konfiguration, die komplette Monsterliste (inkl. aller
  Boss/Elite/Minion-Flags) und optional den aktuellen Treasure-Hoard-Plan
  als benannten, welt-weit geteilten Datensatz. Save As… / Load / Delete.
- **Create Combat ("Deploy Encounter")**: importiert ausgewählte Monster als
  World-Actors, platziert Tokens spiralförmig
  (`computeSpiralPositions()`/`clampToSceneBounds()` in
  `token-placement.js`, Ausgangspunkt per `pickCanvasPoint()` aus
  `canvas-picker.js`) und erstellt daraus ein Combat-Dokument. Actor-
  Wiederverwendung läuft über einen `sourceUuid`-Flag plus, bei
  Boss/Elite/Minion, einen zusätzlichen Variant-Key (Tier + die vier
  `apply*`-Flags bzw. "minion"), damit z.B. sieben Goblin-Minions sich
  einen einzigen Actor teilen statt sieben Duplikate zu erzeugen — nur
  wenn der prototypische Token ungelinkt ist (sonst würden mehrere Tokens
  sich einen HP-Pool teilen).
- **Direkter Canvas-Drag**: eine Monster-Zeile lässt sich auch ohne den
  Umweg über die Encounter-Liste direkt auf die Canvas ziehen — Foundrys
  eigener `dropCanvasData`-Hook (in `main.js`) erkennt den
  `encounterBuilder2024`-Marker im Drag-Payload und importiert/platziert
  denselben Actor wie das "Create Combat"-Reuse-Muster, aber ohne
  Boss/Elite/Minion-Skalierung (bewusst nur ein schneller Rohplatzierungs-
  Weg).

## 5. Boss-ify / Elite / Minion-ify (`bossify-scaling.js`, `monster-scaling.js`, `bossify-dialog.js`, `minion-scaling.js`, `scaling-settings-app.js`)

Drei Wege, ein Monster für den Kampf zu verändern — pro Encounter-Zeile
gegenseitig exklusiv (`entry.isBoss`/`entry.isElite`/`entry.minionify`, nie
zwei gleichzeitig):

- **Boss-ify**: der GM wählt eine benannte Tier-Stufe (RAW 100% / Moderate
  130% / High 150% / Deadly 200%, `BOSSIFY_TIERS`) für **genau ein**
  Monster im Encounter (Cross-Entry-exklusiv — nur ein Boss gleichzeitig,
  `#clearBossifyExcept`). HP und Schadenswürfel skalieren direkt mit dem
  Prozentsatz relativ zu den aktuellen Werten der Kreatur (kein
  CR-Tabellen-Nachschlagen). AC und Ability Scores bekommen stattdessen
  einen kleinen festen Bonus pro Stufe, da eine wörtliche Prozent-Skalierung
  dort unsinnige Werte ergäbe. Eine Vorschau-Dialog-App (`BossifyDialog`,
  `bossify-dialog.js`) zeigt die berechneten Werte vor dem Anwenden; vier
  `apply*`-Checkboxen (AC/HP/Abilities/DamageDice) erlauben selektives
  Anwenden.
- **Elite**: ein drittes, NICHT Cross-Entry-exklusives Flag (beliebig viele
  Zeilen gleichzeitig) — nutzt exakt `BOSSIFY_TIERS.moderate` über
  denselben `bossifyActor()`-Aufruf, ohne eigene Konfiguration oder Dialog.
  Ein Elite-Goblin und ein manuell auf Boss-ify-Tier "Moderate" gesetzter
  Boss-Goblin sind mechanisch identisch und teilen sich beim Import
  bewusst denselben World-Actor.
- **Minion-ify**: konvertiert zu MCDM-*Flee,-Mortals!*-Minion-Statistiken
  (`minion-scaling.js`, CR→HP/Schaden-Tabelle aus dem Buch abgetippt,
  CR 0-20) — fixe, niedrige HP und fixer, nicht gewürfelter Schaden
  (`custom.formula` statt Würfel), AC/Angriffsbonus bleiben unangetastet
  (die Buch-Tabelle hat dafür keine Spalten). NICHT Cross-Entry-exklusiv.
  Die eigentlichen Flee-Mortals-Kernregeln (Overkill-Schaden, Group Attack)
  sind bewusst NICHT automatisiert — reine Stat-Konvertierung.
  `MINION_XP_MULTIPLIER` (Standard 10%, GM-einstellbar) senkt die für die
  Budget-Leiste gezählte XP eines minionifizierten Eintrags entsprechend.

**Anwendung** (`monster-scaling.js`, `bossifyActor()`/`minionifyActor()`):
snapshottet die Original-Werte (HP/AC/Abilities/Item-Schaden) in einen
`bossifySnapshot`/`minionifySnapshot`-Flag auf dem Actor, bevor mutiert
wird — `revertBossify()`/`revertMinionify()` stellen daraus den
Originalzustand wieder her. Die Würfelanzahl-Skalierung rundet bewusst AB
und gleicht die Differenz als festen Bonus aus (verhindert einen je
negativen Ausgleichsbonus). Live gegen Midi QoL verifiziert: Midi
subklassifiziert dnd5e's eigene Activity-Klassen, statt sie zu ersetzen,
liest also dieselben skalierten Daten korrekt.

**GM-Konfiguration**: Boss-ify's Tier-Werte (außer RAW, das fix bleibt) und
Minion-ify's XP-Prozentsatz sind pro GM einstellbar über einen eigenen
Settings-Menu-Eintrag (`scaling-settings-app.js`, `ScalingSettingsApp`,
`game.settings.registerMenu`) statt zehn Einzelfelder in Foundrys
Standard-Settings-Liste — gespeichert als zwei `config:false`-Settings
(`bossifyTierConfig` als partielles Override-Objekt, gemergt via
`mergeTierConfig()`; `minionXpMultiplier` als Prozentzahl).

## 6. Monster-Rollen / Encounter Composition (`monster-roles.js`, `monster-role-data.js`, `auto-fill.js`)

Klassifiziert Monster additiv (nicht exklusiv, ein Monster kann mehrere
oder keine tragen) in fünf Hausregel-Rollen — reine, CR-relative
Perzentil-/Binär-Heuristik, kein Buch-System, bewusst unabhängig von
Drittanbieter-Kompendien wie MCDMs eigener `role`-Flag-Konvention:

- **Brute**: HP im obersten Viertel derselben CR-Vergleichsgruppe.
- **Tank**: AC im obersten Viertel derselben CR-Vergleichsgruppe.
- **Skirmisher**: Schaden-pro-HP-Verhältnis im obersten Viertel — bewusst
  nicht Attack-Bonus (Streuung pro CR zu gering, kein brauchbares Signal)
  oder reiner Schaden (überschneidet sich zu stark mit Brute, da HP und
  Schaden in 5e-Design oft gemeinsam skalieren).
- **Cleric**: WIS-basiertes Spellcasting UND mindestens ein echtes
  Spell-Item (die reine `system.attributes.spellcasting`-Ability allein
  ist bei über der Hälfte aller Monster gesetzt, auch ohne jeden Zauber —
  kein verlässliches Signal für sich genommen).
- **Caster**: INT- oder CHA-basiertes Spellcasting (inkl. Innate
  Spellcasting) UND mindestens ein echtes Spell-Item.

Perzentil-Schwellen werden `>=` (nicht nur `>`) verglichen, wegen
Werte-Häufungen bei kleinen Stichproben. `assignRolesToPopulation()`
gruppiert nach CR und weitet das Vergleichsfenster automatisch auf
Nachbar-CRs aus, wenn eine CR-Gruppe zu klein für ein stabiles Perzentil
ist (< 20 Einträge).

**Foundry-Anbindung** (`monster-role-data.js`): Schaden- und
Spellcasting-Daten stehen nicht im leichten Kompendium-Index (nur über
volle Actor-Dokumente erreichbar) — deshalb bewusst NICHT synchron beim
normalen Index-Aufbau mitgeladen, sondern lazy über einen "Compute
Roles"-Button, skaliert auf die aktuell gefilterte Monsterliste statt den
kompletten Kompendium-Bestand. Rohstats bleiben für die Session gecacht;
die Rollen-ZUORDNUNG selbst wird bei jedem Aufruf frisch aus der aktuellen
Population neu berechnet, da Perzentile von den gerade aktiven
Kompendien abhängen.

**UI-Integration**: ein Rollen-Filter-Dropdown reiht sich in die
bestehenden CR/Type/Size/Subtype/Habitat-Filter ein (vor dem ersten
"Compute Roles"-Klick liefert ein aktiver Rollen-Filter bewusst 0 Treffer
statt den Filter zu ignorieren). `autoFillEncounterWithRoles()` in
`auto-fill.js` erweitert Auto-Fill um feste Zahlenfelder pro Rolle ("2
Brute + 2 Skirmisher") — reservierte Slots ziehen nur aus dem
rollen-gefilterten Pool, überschüssige Slots (Desired Count minus Summe
der Constraints) füllen sich unbeschränkt aus dem Gesamt-Pool. Jede Gruppe
bekommt einen Budget-Anteil proportional zu ihrer Slot-Zahl aus dem
ursprünglichen Gesamtbudget. Ignoriert im Boss-Mode.

## 7. Loot-System

Drei getrennte, reine Tabellen-Module plus eine Foundry-Klebeschicht:

- **`treasure-tables.js`** — die offizielle DMG-Treasure-Hoard-Tabelle.
  Münzen: festes Würfel-Rezept pro CR-Tier (0-4/5-10/11-16/17+), z.B.
  `[6,6,100]` = "6d6 × 100". Gems/Art/Magic-Items: gewichtetes
  Band-System (`TREASURE_BANDS`), eine vereinfachte, aber
  wahrscheinlichkeits-treue Nachbildung der d100-Tabelle aus dem Buch.
- **`individual-treasure-tables.js`** — kleinere, separate Tabelle: nur
  Münzen (inkl. Electrum), für **ein einzelnes** Monster statt einen
  großen Fund. Wird einmal pro Kreatur in der Encounter-Auswahl gewürfelt
  und aufsummiert.
- **`smoothed-loot-tables.js`** — Hausregel-Ergänzung (nicht RAW): glättet
  die 4 breiten DMG-Tiers auf einzelne Charakterstufen (1-20) durch
  logarithmische Interpolation zwischen den 4 Tier-Mittelwerten.
  `RARITY_MIN_LEVEL` sperrt Very Rare hart unter Level 5 und Legendary hart
  unter Level 11, unabhängig davon, was die reine Interpolation ergäbe.
- **`item-categories.js`** — bildet dnd5e's Item-Typ/Subtyp-Schema auf
  DMG-Sprachgebrauch ab (Weapon/Armor/Ring/Rod/Wand/Wondrous Item/Loot),
  da dnd5e selbst kein einzelnes Feld dafür hat. Treibt den Item-Typ-Filter
  in beiden Loot-Tabs.
- **`loot-generator.js`** — die Foundry-Klebeschicht: löst die reinen
  Zahlen aus den drei Tabellen-Modulen in **echte Items** aus den
  GM-Kompendien auf (`resolveMagicItems`), erstellt am Ende einen echten,
  aber unsichtbaren Actor + Token (`createLootActor`, per
  `pickCanvasPoint()` platziert wie bei Create Combat) — bewusst **nie**
  als Combatant hinzugefügt, da Loot nicht kämpft. Reroll gibt es auf zwei
  Ebenen: `rerollMagicItems` ersetzt alle gerollten Hoard-Items auf einmal,
  `rerollSingleItem` (per stabilem `key`) ersetzt gezielt genau eines und
  wirft dabei eine evtl. vorhandene Item-Customize-Anpassung weg, da die
  auf das alte Item zugeschnitten war. Wendet beim Materialisieren auch
  eine evtl. gesetzte Item-Customization an (siehe Abschnitt 8).

Jeder Plan-Eintrag (Hoard- wie Individual-Treasure-Liste) trägt ein
stabiles `key`-Feld (`foundry.utils.randomID()`), nicht nur die `uuid` —
nötig, seit ein Stack (mehrere Kopien desselben Items) durch Customize in
eine unveränderte und eine angepasste Kopie aufgespalten werden kann und
beide dieselbe `uuid`, aber unterschiedliche `key`s tragen.

## 8. Item Customize (`item-customization.js`, `item-customize-dialog.js`)

Homebrew-Dialog (verfügbar über einen "Customize…"-Button je Loot-/Hoard-
Zeile mit Kategorie Weapon oder Armor), der ein generisches Item vor dem
Materialisieren individualisiert:

- Eigener Name und Beschreibung (ersetzt die Basis-Beschreibung komplett,
  statt sie zu ergänzen).
- Fester Magic-Bonus (+1/+2/+3) — schreibt je nach Kategorie auf
  `system.magicalBonus` (Waffen/Ringe/Ruten/Stäbe/Wondrous Items) oder das
  verschachtelte `system.armor.magicalBonus` (Rüstung/Schild) — ein echter
  dnd5e-Schema-Unterschied, dessen Verwechslung ein stiller No-op wäre.
  Verhindert eine versehentliche Abwertung eines bereits vorhandenen
  höheren Bonus.
- Bis zu zwei zusätzliche Schadenstypen (Waffen, je ein neuer
  `damage.parts`-Eintrag an der Attack-Activity) oder Resistenztypen
  (Rüstung, je ein neuer Active Effect mit `system.traits.dr.value`).
- Eine "Requires Attunement"-Checkbox (`system.attunement`, echtes
  String-Feld, kein Boolean).
- Eine automatisch vorgeschlagene, aber jederzeit überschreibbare Rarity
  (`suggestRarity()`, eigene Hausregel-Formel: jeder Bonus-Punkt plus jedes
  aktivierte Extra zählt eine Stufe, Rüstung bekommt zusätzlich einen
  festen Offset — kalibriert gegen die echten 2024-Template-Magic-Items,
  nie eine Abwertung ggü. der Basis-Rarity).
- Ein automatisch vorgeschlagener, aber überschreibbarer Name
  (`suggestItemName()`), der sich abschaltet, sobald der GM selbst tippt.

Angewendet wird die Customization erst beim Materialisieren (`"Place
Loot"`, in `loot-generator.js`), nicht sofort beim Schließen des Dialogs —
bis dahin ist ein Plan-Eintrag nur eine leichte Vorschau, noch kein echtes
Foundry-Item.

## 9. Party-Actor-Sync

- **Datenquelle**: `game.actors.party` (dnd5e-System) liefert den vom GM
  markierten Party-Actor oder `null`. `party.system.playerCharacters`
  liefert die Charaktere darin.
- **Anwesenheits-Teilmenge**: zählt zuerst, wie viele Roster-Mitglieder
  einen Token auf der **aktiven Szene** haben, und nimmt bei Treffern nur
  deren Anzahl/Level (gleiche Rundungslogik wie dnd5e's eigener
  `GroupData#level`-Getter). Fällt auf die volle Roster-Liste zurück, wenn
  niemand vom Roster einen Token auf der Szene hat (Planung vor dem
  Platzieren, oder Theater-of-the-Mind).
- **Design-Entscheidung — einmalig, nicht bei jedem Rendern**: Foundry
  rendert die App bei jeder kleinen Änderung neu. Ein Sync bei **jedem**
  Rendern würde jede manuelle Party-Level/Size-Eingabe sofort wieder
  überschreiben. Deswegen: `#partyAutoSynced` ist ein Flag, das den Sync
  nur **einmal** beim ersten Öffnen auslöst; `_onClose` setzt es zurück,
  damit ein Wiederöffnen erneut synct.
- **Einstellung**: `autoSyncParty` (Modul-Setting) schaltet dieses
  automatische Verhalten ganz ab, falls gewünscht.

## Modul-Settings

Unter Game Settings → Configure Settings → Module Settings (alle
client-gebunden, `scope: "client"`, damit in Mehr-GM-Welten niemand die
Einstellungen der anderen überschreibt):

- **Auto-sync Party Level/Size from Party actor** (An/Aus, Standard: An)
- **Default Difficulty** (Low/Moderate/High, Standard: Moderate)
- **Default Loot Basis (Treasure Hoard tab)** (Tier RAW / Match Party
  Level, Standard: Tier RAW)
- **Default Encounter HP** (RAW/Minroll/Maxroll, Standard: RAW) — Start-
  wert des Encounter-HP-Modus bei jedem Öffnen der App.
- **Default Boss Encounter** (An/Aus, Standard: Aus) — ob die "Boss
  Encounter"-Checkbox beim Öffnen bereits angehakt ist.
- **Boss-ify / Minion-ify Values** (eigener Settings-Menu-Eintrag statt
  einer einfachen Zeile) — öffnet `ScalingSettingsApp`: Tier-Prozentsätze/
  AC-/Ability-Boni für Moderate/High/Deadly (RAW bleibt fix), Minion-ifys
  XP-Rabatt-Prozentsatz, und (seit 2026-08) den Budget-Anteil, den Boss
  Encounter-Modus dem Boss reserviert (Standard 75%, `DEFAULT_BOSS_SHARE`
  in `auto-fill.js` — vorher ein reiner Funktions-Default ohne jede
  UI-Anbindung).

Zusätzlich mehrere `config:false`-Settings ohne eigenen Eintrag in dieser
Liste (client-gebunden, außer wo vermerkt): `disabledMonsterCompendiums`/
`disabledLootCompendiums` (welche Kompendien der GM abgewählt hat),
`bossifyTierConfig`/`minionXpMultiplier`/`bossBudgetSharePercent`
(Rohdaten hinter dem Menü oben), und `encounterPresets` (**world-
gebunden** — geteilter Inhalt, keine persönliche Einstellung).
