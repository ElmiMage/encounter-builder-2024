import test from "node:test";
import assert from "node:assert/strict";
import { findMonsterForManualAdd, HandoffLedger, resolveHandoffPlan } from "../scripts/assistant-handoff.mjs";

const actor = (id, type = "npc", cr = 1) => ({ uuid: `Actor.${id}`, id, name: id, img: "actor.webp", type, system: { details: { cr, type: { value: "humanoid" } }, traits: { size: "med" }, resources: {} } });
const plan = (handoffId, monsters) => ({ schema: "gm-assistant/encounter-plan", handoffId, roomCode: "A1", roomName: "Test Room", sourceUuid: "JournalEntry.journal.JournalEntryPage.page", monsters });
const resolved = (id, count) => new Map([[`Actor.${id}`, { monster: { uuid: `Actor.${id}`, name: id }, count }]]);
const apply = (ledger, id, signature, counts) => ledger.replace(id, signature, new Map(counts));

test("manual increment can reuse a handoff-imported world Actor outside the compendium index", () => {
  const monster = { uuid: "Actor.worldGoblin", name: "World Goblin" };
  const existing = { monster, count: 2 };
  assert.equal(findMonsterForManualAdd([], existing, monster.uuid), monster);
  assert.equal(findMonsterForManualAdd([], existing, "Actor.other"), undefined);
  const indexed = { uuid: monster.uuid, name: "Indexed Goblin" };
  assert.equal(findMonsterForManualAdd([indexed], existing, monster.uuid), indexed);
});

test("valid first import and identical retry are deduplicated", () => {
  const ledger = new HandoffLedger();
  const result = apply(ledger, "room-1", "goblin:4", [["Actor.goblin", 4]]);
  assert.equal(result, true);
  assert.equal(ledger.total("Actor.goblin"), 4);
  assert.equal(apply(ledger, "room-1", "goblin:4", [["Actor.goblin", 4]]), false);
  assert.equal(ledger.total("Actor.goblin"), 4);
});

test("variant change removes only that handoff's remaining contribution", () => {
  const ledger = new HandoffLedger();
  apply(ledger, "room-1", "old", [["Actor.old", 4]]);
  ledger.adjustManual("Actor.old", -2, 4);
  ledger.adjustManual("Actor.old", 3, 2);
  apply(ledger, "room-1", "new", [["Actor.new", 2]]);
  assert.equal(ledger.total("Actor.old"), 3);
  assert.equal(ledger.total("Actor.new"), 2);
});

test("manual additions, reductions, and pre-existing entries keep ownership", () => {
  const ledger = new HandoffLedger();
  ledger.adopt("Actor.goblin", 2);
  apply(ledger, "room-1", "four", [["Actor.goblin", 4]]);
  assert.equal(ledger.total("Actor.goblin"), 6);
  ledger.adjustManual("Actor.goblin", 1, 6);
  ledger.adjustManual("Actor.goblin", -1, 7);
  apply(ledger, "room-1", "two", [["Actor.other", 2]]);
  assert.equal(ledger.total("Actor.goblin"), 2);
  assert.equal(ledger.total("Actor.other"), 2);
});

test("overlapping handoffs stay separate; decrement reduces latest handoff first", () => {
  const ledger = new HandoffLedger();
  apply(ledger, "room-1", "a", [["Actor.goblin", 2]]);
  apply(ledger, "room-2", "b", [["Actor.goblin", 3]]);
  ledger.adjustManual("Actor.goblin", -1, 5);
  apply(ledger, "room-2", "b2", [["Actor.orc", 1]]);
  assert.equal(ledger.total("Actor.goblin"), 2);
  assert.equal(ledger.total("Actor.orc"), 1);
  apply(ledger, "room-1", "a2", [["Actor.wolf", 1]]);
  assert.equal(ledger.total("Actor.goblin"), 0);
  assert.equal(ledger.total("Actor.wolf"), 1);
});

test("quantities never become negative and deleting an entry forgets all sources", () => {
  const ledger = new HandoffLedger();
  apply(ledger, "room", "first", [["Actor.goblin", 1]]);
  ledger.adjustManual("Actor.goblin", -9, 1);
  assert.equal(ledger.total("Actor.goblin"), 0);
  ledger.forget("Actor.goblin");
  apply(ledger, "room", "variant", [["Actor.orc", 1]]);
  assert.equal(ledger.total("Actor.goblin"), 0);
});

test("reset and preset replacement clear all handoff bookkeeping", () => {
  const ledger = new HandoffLedger();
  apply(ledger, "room", "first", [["Actor.goblin", 4]]);
  ledger.clear();
  assert.equal(ledger.total("Actor.goblin"), 0);
  assert.equal(ledger.handoffs.size, 0);
});

test("resolves valid actors and merges repeated actor UUIDs before mutation", async () => {
  const actors = new Map([["Actor.goblin", actor("goblin")]]);
  const pending = await resolveHandoffPlan(plan("r1", [{ uuid: "Actor.goblin", count: 2 }, { uuid: "Actor.goblin", count: 3 }]), async (uuid) => actors.get(uuid), (cr) => cr * 100);
  assert.equal(pending.get("Actor.goblin").count, 5);
  assert.equal(pending.get("Actor.goblin").monster.xp, 100);
});

test("invalid and incomplete plans reject before actor resolution", async () => {
  let calls = 0;
  const resolve = async () => { calls++; return actor("goblin"); };
  for (const invalid of [null, {}, plan("r", [{ uuid: "Compendium.x", count: 1 }]), plan("r", [{ uuid: "Actor.goblin", count: 0 }]), { ...plan("r", [{ uuid: "Actor.goblin", count: 1 }]), sourceUuid: "" }]) {
    await assert.rejects(resolveHandoffPlan(invalid, resolve, () => 1));
  }
  assert.equal(calls, 0);
});

test("missing actors, wrong document types, and invalid CR reject", async () => {
  for (const invalidActor of [undefined, actor("item", "item"), actor("badcr", "npc", Number.NaN)]) {
    await assert.rejects(resolveHandoffPlan(plan("r", [{ uuid: "Actor.goblin", count: 1 }]), async () => invalidActor, () => 1), /Could not load/);
  }
});

test("partial actor resolution failure leaves caller state untouched", async () => {
  const ledger = new HandoffLedger();
  apply(ledger, "room", "old", [["Actor.old", 3]]);
  const before = ledger.total("Actor.old");
  await assert.rejects(resolveHandoffPlan(plan("room", [{ uuid: "Actor.goblin", count: 1 }, { uuid: "Actor.missing", count: 1 }]), async (uuid) => uuid.endsWith("missing") ? null : actor("goblin"), () => 1));
  assert.equal(ledger.total("Actor.old"), before);
  assert.equal(ledger.handoffs.get("room").signature, "old");
});
