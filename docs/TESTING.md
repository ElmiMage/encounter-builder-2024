# Test Anleitung

## Handoff-Unit-Tests

Voraussetzung: Node.js 24 (oder kompatible Version mit `node:test`). Im Repository ausführen:

```powershell
node --test tests/assistant-handoff.test.mjs
```

Die Tests prüfen Mengenbuchhaltung und atomare Planvalidierung ohne Foundry. Sie erzeugen keine Foundry-Dokumente.

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
