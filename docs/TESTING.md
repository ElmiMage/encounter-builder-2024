# Test Anleitung

## Handoff-Unit-Tests

Voraussetzung: Node.js 24 (oder kompatible Version mit `node:test`). Im Repository ausführen:

```powershell
node --test tests/assistant-handoff.test.mjs
```

Die Tests prüfen Mengenbuchhaltung und atomare Planvalidierung ohne Foundry. Sie erzeugen keine Foundry-Dokumente.

## Taktische Rollenerkennung

```powershell
node --test tests/tactical-roles.test.mjs tests/assistant-handoff.test.mjs
```

Die taktischen Klassifikationstests verwenden minimierte dnd5e-Datenobjekte und laufen ohne Foundry. Sie sind kein Live-Kompatibilitätsnachweis. AP04b-Live-Prüfungen und Testgrenzen stehen nach tatsächlicher Ausführung im [AP04b-Bericht](AP04B_TACTICAL_ROLE_DETECTION.md).

## Foundry-Liveprüfung

Für Integrationstests eine ausdrücklich getrennte Welt verwenden. AP03 verwendet:

- Foundry VTT 14, Build 369
- D&D 5e 6.0.6
- Weltname: `Encounter Builder – AP03 Test`
- World-ID/Datenordner: `encounter-builder-test`
- Portable Installation: `C:\Users\steph\Downloads\FoundryVTT-WindowsPortable`
- Bedienung: Foundry im Browser unter `http://localhost:30000`

GM-Assistant- und Guild-Quest-Welten bleiben außerhalb der Testläufe. Einen Laufzeittest nur dann als bestanden dokumentieren, wenn die jeweilige Aktion in dieser Welt sichtbar ausgeführt und ihr Ergebnis geprüft wurde. Tests in Node, Syntaxprüfungen und Manifest-Kompatibilitätsangaben sind davon getrennt zu berichten.

## AP03-Ausführung

- Automatisiert: `node --test tests/assistant-handoff.test.mjs` — 10/10 Tests bestanden.
- Live geprüft am 10.11.2026 in `Encounter Builder – AP03 Test` (Foundry V14 Build 369, dnd5e 6.0.6; nur Encounter Builder aktiviert): API-Öffnen ohne Plan; erster Planimport (ein Welt-NPC, Menge 4); erneuter identischer Plan blieb dedupliziert; manuelle Reduktion über den Minus-Button änderte die sichtbare Menge auf 2 und das Budget von 200 auf 100 XP.
- Nicht live abgeschlossen: Variantenwechsel nach Mengenänderung, fehlerhafte/teilweise nicht auflösbare Plan-Aktualisierung sowie Reset-/Preset-/Schließen-Ledgerfälle. Dafür liegen automatisierte Unit-Tests für die reine Buchhaltung und atomare Planauflösung vor; diese ersetzen keine Foundry-Laufzeitprüfung.
- Während der Live-Prüfung wurden zwei temporäre Test-NPCs und ein Makro ausschließlich in der isolierten Testwelt angelegt. Es wurden keine Tokens oder Combats deployed. Die zwei temporär kopierten Moduldateien wurden nach dem Test auf der Portable-Installation wiederhergestellt.
- Nicht als Live-Nachweis werten: bloßes Laden der Welt, Syntaxprüfung oder ein erfolgreicher Unit-Test.

## AP03b-Live-Abnahme (10.11.2026)

Die Abnahme wurde in der laufenden Foundry-Browser-Sitzung fortgesetzt. Die Portable-Installation ist `C:\Users\steph\Downloads\FoundryVTT-WindowsPortable`; das Foundry-Fenster gehörte zu dieser Installation. Die Versions- und World-ID-Ausgabe ließ sich in dieser Sitzung wegen überlagerter Actor-, Builder- und Makrofenster nicht zuverlässig auslesen. Daher werden die AP03-Angaben oben nicht als erneute AP03b-Verifikation ausgegeben.

| Test | Ergebnis | Beobachtung |
|---|---|---|
| L01 | Bestanden (AP03-Baseline) | Builder ohne neuen Plan geöffnet; siehe AP03-Ausführung. |
| L02 | Bestanden (AP03-Baseline) | Planimport mit einem Welt-NPC, Menge 4; siehe AP03-Ausführung. |
| L03 | Bestanden (AP03-Baseline) | Identischer Plan blieb dedupliziert; siehe AP03-Ausführung. |
| L04 | Bestanden (AP03-Baseline) | Minus-Button änderte Menge 4 auf 2 und XP 200 auf 100. |
| L05–L18 | Nicht ausgeführt in AP03b | In dieser Sitzung nicht mit konkreten Vorher-/Nachher-Zahlen nachgewiesen. |

Zusätzlicher Sichtbefund in der aktuellen Sitzung: Builder-Oberfläche mit einer bestehenden Zeile `2x AP03 Goblin` und `100 / 1500 XP`; ein Actor-Detailfenster lag darüber. Das belegt keine Variante, Ledger-Buchhaltung oder Laufzeitversion. Makro-Klicks trafen die überlagerte UI nicht zuverlässig; es wurden daher keine weiteren Ergebnisse daraus abgeleitet. Browser-Konsole lieferte bei der begrenzten Fehlerabfrage keine Warnungen oder Fehler.

Die AP03-Unit-Suite bleibt mit 10/10 bestanden (reine Node-Tests, kein Foundry-Live-Nachweis für L05–L18). Es wurde in AP03b kein reproduzierter Produktfehler gefunden, weil die nötigen Live-Szenarien nicht ausgeführt werden konnten; es gab folglich keine Codekorrektur. AP03 kann mit dieser AP03b-Runde nicht vollständig live abgenommen werden. Vor einem Abschluss müssen die fehlenden Szenarien in der sichtbaren Testwelt erneut ausgeführt werden, beginnend mit einer eindeutig bestätigten World-ID und Laufzeitversion.

## AP03c Live-Abnahme (10.11.2026)

Die Lücken aus AP03b wurden am 10.11.2026 in der Foundry-Browseroberfläche der isolierten Welt `Encounter Builder – AP03 Test` (`encounter-builder-test`) geprüft: Foundry V14.369, dnd5e 6.0.6. GM Assistant und Guild Quest waren deaktiviert; der Encounter Builder war aktiv. Die AP03-Baseline L01–L04 bleibt separat belegt (siehe oben).

| Tests | Ergebnis | Live-Beobachtung |
|---|---|---|
| L05 | Bestanden, einschließlich Fix | Welt-Actor-Zeile per sichtbarem Plus erhöht (2→3; weitere UI-Klicks ebenfalls gezählt). Vor dem Fix reproduziert: Plus blieb bei 2, weil `#onAddMonster` nur den Compendium-Index abfragte. Jetzt wird der vorhandene Encounter-Actor als Rückfall verwendet. |
| L06–L08 | Bestanden | Wechsel Alpha 4→Beta 2 entfernte den alten Beitrag; Minus reduzierte nur den noch zugeordneten Handoff-Anteil; Plus erzeugte manuelle Menge, die beim Variantenwechsel erhalten blieb. |
| L09–L10 | Bestanden | Zwei Handoff-IDs blieben getrennt; Variantenwechsel und identischer Retry änderten nur den passenden Beitrag bzw. blieben dedupliziert. Abschließende Mengen wurden nach dem UI-Render geprüft. |
| L11–L13 | Bestanden | Reset leerte Liste, XP und Banner; derselbe Plan importierte danach erneut. Laden eines Kompendium-Presets setzte das Ledger zurück; nach App-Schließen wurde beim erneuten Öffnen eine frische Sitzung angelegt. |
| L14–L15 | Bestanden (Fehlerpfade) | Ungültiger Plan sowie Mischung aus gültigem und nicht auflösbarem Actor wurden abgewiesen; vorhandene Encounter-Zeilen blieben jeweils unverändert. |
| L16 | Bestanden | Bei Alpha 3 plus manueller Erhöhung auf 4 fügte der Handoff Beta 1 hinzu; beim Variantenwechsel blieb Alpha 4 als vorhandene/manuelle Menge erhalten und Beta 1 wurde sichtbar. |
| L17–L18 | Bestanden | Öffentliche API funktionierte bei aktivem Builder ohne GM Assistant. Vorher/nachher: 0 Combats und 0 Tokens; Planimport deployt oder startet keinen Kampf. |
| Zusatzregression | Bestanden | Kompendium-Goblin hinzugefügt (XP 250→300) und entfernt (300→250). Auto-Fill erzeugte vier Kreaturen bei 1.100/1.500 XP. Compute Roles für CR 1 und Rollenfilter Brute reduzierten die sichtbare Liste von 52 auf 13. Encounter am Ende per UI zurückgesetzt: 0/1.500 XP, keine Encounter-Zeilen. |

### Teststeuerung und Befund

AP03b scheiterte an überlappenden Foundry-Fenstern: unscoped Makro-/Button-Klicks konnten ein verdecktes Fenster statt des sichtbaren Ziels treffen. Das war ein Steuerungsfehler im Testablauf, kein nachgewiesener Produktfehler. AP03c verwendete das jeweils sichtbare Vordergrundfenster, prüfte Makroinhalt nach dem Speichern erneut und begrenzte Builder-Aktionen auf das Builder-Fenster. Alle Foundry-Aktionen liefen über den Browser.

Der reproduzierte Plus-Button-Fehler wurde in `scripts/encounter-builder-app.js` behoben. `findMonsterForManualAdd` in `scripts/assistant-handoff.mjs` bevorzugt den Compendium-Treffer und verwendet sonst einen passenden bereits vorhandenen Encounter-Actor. Der Regressionstest liegt in `tests/assistant-handoff.test.mjs`; die Unit-Suite und Modul-Syntaxprüfungen bestanden. Das ist ein gezielter Laufzeitbefund, kein vollständiger dnd5e-/Foundry-Kompatibilitätstest.

Zusätzliche Testdaten (AP03c Goblin Alpha/Beta, Makro und gespeicherte Presets) liegen ausschließlich in der isolierten Testwelt. Welt-Actor-Einträge sind nicht Teil des Compendium-Monsterindex; ein Preset mit solchem Actor wurde beim Laden mit sichtbarer Warnung übersprungen. Der Preset-Test für Ledger-Reset wurde deshalb zusätzlich mit einem Kompendium-Monster erfolgreich ausgeführt. Keine Tokens oder Combats wurden erzeugt. Die temporär installierte App-Datei wurde nach dem Test auf SHA-256 `90C041667A078A4CD513677C5C80351491F69D6F13FD1FEE11682DA0D2046D50` zurückgesetzt; die temporäre Helper-Datei wurde entfernt.
