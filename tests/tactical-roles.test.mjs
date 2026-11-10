import test from "node:test";
import assert from "node:assert/strict";
import { classifyTacticalRoles, classifyTacticalRolePool, extractTacticalCapabilities, getTacticalRoleDisplay, getTacticalRoleLoadPlan } from "../scripts/tactical-roles.js";

const activity = (type, extra = {}) => ({ type, name: type, ...extra });
const attack = (name, range, formula) => activity("attack", { name, attack: { type: range === 5 ? "melee" : "ranged" }, range: range == null ? {} : { value: range, long: range >= 30 ? range * 4 : undefined, units: "ft" }, labels: { damage: [{ formula }] } });
const item = (name, activities, extra = {}) => ({ name, system: { activities, ...extra } });
const actor = (items, extra = {}) => ({ items, system: { attributes: { hp: { max: 12 }, ac: { value: 12 }, movement: { walk: 30 } }, ...extra } });

test("Goblin-style melee, ranged bow, and explicit Nimble Escape remain separate evidence", () => {
  const goblin = actor([
    item("Scimitar", [attack("Melee", 5, "1d6 + 2")], { type: { value: "martialM" } }),
    item("Shortbow", [attack("Ranged", 80, "1d6 + 2")], { type: { value: "simpleR" } }),
    item("Nimble Escape", [], { description: { value: "The goblin can take the Disengage or Hide action as a bonus action." } }),
  ]);
  const result = classifyTacticalRoles(goblin);
  assert.equal(result.capabilities.highestAttackDamage, 5.5);
  assert.equal(result.capabilities.flags.hasMelee, true);
  assert.equal(result.capabilities.flags.hasLongRange, true);
  assert.equal(result.roles.artillery.status, "Belegt");
  assert.equal(result.roles.skirmisher.status, "Wahrscheinlich");
  assert.ok(result.roles.skirmisher.evidence.some((fact) => fact.source.includes("Nimble Escape")));
});

test("high AC alone is not evidence of protecting allies", () => {
  const result = classifyTacticalRoles(actor([], { attributes: { ac: { value: 19 } } }));
  assert.equal(result.roles.defender.status, "Unklar");
  assert.match(result.roles.defender.reason, /belegt aber keine Defender-Funktion oder Schutz/);
  assert.equal(result.roles.support.status, "Unklar");
});

test("structured ally defense can evidence Defender and special movement speeds retain their paths", () => {
  const protector = actor([item("Aura", [activity("utility", { target: { affects: { type: "ally" } }, effects: { ward: { changes: [{ key: "system.attributes.ac.bonus", value: 2 }] } } })])], {
    attributes: { hp: { max: 20 }, ac: { value: 14 }, movement: { speeds: { walk: 30, fly: 40, swim: 10 } } },
  });
  const result = classifyTacticalRoles(protector);
  assert.equal(result.roles.defender.status, "Belegt");
  assert.equal(result.roles.support.status, "Belegt");
  assert.ok(result.capabilities.facts.some((fact) => fact.source.endsWith("movement.speeds.fly")));
  assert.ok(result.roles.defender.evidence.some((fact) => fact.source.includes("Aura")));
});

test("spell-like multi-function Actor can be artillery, controller, and support", () => {
  const mage = actor([
    item("Fireball", { a: activity("save", { target: { template: { type: "sphere", size: 20 } }, damage: { parts: [{ formula: "8d6", types: ["fire"] }] } }) }),
    item("Hold Person", [activity("save", { effects: { e: { name: "Paralyzed", description: "Paralyzed" } } })]),
    item("Cure Wounds", [activity("heal", { healing: { parts: [{ formula: "2d8 + 3" }] } })]),
    item("Fire Bolt", [attack("Ranged", 120, "2d10")]),
  ]);
  const result = classifyTacticalRoles(mage);
  assert.equal(result.roles.artillery.status, "Belegt");
  assert.equal(result.roles.controller.status, "Belegt");
  assert.equal(result.roles.support.status, "Unklar");
  assert.equal(result.mainRole, null);
  assert.ok(result.roles.controller.evidence[0].source.includes("Hold Person"));
});

test("unstructured area prose and incomplete Actors stay unknown", () => {
  const incomplete = { items: undefined, system: { attributes: { ac: { value: 10 } } } };
  const result = classifyTacticalRoles(incomplete);
  assert.equal(result.roles.artillery.status, "Unklar");
  assert.equal(result.roles.controller.status, "Unklar");
  assert.equal(result.roles.support.status, "Unklar");
  assert.equal(result.capabilities.hp, null);
  assert.deepEqual(extractTacticalCapabilities(incomplete).facts.map((fact) => fact.kind), ["armor-class"]);
});

test("alternatives are not summed and activity collections accept arrays, objects, and Sets", () => {
  const mixed = actor([
    item("Multiattack", { first: attack("Bite", 5, "2d8"), second: attack("Claw", 5, "3d6") }),
    item("Traits", new Set([activity("save", { uses: { max: 1, recovery: [{ period: "recharge" }] } })])),
  ]);
  const caps = extractTacticalCapabilities(mixed);
  assert.equal(caps.highestAttackDamage, 10.5);
  assert.equal(caps.facts.filter((fact) => fact.kind === "damage").length, 2);
  assert.equal(caps.flags.hasLimitedUse, true);
});

test("area effects require a structured template and facts retain source paths", () => {
  const withTemplate = classifyTacticalRoles(actor([item("Breath", [activity("save", { target: { template: { type: "line", size: 60 } }, damage: { parts: [{ formula: "12d8" }] } })])]));
  assert.equal(withTemplate.roles.controller.status, "Unklar");
  assert.equal(withTemplate.capabilities.flags.hasStructuredArea, true);
  const withoutTemplate = classifyTacticalRoles(actor([item("Blast", [activity("save", { damage: { parts: [{ formula: "8d6" }] } })])]));
  assert.equal(withoutTemplate.roles.controller.status, "Unklar");
});

test("source signature changes when structured data changes, enabling stale override warning", () => {
  const before = classifyTacticalRoles(actor([item("Claw", [attack("Melee", null, "1d6")], { type: { value: "martialM" } })]));
  const after = classifyTacticalRoles(actor([item("Claw", [attack("Melee", null, "2d6")], { type: { value: "martialM" } })]));
  assert.notEqual(before.signature, after.signature);
  const override = { roles: ["controller"], signature: before.signature };
  const shown = getTacticalRoleDisplay(after, override);
  assert.equal(shown.stale, true);
  assert.equal(shown.roles.find((role) => role.label === "Controller").status, "Manuell");
  assert.equal(getTacticalRoleDisplay(before, override).stale, false);
});

test("manual selection can replace several automatic roles while preserving the evidence result", () => {
  const evaluation = classifyTacticalRoles(actor([item("Heal", [activity("heal")]), item("Bolt", [attack("Ranged", 60, "2d8")])]));
  const shown = getTacticalRoleDisplay(evaluation, { roles: ["support", "artillery"], signature: evaluation.signature });
  assert.deepEqual(shown.roles.filter((role) => role.status === "Manuell").map((role) => role.label).sort(), ["Artillery", "Support"]);
  assert.equal(evaluation.roles.support.status, "Unklar");
  assert.equal(evaluation.roles.artillery.status, "Belegt");
});

test("role results are reused from cache until explicit refresh", () => {
  const pool = [{ uuid: "Actor.one" }, { uuid: "Compendium.pack.Actor.two" }];
  const cache = new Map([["Actor.one", {}]]);
  assert.deepEqual(getTacticalRoleLoadPlan(pool, cache).map((entry) => entry.uuid), ["Compendium.pack.Actor.two"]);
  assert.deepEqual(getTacticalRoleLoadPlan(pool, cache, true).map((entry) => entry.uuid), pool.map((entry) => entry.uuid));
});

test("invalid CR actors never share a brute comparison cohort", () => {
  const unknownCr = (uuid, hp, damage) => {
    const value = actor([item("Claw", [attack("Melee", 5, `${damage}d8`)], { type: { value: "natural" } })]);
    value.uuid = uuid;
    value.system.attributes.hp.max = hp;
    value.system.details = { cr: null };
    return value;
  };
  const results = classifyTacticalRolePool([
    unknownCr("Actor.a", 500, 20), unknownCr("Actor.b", 800, 25),
  ]);
  assert.equal(results.get("Actor.a").comparison.cohortSize, 0);
  assert.equal(results.get("Actor.b").comparison.cohortSize, 0);
  assert.equal(results.get("Actor.a").roles.brute.status, "Unklar");
});

test("Foundry 6 object attack types and natural weapons use Item range/type evidence", () => {
  const gargoyle = actor([item("Claw", [activity("attack", { attack: { type: { value: "melee" } }, range: { value: 5, units: "ft" }, damage: { parts: [{ formula: "2d4 + 2" }] } })], { type: { value: "natural" }, range: { value: 5, long: null } })]);
  assert.equal(extractTacticalCapabilities(gargoyle).flags.hasMelee, true);
  const archer = actor([item("Crossbow", [activity("attack", { attack: { type: { value: "ranged" } }, range: { value: 5, units: "ft" }, damage: { parts: [{ formula: "1d8 + 3" }] } })], { type: { value: "simpleR" }, range: { value: 80, long: 320 } })]);
  const ranged = extractTacticalCapabilities(archer);
  assert.equal(ranged.flags.hasRanged, true);
  assert.equal(ranged.rangedRange, 320);
});

test("pure damage area, self healing, and self buff do not imply Controller or Support", () => {
  const monster = actor([
    item("Blast", [activity("save", { target: { template: { type: "sphere" } }, damage: { parts: [{ formula: "8d6" }] } })]),
    item("Self Heal", [activity("heal", { target: { affects: { type: "self" } } })]),
    item("Self Ward", [activity("utility", { target: { affects: { type: "self" } }, effects: { e: { description: "resistance" } } })]),
  ]);
  const result = classifyTacticalRoles(monster);
  assert.equal(result.roles.controller.status, "Unklar");
  assert.equal(result.roles.support.status, "Unklar");
});

test("ally-targeted structured healing supports; explicit Cunning Action supports Skirmisher", () => {
  const monster = actor([
    item("Healing Word", [activity("heal", { target: { affects: { type: "ally" } } })]),
    item("Cunning Action", [], { description: { value: "The creature uses Cunning Action to take the Dash, Disengage, or Hide action." } }),
    item("Dagger", [activity("attack", { attack: { type: { value: "melee" } }, damage: { parts: [{ formula: "1d4 + 2" }] } })], { type: { value: "simpleM" } }),
  ]);
  const result = classifyTacticalRoles(monster);
  assert.equal(result.roles.support.status, "Belegt");
  assert.equal(result.roles.skirmisher.status, "Wahrscheinlich");
});

test("a limited ranged burst is not a repeatable artillery option", () => {
  const monster = actor([item("Recharge Blast", [activity("attack", { attack: { type: { value: "ranged" } }, range: { value: 60, units: "ft" }, uses: { max: 1, recovery: [{ period: "recharge" }] }, damage: { parts: [{ formula: "8d8" }] } })])]);
  const result = classifyTacticalRoles(monster);
  assert.equal(result.roles.artillery.status, "Wahrscheinlich");
  assert.equal(result.capabilities.flags.hasRepeatableRanged, false);
  assert.equal(result.significance.artillery, "Secondary");
});

test("CR cohort Brute requires at least 20 peers and both HP and melee damage above P75", () => {
  const make = (index, hp, damage) => ({
    uuid: `Actor.${index}`, system: { details: { cr: 4 }, attributes: { hp: { max: hp }, ac: { value: 12 } } },
    items: [item("Bite", [activity("attack", { attack: { type: { value: "melee" } }, damage: { parts: [{ formula: `${damage}d6` }] } })], { type: { value: "natural" } })],
  });
  const small = classifyTacticalRolePool([make(1, 200, 10), make(2, 50, 1)]);
  assert.equal(small.get("Actor.1").roles.brute.status, "Unklar");
  const peers = Array.from({ length: 20 }, (_, index) => make(index, 50 + index, 1 + Math.floor(index / 3)));
  peers.push(make("elite", 200, 12));
  const pool = classifyTacticalRolePool(peers);
  assert.equal(pool.get("Actor.elite").roles.brute.status, "Wahrscheinlich");
  assert.equal(pool.get("Actor.elite").comparison.cohortSize, 21);
  assert.equal(pool.get("Actor.elite").significance.brute, "Main");
  assert.equal(pool.get("Actor.0").roles.brute.status, "Unklar");
});
