# AP04b: Evidenzbasierte taktische Rollen

Stand: 10.11.2026 · Branch `develop/gm-assistant-handoff`

## Datenfluss und Umfang

`scripts/tactical-roles.js` ist reine Logik ohne Foundry-Abhängigkeiten. `extractTacticalCapabilities(actor)` normalisiert Actor-Items und dnd5e-Activities aus Arrays, Sets, einfachen Objekt-Maps und Foundry-Collections (`contents`). Jede erkannte Fähigkeit enthält einen Pfad zum Item/Activity-Feld. `classifyTacticalRoles(actor)` liefert alle sechs Rollen mit Status, Begründung und Evidenz, dazu eine mögliche Hauptrolle, Zähler und einen deterministischen Quell-Fingerabdruck.

`EncounterBuilderApp` lädt vollständige Actors nur nach explizitem Klick auf **Inspect Tactical Roles** für den aktuell gefilterten Pool. Ergebnisse liegen im App-Speicher; bereits erkannte UUIDs werden bei erneutem Inspect wiederverwendet. **Refresh Tactical Roles** lädt den aktuellen gefilterten Pool neu und prüft damit auch gespeicherte Korrekturen auf geänderte Quelldaten. Fehler eines Actors werden protokolliert und übersprungen. Die bestehenden Rollen Brute/Tank/Skirmisher/Cleric/Caster, deren Filter und Auto-Fill-Constraints bleiben unverändert. Taktische Rollen verändern weder XP noch Auto-Fill.

## Rollenregeln

| Rolle | Belegt | Wahrscheinlich / Grenzen |
|---|---|---|
| Defender | Strukturierter Verbündeten-Effekt mit ausdrücklich erkennbarem Schutz | Hohe AC bleibt als Begründung sichtbar, ergibt allein aber `Unklar` und keine Defender-Zuordnung |
| Brute | Derzeit keine automatische Belegt-Regel | HP ab 60 plus strukturierter Nahkampfangriff ergibt Wahrscheinlich; feste Schwelle, kein CR-Vergleich |
| Skirmisher | Derzeit keine automatische Belegt-Regel | Eng erkannte Bonusaktions-Mobilität in Item-Beschreibung plus Angriff ergibt Wahrscheinlich |
| Artillery | Strukturierter Fernkampfangriff mit Schaden und mindestens 30 ft Reichweite | Kürzere/fehlende Fernreichweite ergibt höchstens Wahrscheinlich; Reichweite wird nicht aus Fluff erschlossen |
| Controller | Strukturierter Activity-/Item-Effekt nennt einen Zustand | Flächen-Save mit Template ergibt Wahrscheinlich, da Fläche keine Kontrollwirkung beweist |
| Support | Strukturierte Heal-Activity oder Verbündeten-Ziel | Verbündeten-Buff-Erkennung verlangt strukturierte Zielinformation; defensive Wirkung kann Defender zusätzlich belegen |

Nicht genügend Daten ergeben `Unklar`; unbekannte Daten werden nicht als Abwesenheit gewertet. Ein Hauptrollenwert wird nur bei genau einer Rolle mit Belegt/Wahrscheinlich gesetzt. Alternativangriffe werden nicht addiert: als Schadenshinweis dient die höchste Formel, nicht die Summe. Die Werte lesen Würfel und feste Zahlen; dynamische dnd5e-Ausdrücke, Multiattack-Sequenzen, Trefferwahrscheinlichkeit, Saves und tatsächliche Zugökonomie werden nicht modelliert.

## Manuelle Korrekturen

`tacticalRoleOverrides` ist ein `world`-scoped Modul-Setting, keyed by Actor/Compendium UUID. Nur GMs können über **Edit Roles** eine komma-separierte Rollenliste speichern. Eine Speicherung ändert keine Actor-/Item-Dokumente und keine Compendium-Quelle. Der automatische Befund bleibt im Session-Cache sichtbar bzw. über erneute Analyse wiederherstellbar. Der gespeicherte Signaturwert wird gegen eine erneute Analyse verglichen; bei Abweichung erscheint **possibly outdated**, der Override bleibt bis zum Zurücksetzen aktiv. Ohne Actor-Daten ist keine Signaturprüfung möglich.

## Evidenz und Grenzen

Die reale Datenformen-Stichprobe und konkrete Beispiele (Goblin, Mage, Priest, Adult Black Dragon, Mummy) sind im [AP04a-Audit](AP04A_MONSTER_DATA_AUDIT.md) dokumentiert. Sie ist gezielt, nicht statistisch repräsentativ. Die hier verwendeten festen Schwellen und Text-Erkennung für Bonusaktions-Mobilität sind heuristisch; Status `Wahrscheinlich` macht diese Grenze sichtbar. Recharge/Uses werden gesammelt, aber steuern keine Rolle. Resistances, taunts, forced movement, counterspell, multiattack, Legendary Actions, spells-in-prose und taktische AI werden noch nicht zuverlässig abgebildet.

## Verifikation und Live-Abnahme

- Automatisierte Suite: `node --test tests/tactical-roles.test.mjs tests/assistant-handoff.test.mjs` — 21/21 bestanden.
- Syntaxprüfungen für `scripts/tactical-roles.js`, `scripts/main.js` und `scripts/encounter-builder-app.js` bestanden; Handlebars-Blöcke in `templates/encounter-builder.hbs` ausgeglichen (122 öffnend/122 schließend); `git diff --check` wird vor Commit erneut ausgeführt.
- Browser-Liveprüfung in `encounter-builder-test` mit Foundry V14.369 und dnd5e 6.0.6. Der explizite Inspect-Lauf verarbeitete den gefilterten Pool mit 668 Actors bis zum Abschluss. Beim Goblin `Compendium.dnd5e.monsters.TjWQOgI3A4UAl7lC` zeigte die UI Skirmisher: Wahrscheinlich (Nimble Escape plus Angriff) und Artillery: Belegt (strukturierter Shortbow-Angriff mit Reichweite/Schaden); übrige Rollen blieben Unklar. Tooltip zeigte die Evidenzpfade.
- In derselben UI wurden für den Goblin vorübergehend Brute und Support als Override gespeichert. Eine Foundry-Makroabfrage bestätigte die Speicherung samt Signatur im world-scoped Setting `tacticalRoleOverrides`. Danach wurde der Override über Edit Roles zurückgesetzt. Dies prüft die UI und Persistenz im selben Client; eine getrennte Mehr-GM-Sichtprüfung wurde nicht vorgenommen.
- Die temporär ersetzte portable Modulkopie wurde anschließend vollständig aus der Sicherung wiederhergestellt. SHA-256-Baumvergleich: 32 Dateien in Sicherung und Ziel, 0 Abweichungen; der nur im Branch vorhandene Handoff-Helper ist in der portable Kopie nicht verblieben. Das ursprüngliche Makro der Testwelt wurde ebenfalls wiederhergestellt. Es wurden keine Actor-, Token- oder Combat-Dokumente verändert.

Die Live-Stichprobe belegt die Ausführung und Anzeige, nicht die fachliche Richtigkeit jeder Rolle für alle 668 Actors. Klassifikationsregeln und bekannte Heuristikgrenzen stehen oben; vollständige Testwelt- oder Mehr-GM-Abdeckung wird nicht behauptet.
