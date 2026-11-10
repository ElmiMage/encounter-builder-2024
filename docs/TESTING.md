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
