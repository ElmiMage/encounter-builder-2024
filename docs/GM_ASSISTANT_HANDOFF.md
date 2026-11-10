# GM Assistant handoff

Status: development branch `develop/gm-assistant-handoff`, based on Encounter Builder 0.4.3. The integrated development snapshot is marked 0.4.6 in the module manifest, but remains unreleased (no tag or GitHub release exists for this branch).

## Public contract

The Builder exposes `game.modules.get("encounter-builder-2024").api.open(plan?)`. Calling it without a plan continues to open the Builder as before. The optional plan schema is `gm-assistant/encounter-plan`; it carries a handoff ID, room code/name, a world JournalEntry page UUID and an array of world NPC Actor UUID/count pairs. The Assistant host validates GM permission, source-page access, and Actor availability before calling the Builder. The Builder independently checks schema and field bounds and resolves every Actor as an NPC with a finite CR before mutating the encounter list.

Entries are added to the current list. A small in-memory ledger separates manually managed quantities from quantities contributed by each handoff ID. Repeating an identical plan stays deduplicated even after the GM edits its visible quantity. A changed variant replaces only the still-present contribution owned by that handoff, preserving manual quantities and contributions from other IDs. A minus action first reduces manually managed quantity; once that reaches zero it reduces the most recently imported contribution. Thus reducing an imported stack from four to two means a later variant switch removes those remaining two only. The plus action adds a manual unit. Deleting an entry discards all of its tracked contributions. Reset, preset load and closing the app clear the ledger. The ledger is intentionally session-local and is not persisted. The UI displays the source room and creature count. Import does not place tokens or create/start Combat; deployment remains a separate Builder action.

## Integration boundary and validation notes

- The room page UUID validator intentionally accepts world JournalEntry page UUIDs (`JournalEntry.<id>.JournalEntryPage.<id>`), matching the current Assistant plan data and host validation. Compendium UUIDs are not part of this contract.
- The API remains optional. The module has no hard dependency on GM Assistant; without the Assistant the existing Builder API and UI remain available.
- The Assistant's current host code calls `builder.api.open(handoff)` and awaits the result. The handoff format matches its current plan producer.
- `resolveHandoffPlan` validates and resolves every Actor before the encounter or ledger is mutated; failures are atomic. Pure accounting and plan-resolution tests run with `node --test tests/assistant-handoff.test.mjs`.
- Automated coverage does not replace Foundry runtime validation. Manifest declarations (Foundry minimum 13, verified 14; dnd5e minimum 3.0) do not establish runtime compatibility with Foundry V14 or dnd5e 6.0.6. See `TESTING.md` for the currently recorded live-test status.

## Sources

- Builder: `scripts/main.js`, `scripts/encounter-builder-app.js`, `templates/encounter-builder.hbs`.
- Assistant producer/host: `Foundry GM Assistant/module/foundry-gm-assistant/main.mjs` and `data/encounter-plans.json` in the sibling project. The host checks world/page/Actor access and passes the versioned plan to `api.open`.
