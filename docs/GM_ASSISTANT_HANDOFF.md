# GM Assistant handoff

Status: development branch `develop/gm-assistant-handoff`, based on Encounter Builder 0.4.3. The integrated development snapshot is marked 0.4.6 in the module manifest, but remains unreleased (no tag or GitHub release exists for this branch).

## Public contract

The Builder exposes `game.modules.get("encounter-builder-2024").api.open(plan?)`. Calling it without a plan continues to open the Builder as before. The optional plan schema is `gm-assistant/encounter-plan`; it carries a handoff ID, room code/name, a world JournalEntry page UUID and an array of world NPC Actor UUID/count pairs. The Assistant host validates GM permission, source-page access, and Actor availability before calling the Builder. The Builder independently checks schema and field bounds and resolves every Actor as an NPC with a finite CR before mutating the encounter list.

Entries are added to the current list. Repeating the same handoff with unchanged contents is deduplicated while the imported counts remain present. A changed variant with the same handoff ID replaces the tracked prior contribution. Reset, preset load and closing the app clear the handoff bookkeeping. The UI displays the source room and creature count. Import does not place tokens or create/start Combat; deployment remains a separate Builder action.

## Integration boundary and validation notes

- The room page UUID validator intentionally accepts world JournalEntry page UUIDs (`JournalEntry.<id>.JournalEntryPage.<id>`), matching the current Assistant plan data and host validation. Compendium UUIDs are not part of this contract.
- The API remains optional. The module has no hard dependency on GM Assistant; without the Assistant the existing Builder API and UI remain available.
- The Assistant's current host code calls `builder.api.open(handoff)` and awaits the result. The handoff format matches its current plan producer.
- `importAssistantPlan` validates before applying the imported plan. For changed variants, contribution removal assumes the tracked imported counts have not been manually reduced below their original imported amount; manual edits interleaved with variant changes need a live UX check.
- No automated test suite is present in the repository. This change has not been live-tested in Foundry. Manifest declarations (Foundry minimum 13, verified 14; dnd5e minimum 3.0) do not establish runtime compatibility with Foundry V14 or dnd5e 6.0.6.

## Sources

- Builder: `scripts/main.js`, `scripts/encounter-builder-app.js`, `templates/encounter-builder.hbs`.
- Assistant producer/host: `Foundry GM Assistant/module/foundry-gm-assistant/main.mjs` and `data/encounter-plans.json` in the sibling project. The host checks world/page/Actor access and passes the versioned plan to `api.open`.
