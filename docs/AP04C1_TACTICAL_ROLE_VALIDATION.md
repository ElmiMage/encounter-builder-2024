# AP04c-1 — Rollenmodell und CR-gestaffelte Validierung

**Stand:** 10.11.2026  
**Branch-Basis:** `develop/gm-assistant-handoff`, `e10f987f05be6289c84e8b64cbd94a016c422511`  
**Foundry-Datenquelle:** isolierte Welt `encounter-builder-test`, Foundry V14.369, dnd5e 6.0.6

## Ergebnis

Die vier Zielgruppen umfassen 100 unterschiedliche, normalisierte Monsternamen aus den aktivierten offiziellen dnd5e-Kompendien. 40 exakt passende CR-Fälle wurden einzeln anhand der exportierten Fähigkeiten und Aktionsbeschreibungen durchgesehen (10 je CR 2/4/6/8). Das ist eine nachvollziehbare Analystenprüfung, keine unabhängige Experten- oder Goldstandard-Bewertung; daraus wird keine Trefferquote abgeleitet.

Die automatische Erkennungsquote stieg auf derselben Stichprobe von 68/100 auf 76/100 (+8 Prozentpunkte); eindeutige Rollen stiegen von 35 auf 38, Mehrfachrollen von 33 auf 38 und nicht ausreichend belegte Fälle sanken von 32 auf 24. Die Quote ist ein Abdeckungsmaß, kein Gütemaß. Die manuelle Durchsicht fand weiterhin Fehlzuordnungsrisiken, besonders zu breite Textsignale bei Defender/Controller und die Verwechslung einer einzelnen Fernkampfoption mit einer prägenden Artillery-Rolle.

## Stichprobe und Verfahren

Der Browserexport erfasste 337 Actors aus `dnd5e.monsters`, 385 aus `dnd5e.actors24` und 0 aus `dnd5e.heroes` (insgesamt 722 Kompendiumseinträge). Nach normalisiertem Namensabgleich blieben 189 unterschiedliche Namen; bei Konflikten wurde `dnd5e.actors24` bevorzugt. Der Export las vorbereitete Actor-Daten, einschließlich abgeleiteter AC, Aktivitäten, Effekte und Beschreibungen.

| Ziel-CR | verfügbare exakte Namen | Stichprobe exakt | Ergänzung benachbarte CR | Stichproben-CRs |
|---:|---:|---:|---:|---|
| 2 | 48 | 25 | 0 | 25 × CR 2 |
| 4 | 17 | 17 | 8 | 3, 3.5, 4.5, 5 |
| 6 | 11 | 11 | 14 | 5, 5.5, 6.5, 7 |
| 8 | 10 | 10 | 15 | 7, 9, 10 |

Auswahl: deterministischer UUID-Hash, rundenweise über Kreaturentypen, ohne doppelte normalisierte Namen; die exakten CR-Kandidaten wurden reserviert, bevor Nachbargruppen ergänzt wurden. Kein CR 4/6/8-Ziel wurde durch Duplikate aufgefüllt. Die verfügbaren exakten CR-Listen sind die Kompendiumsinhalte dieser Testwelt, keine Aussage über alle verfügbaren D&D-Monster.

## Verteilungen der 100 Fälle

Werte je Gruppe: Minimum / P25 / Median / P75 / Maximum. Schaden ist der höchste erkannte Schaden einer einzelnen strukturierten Attack-Formel je Actor, keine DPR-Schätzung.

| CR-Anker (n=25) | HP | AC | Nahkampfschaden | Fernkampfschaden (n) |
|---:|---|---|---|---|
| 2 | 27 / 42 / 45 / 59 / 85 | 6 / 12 / 13 / 15 / 17 | 5.5 / 7 / 8.5 / 12.5 / 20 | 6.5 / 6.5 / 6.5 / 8.5 / 11 (4) |
| 4 | 45 / 58 / 71 / 82 / 120 | 7 / 13 / 15 / 16 / 19 | 7.5 / 9.5 / 12 / 15 / 19.5 | 6.5 / 7.5 / 11 / 13 / 14.5 (8) |
| 6 | 81 / 94 / 110 / 123 / 152 | 9 / 14 / 15 / 17 / 20 | 7 / 10.5 / 13 / 17 / 28 | 11 / 11 / 13.5 / 15 / 17.5 (5) |
| 8 | 85 / 126 / 142 / 162 / 220 | 12 / 15 / 17 / 18 / 18 | 9 / 11 / 15 / 18 / 33 | 9 / 17 / 21 / 22 / 28 (9) |

Die Stichprobe zeigt steigende HP-Mediane (45, 71, 110, 142), aber stark überlappende Bereiche. AC steigt weniger gleichmäßig. Die gemessenen Einzelattacken zeigen keinen stabilen, monotonen CR-Verlauf: Werte hängen stark von Angriffsauswahl, Aktivitätsdaten und Kreaturentyp ab. Das stützt einen lokalen Vergleich als Heuristik, aber keine behauptete CR- oder DPR-Kalibrierung.

## Baseline und neue Regeln

| CR-Gruppe | klassifiziert vorher → nachher | eindeutig vorher → nachher | Mehrfachrollen nachher |
|---:|---:|---:|---:|
| 2 | 13/25 → 17/25 | 10 → 11 | 6 |
| 4 | 18/25 → 21/25 | 11 → 12 | 9 |
| 6 | 16/25 → 19/25 | 6 → 7 | 12 |
| 8 | 21/25 → 19/25 | 8 → 8 | 11 |
| **Gesamt** | **68/100 → 76/100** | **35 → 38** | **38** |

| erkannte Rollenzuordnungen (Belegt + Wahrscheinlich) | AP04b | AP04c-1 |
|---|---:|---:|
| Defender | 0 | 21 |
| Brute | 13 | 11 |
| Skirmisher | 1 | 4 |
| Artillery | 23 | 21 |
| Controller | 60 | 62 |
| Support | 9 | 3 |

Neue Evidenzregeln:

- **Brute:** kein globaler 60-HP-Schwellwert. Vergleich von HP und höchstem Nahkampfschaden innerhalb CR-Bändern; beide müssen mindestens P75 erreichen, mindestens 20 vollständige Vergleichsmonster müssen vorhanden sein. Bänder: 0–2.5, 3–4.5, 5–6.5, 7–10, 11–16, 17+. Fehlende/ungültige CR-Daten nehmen an keinem Band teil.
- **Artillery:** strukturierter, wiederholbarer Fernkampfschaden mit hinreichender Reichweite und relevant gegenüber der Nahkampfoption; begrenzte Fernkampfoptionen können höchstens `Wahrscheinlich` sein. Einzelne Attack-Aktivitäten werden nicht als vollständige Zugfolge/DPR gewertet.
- **Skirmisher:** erfordert ein eng erkanntes explizites Hit-and-run-/Repositionierungssignal und einen strukturierten Angriff; reine Bewegungswerte genügen nicht.
- **Defender:** hohe AC allein genügt nicht; erkannt werden Verbündetenschutz oder enges Gegner-Binden/Fokus-Signal.
- **Controller:** strukturierter Zustand oder gegnerische Bewegungs-/Handlungseinschränkung; reine Schadensflächen reichen nicht.
- **Support:** Verbündetenheilung/-stärkung; Selbstheilung und Selbst-Buffs begründen die Rolle nicht.
- Evidenzsicherheit (`Belegt`/`Wahrscheinlich`/`Unklar`) und taktische Bedeutung (`Main`/`Secondary`/`Possible`) werden getrennt angezeigt. Mehrere Belege bedeuten nicht automatisch mehrere Hauptrollen.

## Manuell geprüfte exakte CR-Fälle

Die 40 Fälle wurden anhand der in Foundry exportierten Aktionen, Effektziele, Reichweiten, Nutzungsbegrenzungen und Beschreibungstexte gegen die obigen Rollendefinitionen geprüft. Die Einschätzung markiert keine normative Wahrheit; unklare Fälle bleiben ausdrücklich strittig.

| CR | einzeln geprüfte Namen |
|---:|---|
| 2 | Gelatinous Cube; Gargoyle; Animated Rug of Smothering; Minotaur Skeleton; Gibbering Mouther; Cultist Fanatic; Awakened Tree; Centaur Trooper; Wererat; Swarm of Poisonous Snakes |
| 4 | Black Pudding; Incubus; Ghost; Chuul; Guard Captain; Bullywug Bog Sage; Weretiger; Hippopotamus; Red Dragon Wyrmling; Ettin |
| 6 | Invisible Stalker; Vrock; Mage; Chimera; Mammoth; Young White Dragon; Pirate Captain; Medusa; Young Brass Dragon; Drider |
| 8 | Chain Devil; Cloaker; Assassin; Hydra; Tyrannosaurus Rex; Young Bronze Dragon; Frost Giant; Spirit Naga; Young Green Dragon; Hezrou |

Konkret auffällige Fälle:

- **Plausible Erkennung:** Engulf/Cube, Smothering/Rug, Prone/Gore/Skeleton und Furcht-/Zustandseffekte bei Ghost/Chuul/Hezrou tragen Controller; Bindung beim Cube, Chuul, Chain Devil und T. Rex ist Defender-nahe Evidenz. Cunning Action beim Assassin ist Skirmisher-Evidenz.
- **Verpasste oder schwache Funktion:** Gargoyle-Flyby und Centaur-Trampling Charge sind Skirmisher-nahe Funktionen, die aktuelle Textmuster nicht zuverlässig genug erfassen. War Cry des Frost Giant stärkt Verbündete, wird wegen der Aktivitäts-/Heal-Datenform nicht zuverlässig als Support erkannt.
- **Mögliche Überzuordnung:** Wererat und Weretiger erhalten Artillery über Fernkampfoptionen, obwohl die Gesamtrolle gegenüber Multiattack/Verwandlungsoptionen nicht eindeutig ist. Breite Zustands-/Textsuche kann Controller bei sehr unterschiedlichen Monstern sekundär erzeugen; Einzelfälle wie Medusa/Drider kombinieren Kontroll- und andere Funktionen. Hohe HP plus Einzel-Nahkampfangriff kann Brute-Nähe anzeigen, aber P75 allein beweist keine primäre Funktion.
- **Bewusst nicht hochgestuft:** Young White/Green/Red/Brass/Bronze Dragons erhalten keinen Artillery-Beleg nur wegen einer Recharge-Atemwaffe. Das ist konsistent mit „wiederholbar“ als Artillery-Kriterium; ihre Breath-Control-Effekte bleiben Controller-Evidenz.

Die Baseline-Verbesserung ist daher keine gemessene Präzision. Besonders die 21 Defender-Hinweise sind sämtlich `Wahrscheinlich`; die 62 Controller-Hinweise enthalten 13 `Wahrscheinlich`. Die UI lässt diese Sicherheit sichtbar und weist `Possible` aus, wenn die Rollenbedeutung nicht eindeutig wird.

## Liveprüfung und technische Grenzen

Browserprüfung ausschließlich in der isolierten Foundry-Testwelt. Die Datenquellen und vorbereiteten Actors ließen sich auslesen; der anschließende UI-Lauf scheiterte daran, dass das Modul im laufenden Browser nicht initialisierte: kein Encounter-Builder-Start-Log, kein Launcher/API und dynamischer Import der App-Datei schlug mit `Failed to fetch dynamically imported module` fehl. Modul aus-/einschalten und Reload über die Foundry-Oberfläche behob dies nicht. Daher sind die neue Rollenanzeige, Overrides und UI-Interaktion in AP04c-1 **nicht live abgenommen**. Keine Actors, Tokens oder Combats wurden verändert. Das temporäre Testmakro wurde entfernt.

Die portable Modulkopie wurde vor dem Test vollständig gesichert und danach zurückgespielt: 32 Dateien in Sicherung und Ziel, SHA-256-Vergleich ohne Abweichungen. Die zusätzliche Testdatei wurde entfernt.

Grenzen der Kennzahlen: die 100er-Auswertung verwendet ihre 100 Fälle als Brute-Kohorten; die produktive App berechnet Kohorten aus dem kompletten aktivierten `monsterIndex`. Kompendiumsduplikate können in der produktiven Verteilung dieselbe Kreatur mehrfach gewichten. Schaden ist ein Formelmittelwert pro Einzelattacke und ignoriert dynamische Formeln, Multiattack-Zugfolgen, Trefferwahrscheinlichkeit, Saves, Aktionsökonomie und taktische KI. Statustexte und natürliche Sprache sind uneinheitlich. Es gibt keine unabhängige Fachreferenz und keine belastbare Präzisions-/Recall-Messung. Die Regeln sind daher entscheidungsunterstützende Evidenz, keine verlässliche taktische KI.

## Tests und Scope

- `node --test tests/tactical-roles.test.mjs tests/assistant-handoff.test.mjs`: 27/27 bestanden.
- Syntaxprüfung per `node --input-type=module --check` für `scripts/tactical-roles.js` und `scripts/encounter-builder-app.js` bestanden.
- Handlebars-If-/Each-Zählung ausgeglichen; `git diff --check` bestanden.
- Änderungen auf Rollenextraktion, Vergleich und Darstellung begrenzt. Keine Änderung an Handoff-Verhalten, XP, Auto-Fill oder Rollen-Constraints. Foundry-V14-Laufzeitprüfung der UI bleibt offen.

## Empfehlung

Vor AP04c-2 sollte eine fachlich unabhängige Prüfung der strittigen Defender-/Controller-/Artillery-Fälle erfolgen. Sinnvoll wäre außerdem eine gezielte Verbesserung der Flyby-/Trampling-/War-Cry-Erkennung sowie eine Mehrfachquellen-Deduplizierung für die produktiven Brute-Kohorten. AP04c-2 darf die Rollen nur nach dieser Entscheidung für Auto-Fill verwenden.
