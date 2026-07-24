# Architektur-Überblick

Diese Datei fasst zusammen, wie das Modul aufgebaut ist und warum zentrale
Design-Entscheidungen so getroffen wurden — als Referenz für spätere
Rückfragen (z.B. im Rahmen der Foundry-Package-Einreichung), unabhängig vom
Chat-Verlauf, in dem das ursprünglich erarbeitet wurde.

## 1. Grundaufbau

Drei Kern-Bausteine:

- **`scripts/main.js`** — Startpunkt. Registriert die Modul-Settings, hängt
  den "Encounter Builder"-Button in die Combat-Sidebar (`renderCombatTracker`
  Hook), macht die App über ein Macro-API verfügbar
  (`game.modules.get(...).api.open()`).
- **`scripts/encounter-builder-app.js`** — das Herzstück. Die eigentliche
  Foundry-`ApplicationV2`, verwaltet den kompletten UI-Zustand (ausgewählte
  Monster, aktive Filter, Loot-Pläne) und reagiert auf Nutzer-Aktionen.
- **`templates/encounter-builder.hbs`** — die Handlebars-Vorlage. Beschreibt
  die Struktur des Fensters; die App füllt sie über `_prepareContext()` mit
  Daten.

Alle anderen `scripts/*.js`-Dateien sind reine Rechen-/Datenmodule ohne
Foundry-API-Abhängigkeit (`xp-budget.js`, `treasure-tables.js`,
`individual-treasure-tables.js`, `smoothed-loot-tables.js`, `auto-fill.js`,
`pack-grouping.js`, `format.js`, `token-placement.js`) — die lassen sich
isoliert mit `node --check` bzw. eigenen Testskripten prüfen, unabhängig von
einer laufenden Foundry-Instanz.

## 2. XP-Budget-System (`xp-budget.js`)

Reine Mathematik nach dem 2024-DMG-System:

- `XP_BUDGET_PER_CHARACTER`: feste Tabelle, XP-Wert pro Charakterstufe
  (1-20) für drei Schwierigkeitsgrade (Low/Moderate/High).
- **Keine Gruppengrößen-Multiplikatoren** mehr (Unterschied zu den
  2014-Regeln) — Budget = Wert-pro-Charakter × Party-Größe, direkt.
- `CR_TO_XP`: feste Tabelle, bildet Challenge Rating auf den offiziellen
  XP-Wert ab. Wird gebraucht, weil Foundrys leichte
  Kompendium-Vorschaudaten (siehe Abschnitt 3) den XP-Wert oft nicht
  mitliefern — der wird von Foundry normalerweise erst zur Laufzeit aus dem
  CR abgeleitet, was bei den Vorschaudaten nicht passiert.
- `computeBudget()`, `evaluateSpend()`, `xpForChallengeRating()` — die drei
  zentralen Funktionen, die aufeinander aufbauen.

## 3. Kompendium-Lesen (`compendium-browser.js`)

**Zwei Ladestufen:**

1. `pack.getIndex({fields: [...]})` — leichte Vorschau (Name, Bild, CR, Typ)
   für **alle** Monster eines Kompendiums auf einmal, schnell. Füllt die
   durchsuchbare Liste.
2. `loadFullActor(uuid)` → `fromUuid()` — lädt das **komplette**
   Actor-Dokument erst dann, wenn ein Monster tatsächlich in ein Combat
   importiert wird. Teurer, deswegen erst im letzten Moment.

Weitere wichtige Stellen:

- `isMonsterEntry(entry)`: filtert auf Typ `"npc"` mit gesetztem CR-Wert —
  Spielercharaktere/Fahrzeuge im selben Kompendium fallen raus.
- `normalizeHabitat(raw)`: das Habitat-Feld-Format war beim Schreiben nicht
  sicher bekannt (Array? Set? `{value}`-Objekt?) — die Funktion prüft
  mehrere mögliche Formen ab und gibt im Zweifel eine leere Liste zurück,
  statt abzustürzen. Als "unbestätigt" dokumentiert.

## 4. Encounter-Tab-Ablauf

- **Zustand**: `this.encounter` ist eine `Map`, Schlüssel = Monster-UUID,
  Wert = `{monster, count, inLair}`. Eine Map statt Array, damit dieselbe
  Kreatur mehrfach vorkommen kann (`count` hochzählen statt Duplikate).
- **Hinzufügen vs. Ansehen**: pro Monster-Zeile zwei getrennte
  Klick-Ziele — Name → `#onViewMonster` (öffnet Stat-Block via
  `fromUuid()` + `.sheet.render()`), separater "+"-Button →
  `#onAddMonster`. Foundry löst beim Klick den **nächstgelegenen**
  `data-action`-Handler auf, deswegen kollidieren beide nicht.
- **Filter**: sechs unabhängige, UND-verknüpfte Filter
  (`#matchesSelectFilters`). Die Dropdown-Optionen selbst werden jeweils
  **ohne** den eigenen Filter berechnet (`#getMonstersExcluding`), damit
  eine Auswahl die eigene Options-Liste nicht leerlaufen lässt.
- **Auto-Fill**: `autoFillEncounter()`/`autoFillBossEncounter()` aus
  `auto-fill.js` — greedy Algorithmus, wählt pro Slot unter den
  nächstpassenden Kandidaten zufällig aus, damit nicht immer dieselbe
  Kombination entsteht.
- **Lair Actions**: Checkbox setzt `entry.inLair = true`;
  `#getEffectiveXp()` rechnet dann mit `CR+1` statt normalem CR für die
  Budget-Anzeige — nur bei Monstern mit `hasLairActions === true`.
- **Create Combat**: importiert ausgewählte Monster als World-Actors
  (Wiederverwendung über ein Flag beim erneuten Hinzufügen), platziert
  Tokens spiralförmig (`computeSpiralPositions()` in
  `token-placement.js`), erstellt daraus ein Combat.

## 5. Loot-System

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
  logarithmische Interpolation zwischen den 4 Tier-Mittelwerten (da die
  Tiers bereits ~10x pro Stufe springen). **Wichtigster Programmpunkt**:
  `RARITY_MIN_LEVEL` sperrt Very Rare hart unter Level 5 und Legendary
  hart unter Level 11, unabhängig davon, was die reine Interpolation
  ergeben würde — behebt einen gefundenen Bug (Legendary-Items bereits bei
  Level 9).
- **`loot-generator.js`** — die Foundry-Klebeschicht: löst die reinen
  Zahlen aus den drei Tabellen-Modulen in **echte Items** aus den
  GM-Kompendien auf (`resolveMagicItems`), erstellt am Ende einen echten,
  aber unsichtbaren Actor + Token (`createLootActor`) — bewusst **nie**
  als Combatant hinzugefügt, da Loot nicht kämpft.

## 6. Party-Actor-Sync

- **Datenquelle**: `game.actors.party` (dnd5e-System) liefert den vom GM
  markierten Party-Actor oder `null`. `party.system.playerCharacters`
  liefert die Charaktere darin, `party.system.level` den gerundeten
  Stufen-Durchschnitt. Gegen den dnd5e-Quellcode auf GitHub verifiziert,
  nicht geraten.
- **Design-Entscheidung — einmalig, nicht bei jedem Rendern**: Foundry
  rendert die App bei jeder kleinen Änderung neu. Ein Sync bei **jedem**
  Rendern würde jede manuelle Party-Level/Size-Eingabe sofort wieder
  überschreiben. Deswegen: `#partyAutoSynced` ist ein Flag, das den Sync
  nur **einmal** beim ersten Öffnen auslöst; `_onClose` setzt es zurück,
  damit ein Wiederöffnen erneut synct.
- **Einstellung**: `autoSyncParty` (Modul-Setting) schaltet dieses
  automatische Verhalten ganz ab, falls gewünscht.

## Modul-Settings

Unter Game Settings → Configure Settings → Module Settings:

- **Auto-sync Party Level/Size from Party actor** (An/Aus, Standard: An)
- **Default Difficulty** (Low/Moderate/High, Standard: Moderate)
- **Default Loot Basis (Treasure Hoard tab)** (Tier RAW / Match Party
  Level, Standard: Tier RAW)

Alle drei sind client-gebunden (`scope: "client"`), damit in
Mehr-GM-Welten niemand die Einstellungen der anderen überschreibt.
