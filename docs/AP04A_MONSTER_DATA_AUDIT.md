# AP04a – Foundry-Monsterdaten und taktische Rollenerkennung

Stand: 10.11.2026  
Repository: `ElmiMage/encounter-builder-2024`  
Branch: `develop/gm-assistant-handoff`  
Codebasis: `eaa95da9aa84d7b1afc597eb06f003dc37dfd8ac`  
Live-Umgebung: Foundry VTT 14.369, dnd5e 6.0.6

## Ergebnis in Kürze

Die installierten dnd5e-Dokumente enthalten deutlich mehr brauchbare taktische Daten als die aktuelle Rollenerkennung nutzt: Waffen- und Zauberangriffe, Schadensformeln, Reichweiten, Rettungswürfe, Ziel-/Flächenfelder, Heilaktivitäten, Wiederaufladung und zum Teil zugeordnete Status-Effekte sind strukturiert vorhanden. Die Abdeckung ist aber uneinheitlich. Multiattack-Zahlen, Bewegungs-/Kontrollbeschreibungen und manche Zauberflächen stehen nur in Beschreibungen. Ein fehlender strukturierter Wert beweist daher nicht, dass ein Monster die Fähigkeit nicht hat.

Die bestehenden Tags sind relative Statistiken, keine verlässlichen Kampffunktionslabels. Besonders `Skirmisher` bedeutet derzeit hohes aufsummiertes Attack-Schadenspotenzial relativ zu HP; es misst keine Bewegung oder Hit-and-Run-Fähigkeit. Die gewünschten Rollen Defender, Brute, Skirmisher, Artillery, Controller und Support lassen sich mit einer evidenzgestützten, mehrteiligen Erkennung besser abbilden, aber nicht alle gleich zuverlässig.

## Umfang und Verfahren

Vor der Prüfung wurden Welt und Laufzeit direkt in der Foundry-Browserwelt bestätigt: ID `encounter-builder-test`, Titel `Encounter Builder – AP03 Test`, Foundry `14.369`, System `dnd5e 6.0.6`. Der Encounter Builder war aktiv; GM Assistant und Guild Quest waren inaktiv. Drei Actor-Packs waren geladen.

In einem nur lesenden Foundry-Makrolauf wurden vollständige Actor-Dokumente aus `dnd5e.monsters` und `dnd5e.actors24` sowie alle vier NPCs der isolierten Testwelt ausgewertet. Die Stichprobe umfasste 22 verschiedene Compendium-NPCs und 4 World-Actors (26 insgesamt). Die Compendium-Auswahl deckte CR 1/4 bis 14 sowie Nahkampf, Fernkampf, Zauber, Mehrfachangriffe, Flug/Schwimmen, Flächenangriffe, Heilung, Kontroll- und begrenzte Fähigkeiten ab. Zwei gewünschte Namens-Treffer (Archer, Mind Flayer) waren in den geladenen Packs nicht exakt vorhanden; der Hobgoblin Captain und Scout lieferten Fernkampfbeispiele.

Compendium-Stichprobe: Adult Black Dragon, Assassin, Bandit Captain, Berserker, Black Bear, Druid, Giant Eagle, Goblin, Hobgoblin Captain (`dnd5e.actors24`), Mage, Mummy, Owlbear, Priest, Scout, Spy, Troll, Vampire, Wolf, Zombie, Air Elemental, Merrow und Awakened Tree. Die vier World-Actors waren `AP03 Goblin`, `AP03 Goblin Variant`, `AP03c Goblin Alpha` und `AP03c Goblin Beta`; sie sind AP03-Testdaten, keine repräsentativen Homebrew-Beispiele. Alle vier hatten 0 maximale HP und keine Items; daraus lässt sich nur die Form unvollständiger World-Actors ableiten.

Die Stichprobe ist gezielt und klein, keine Zufallsstichprobe. Sie belegt Datenformen und konkrete Gegenbeispiele, aber keine Häufigkeit im gesamten Foundry-Content. Es wurden keine Actors, Items, Tokens oder Combats verändert/erzeugt. Der bestehende AP03-Testmakroinhalt wurde nach dem Audit wiederhergestellt.

In den 22 Compendium-Actors wurden 141 Items gezählt: 61 Feats, 37 Waffen, 8 Ausrüstungsstücke und 35 Zauber. Ihre Activities umfassten 128 Instanzen: 44 Utility, 43 Attack, 23 Save, 7 Damage, 4 Heal, 3 Check, 2 Summon, 1 Enchant und 1 Transform. 42 von 43 Attack-Activities hatten gelabelte Schadensformeln; 10 Activities trugen einen nichtleeren Ziel-Template-Typ. Diese Stichprobenzahlen sind keine Content-weite Quote.

## Datenverfügbarkeitsmatrix

| Merkmal | Foundry-Datenquelle | Verfügbarkeit | Zuverlässigkeit | Mögliche Rolle |
|---|---|---|---|---|
| CR, HP, AC | `Actor.system.details.cr`, `system.attributes.hp.max`, `system.attributes.ac.value` | Auf vollständigen NPC-Dokumenten strukturiert; bei unvollständigen World-Actors können valide Zahlen wie 0 bzw. Standard-AC 10 auftreten. | Gut strukturiert, aber Werte auf Plausibilität prüfen. | Brute/Defender als statistische Hinweise, nie allein Rollenbeweis. |
| Bewegung | `system.attributes.movement.speeds` (walk, fly, swim, climb, burrow, jump) | Strukturierte Zahlen; z.B. Adult Black Dragon fly 80/swim 40, Giant Eagle fly 80, Merrow swim 40. Leere Felder erscheinen oft als 0. | Gut für vorhandene Geschwindigkeit; nur teilweise aussagekräftig für taktische Nutzung. | Skirmisher, Defender/Engager, Flug-/Spezialbewegungs-Hinweis. |
| Angriff, Schaden, Reichweite | `Item.system.activities.contents` mit `type: attack`, `attack`, `damage.parts`, `range`; abgeleitete `activity.labels.damage` | In 42/43 Attack-Activities mit Schadensformeln vorhanden. Goblin Scimitar `1d6+2`, Shortbow `1d6+2`; Mage Fire Bolt `2d10`; Priest Guiding Bolt `4d6`. | Gut für eine einzelne Activity; Aktionsökonomie und Auswahl zwischen Alternativen fehlen. | Brute, Artillery, Reichweiten-/Schadenssignale. |
| Rettungswurf und Fläche | Save-Activity: `save.ability`, `save.dc`, `damage.onSave`, `target.affects`, `target.template`, `range` | Strukturiert, wenn gepflegt. Adult Black Dragon Acid Breath: DEX-Save, 60-ft-Line × 5 ft, `12d8` Säure, halber Schaden bei Erfolg. | Teilweise zuverlässig: Fireball-Beschreibung enthält 20-ft-Radius, im gespeicherten Sample war der Activity-Template-Typ jedoch leer. | Controller, Artillery, Flächenschaden. |
| Zustände und Effekte | Activity-`effects`-Referenzen und eingebettete `Item.effects` mit `statuses`/`changes`; teils `system.traits.ci` | Direkt auswertbar, wenn als Foundry-Effekt gepflegt. Mummy Dreadful Glare referenziert Effekte „frightened“ und „paralyzed“; Rotting Fist hat „cursed“/Mummy-Rot-Effekt. | Gut bei expliziten Effekten, sonst nur Beschreibung oder unbekannt. | Controller, Defender, Support. |
| Heilung | `Activity.type: heal`, Activity-`healing`; außerdem Beschreibung | Vier Heal-Activities in der Stichprobe. Priest Cure Wounds ist als `heal` strukturiert; Activity-Schema enthält ein `healing`-Feld. Troll-Regeneration steht primär in Featuretext. | Teilweise zuverlässig; automatische Heilung/Regeneration kann als Freitext vorliegen. | Support, Selbstheilungs-/Langlebigkeits-Hinweis. |
| Buffs/Schutz/Verbündete | Activity `target.affects`, Activity/Item-Effekte, Beschreibung | Einzelne Fälle klar strukturiert: Priest Divine Eminence hat Item-Effekte auf `system.bonuses.mwak.damage`; Hobgoblin Captain Aura zeigt Ally-Ziel und Radius, Wirkungstext bleibt Beschreibung. Sanctuary hat Save-Activity und Textwirkung. | Teilweise strukturiert, semantischer Zusammenhang nicht immer maschinenlesbar. | Support, Defender. |
| Spellcasting | `system.attributes.spellcasting`; `Item.type === "spell"`; Zauber-Level, Schule, Activities und Beschreibung | Ability und echte Zauberitems vorhanden, aber getrennte Signale. Mummy hatte `spellcasting: int` bei null Zauberitems; Mage `int` mit 16, Priest `wis` mit 10. | Ability allein unzuverlässig; echte Items/Activities sind stärker, aber nicht gleichbedeutend mit einer taktischen Rolle. | Caster, Support, Controller, Artillery. |
| Multiattack / Aktionsökonomie | Feat-Items, `system.resources.legact`, Activity-Uses, Beschreibungen | Mehrfachangriffszahl steht in Beispielen wie Troll „three attacks“ oder Adult Dragon „three attacks“ im Beschreibungstext. Das Multiattack-Item hat eine Utility-Activity, aber keine strukturierte Attack-Sequenz/-Anzahl. Legendary-Resource ist separat strukturiert. | Teilweise; verlässliche Erkennung braucht Verknüpfung/Parsing oder manuelle Korrektur. | Brute, Artillery, Controller und allgemeine Bedrohung. |
| Recharge / begrenzte Nutzungen | `Item.system.uses` mit `max`, `recovery`, `period`, `formula`; Activity `uses`/`consumption`; Ressourcen | Adult Dragon Acid Breath: Item-Label „Recharge 5–6“ und Recovery-Daten mit `period: recharge`, `formula: 5`. In der Stichprobe hatten 5 Items Uses/Recovery-Daten. | Gut, wenn eingetragen; keine universelle Abdeckung. | Burst-/Controller-/Artillery-Gewichtung und Priorisierung. |
| Beschreibungen | `Item.system.description.value`, Activity-Beschreibungen | Sehr oft vorhanden (140/141 Compendium-Items), enthalten aber Foundry-Enriched-Text, UUID-/Lookup-Makros, Referenzen und Prosa. | Nur heuristisch; einfache Schlüsselwortsuche produziert Fehlalarme und Auslassungen. | Alle Rollen als erklärender Hinweis, nicht alleiniger Beweis. |
| Resistenzen/Immunitäten/Saves | `system.traits.dr/di/ci.value`, `system.abilities.*.proficient/save` | Strukturiert; dnd5e-Modelle können Werte als Sets/Collections liefern. Mummy: physische Resistenzen, nekrotische/giftige Immunität und mehrere Zustandsimmunitäten. | Gut bei korrekter Collection-Normalisierung; leer bedeutet nur „nicht eingetragen“. | Defender/Langlebigkeit, nicht Schutzfunktion für Verbündete. |

## Bewertung der sechs taktischen Rollen

| Rolle | Direkt nachweisbar | Statistische/heuristische Hinweise | Einschränkung |
|---|---|---|---|
| **Defender** | Ally-Ziele, Schutz-/Aura-Effekte, Reaktions-/Schutz-Activities und explizite Status-/Bonusänderungen, sofern eingetragen. | HP/AC, Resistenzen, Blockier- oder Nahkampf-Reichweite. | Hohe AC/HP beweisen weder Schutz für Verbündete noch Raumkontrolle. „Defender“ sollte nur mit einem Schutz-/Bindungsbeleg vergeben werden; andernfalls höchstens Langlebigkeits-Hinweis. |
| **Brute** | Attack-Activities und Schadensformeln, insbesondere Nahkampfreichweite, sind strukturiert. | Hohe HP plus hoher Nahkampfschaden können robuste Nahkampfdrohung stützen. | Das aktuelle Tag misst ausschließlich relativ hohe HP; es kann robuste passive Monster markieren und übersieht fragile Monster mit massivem Nahkampfdruck. |
| **Skirmisher** | Fly/climb/swim/speed und einzelne Utility-Activities sind strukturiert; Goblin Nimble Escape listet Hide/Disengage als Bonusaktionen. | Bewegungswerte, Bonusaktionen und repositionierende Fähigkeiten. | Bewegung allein beweist kein Hit-and-Run-Verhalten. Das aktuelle Tag verwendet Schaden/HP und kann gerade langsame „glass cannons“ als Skirmisher einstufen. |
| **Artillery** | Ranged-Attack `range.long`, Reichweite und Schaden; Save-/Area-Activities und Template, wenn gepflegt. | Fernkampfwaffen und Zauber mit hoher Reichweite/Fläche. | Alternativangriffe und effektive Reichweite hängen von Aktivität, Sicht und Encounter-Position ab. Template-Felder fehlen bei manchen Flächenzaubern trotz explizitem Beschreibungstext. |
| **Controller** | Save-Ability/DC, Status-Effekte, Zieltyp, Dauer, Fläche und Reichweite sind bei gepflegten Activities/Effekten direkt belegbar. Mummy Glare ist ein klares Beispiel. | Namen/Beschreibungen wie Frightful Presence, Entangle oder Suggestion, wenn der Effekt nicht als Statusobjekt vorliegt. | Ein `save` sagt noch nicht, ob es Kontrolle ist; Beschreibung muss ausgewertet werden. Kein Fund eines Status-Effekts ist kein Beleg für „keine Kontrolle“. |
| **Support** | Heal-Activities und explizite Ally-Ziele/Effekte sind direkt erkennbar, wenn strukturiert. | Buff-/Schutztext, Wiederbelebung oder Ressourcenvergabe in Beschreibungen. | Aktivitätsziel und Effekte sind uneinheitlich. Eine Weisheits-Zauberfähigkeit ist kein Support-Beweis. |

Mehrfachrollen sind fachlich sinnvoll: ein Monster kann etwa Artillery + Controller oder Defender + Support sein. Die automatische Erkennung sollte mehrere Evidenz-Tags erlauben; eine primäre Rolle wäre eine sortierte Empfehlung mit Begründung, keine exklusive Klassifikation.

## Vergleich mit der aktuellen Erkennung

Quellen: [monster-role-data.js](../scripts/monster-role-data.js), [monster-roles.js](../scripts/monster-roles.js), [compendium-browser.js](../scripts/compendium-browser.js), [encounter-builder-app.js](../scripts/encounter-builder-app.js).

- Die vorhandenen Brute/Tank/Skirmisher-Tags sind additive Perzentil-Heuristiken: oberes Viertel von HP, AC bzw. Damage-per-HP innerhalb derselben CR-Gruppe. Bei weniger als 20 Monstern wird das CR-Fenster bis ±10 erweitert. Das ist eine relative Rangordnung des gerade aktiven Quellenpools, keine feste Kampffunktionsaussage.
- `Skirmisher` addiert die durchschnittliche Schadensformel jeder `attack`-Activity und dividiert durch HP. Live-Daten zeigen die Grenze: der Goblin wird aus Scimitar **und** Shortbow summiert, obwohl diese alternative Angriffe sind; Attack-Activities von Zaubern werden ebenfalls summiert. Dagegen fließen Save-Schaden aus Mage Fireball und Dragon Acid Breath nicht ein. Multiattack-Mengen, Aktionskosten, Recharge, legendäre Aktionen, Heilung und Kontrollwirkung ändern den Wert nicht.
- `avgFromFormula` versteht einfache Würfel- und Flatterme. Komplexe dynamische Terme/Lookup-Ausdrücke sind nicht allgemein modelliert; der verwendete Activity-Label-Formatter lieferte in den geprüften Beispielen bereits lesbare Formeln, ist aber selbst eine abgeleitete Anzeigequelle.
- `Tank` bedeutet derzeit hohe eigene AC, nicht „schützt andere“. `Brute` ist hohe HP, nicht Nahkampfdruck. Das Wort `Skirmisher` verspricht Bewegung, obwohl das Signal Schaden/HP ist.
- `Cleric` wird aus WIS-Spellcasting und mindestens einem Spell-Item abgeleitet; `Caster` aus INT/CHA plus Spell-Item. Die Prüfung, dass mindestens ein echtes Spell-Item existiert, verhindert den belegten Standardfeld-Fehlalarm (z.B. Mummy hatte INT eingetragen und keine Zauber). Die Rollenzuordnung bleibt fachlich grob: Druid wird als Cleric kategorisiert, obwohl WIS keinen Cleric-/Support-Auftrag beweist; Kleriker mit anderen Fähigkeiten können zugleich Controller/Artillery sein.
- Das leichte Compendium-Index enthält keine Activities/Items. `computeMonsterRoles` lädt deshalb vollständige Actors bei Bedarf. Der Rohwert-Cache ist sitzungsweit; vollständige Actor-Loads laufen sequenziell. Das schont Startzeit und vermeidet Wiederholungen, aber große Pools können beim ersten Compute spürbar dauern. Der Encounter-Builder berechnet nur die aktuell gefilterte Monsterpopulation und berechnet fehlende UUIDs bei späteren Filtern nach.
- Handoff-importierte World-Actors sind nicht Teil des Compendium-Monsterindex. Die vier World-Actors dieser Testwelt waren zudem leere AP03-Testdaten. Die aktuelle Rollenanzeige deckt daher nicht automatisch sämtliche manuellen Encounter-Einträge oder beliebige World-Actors ab.
- Im Repository gibt es zum Auditzeitpunkt keine isolierte Testsuite für `monster-role-data.js`/`monster-roles.js`; die einzige `tests/`-Datei prüft die GM-Assistant-Handoff-Logik. Die pure Rollenlogik ist technisch testbar, aber ihre aktuelle Testabdeckung ist nicht belegt.

## Vorschlag für AP04b – noch keine Entscheidung

1. **Evidenz-Extraktor als getrennte, testbare Schicht:** Aus `Actor`/Items/Activities strukturierte Capability-Datensätze bauen. Collections/Sets normalisieren; nie einen fehlenden Wert mit „false“ verwechseln. Jede Aussage speichert Fundstelle (Actor UUID, Item/Activity-ID, Feld) und Signalqualität.
2. **Signale vor Rollen:** Erst Fähigkeiten wie `meleeAttack`, `rangedAttack`, `areaAttack`, `saveControl`, `conditionApplied`, `heal`, `allyBuff`, `protectAlly`, `mobility`, `limitedUse`, `multiattackText` ausgeben. Strukturiert erkannte und aus Beschreibung erschlossene Signale getrennt halten. Description-Parsing als heuristisch kennzeichnen.
3. **Erklärbare, nicht-exklusive Rollen:** Rollenregeln aus gewichteten Capability-Signalen ableiten. UI zeigt „warum“ und Konfidenz/Quellentyp. Relative Werte wie HP/AC bleiben ausdrücklich statistische Hinweise. Neue sechs Rollen erst anhand konkreter Fälle abstimmen.
4. **Manuelle Korrektur und Persistenz getrennt planen:** Overrides dürfen keine Original-Kompendien oder fremde World-Actors verändern. Vorzugsoption zur Diskussion: sparse, weltweite Modul-Setting-Map nach UUID mit Override/„ignorieren“/Notiz und Daten-Signatur; geänderte Actor-/Compendium-Daten markieren einen Override als möglicherweise veraltet. Alternative ist rein client-lokaler Override. Entscheidung nötig, ob Korrekturen zwischen GMs geteilt werden.
5. **Performance und Cache:** Index bleibt leicht; vollständige Dokumente nur bei Rollenbedarf laden. Begrenzte Parallelität statt unbeschränkter Vollparallelisierung, Promise-Deduplizierung pro UUID und Cache-Invalidierung bei Änderungen/Quellaktualisierung. Fehler/fehlende Actors als „unbekannt“ führen.
6. **Tests in Schichten:** Node-Tests mit echten, minimalisierten Actor-Daten für Extraktion, Rollenregeln, Collection-Formen und falsche/fehlende Werte; danach Browser-Live-Stichprobe in Foundry 14.369/dnd5e 6.0.6. Keine Tests aus diesem AP04a-Lauf behauptet.

## Offene Entscheidungen für die gemeinsame Diskussion

- Sind Defender/Brute/Skirmisher/Artillery/Controller/Support die endgültigen Anzeigenamen, oder sollen Rollen beschreibende Funktionslabels bekommen?
- Sollen Rollen nur bestätigte Fähigkeitsbelege verlangen, oder dürfen statistische Kandidaten zusätzlich sichtbar sein? Wie soll die UI „kein Beleg“ von „keine Fähigkeit“ unterscheiden?
- Wird eine primäre Rolle benötigt, oder reichen sortierte Mehrfachrollen? Falls primär: nach welcher Priorität oder Encounter-Situation?
- Sollen eingebaute Quellenrollen (z.B. MCDM `flags.*.role`) als eine zitierte Quelle angeboten werden, ohne sie mit eigenen Taktikregeln gleichzusetzen?
- Sind manuelle Overrides pro GM oder pro Welt geteilt? Wie soll ein geänderter/gelöschter Compendium-Actor behandelt werden?
- Wie viel Beschreibungstext-Parsing ist wartbar und erwünscht, und welche Fehlerrate ist akzeptabel?

## Prüfgrenzen

Das ist ein gezieltes Audit der live verfügbaren Daten und der aktuellen Quelllogik. Es wurde kein Rollenalgorithmus verändert, keine Versionsangabe geändert und kein Release erstellt. Es ist kein vollständiger Kompendium-Inventarscan und keine statistische Validierung der Rollenhäufigkeiten.
