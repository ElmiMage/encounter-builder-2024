/** Pure quantity and validation logic for optional GM Assistant encounter plans. */
export class HandoffLedger {
  manual = new Map();
  handoffs = new Map();

  /** Adopt a pre-existing encounter quantity as manually managed exactly once. */
  adopt(uuid, count) {
    if (!this.manual.has(uuid)) this.manual.set(uuid, Math.max(0, count - this.#handoffTotal(uuid)));
  }

  /** Replace one handoff's remaining contribution with a fully resolved plan. */
  replace(handoffId, signature, counts) {
    const previous = this.handoffs.get(handoffId);
    if (previous?.signature === signature) return false;
    this.handoffs.set(handoffId, { signature, counts: new Map(counts) });
    return true;
  }

  /** Manual additions are kept distinct from plan-owned quantities. */
  adjustManual(uuid, delta, currentCount = 0) {
    this.adopt(uuid, currentCount);
    if (delta > 0) this.manual.set(uuid, (this.manual.get(uuid) ?? 0) + delta);
    else if (delta < 0) {
      let remaining = -delta;
      const manual = this.manual.get(uuid) ?? 0;
      const takeManual = Math.min(manual, remaining);
      this.manual.set(uuid, manual - takeManual);
      remaining -= takeManual;
      // Once manual units are exhausted, a decrement reduces the latest
      // imported contribution first, so a subsequent variant change cannot
      // remove units the GM already removed from that handoff.
      for (const record of [...this.handoffs.values()].reverse()) {
        const take = Math.min(record.counts.get(uuid) ?? 0, remaining);
        if (!take) continue;
        record.counts.set(uuid, record.counts.get(uuid) - take);
        remaining -= take;
        if (!remaining) break;
      }
    }
    return this.total(uuid);
  }

  total(uuid) { return (this.manual.get(uuid) ?? 0) + this.#handoffTotal(uuid); }

  forget(uuid) {
    this.manual.delete(uuid);
    for (const record of this.handoffs.values()) record.counts.delete(uuid);
  }

  clear() { this.manual.clear(); this.handoffs.clear(); }

  #handoffTotal(uuid) {
    let total = 0;
    for (const record of this.handoffs.values()) total += record.counts.get(uuid) ?? 0;
    return total;
  }
}

/** Find an entry's monster for a manual increment, including handoff-imported
 * world Actors that are not part of the compendium index. */
export function findMonsterForManualAdd(monsterIndex, existing, uuid) {
  return monsterIndex.find((monster) => monster.uuid === uuid)
    ?? (existing?.monster?.uuid === uuid ? existing.monster : undefined);
}

/** Validate and resolve every plan actor before returning data safe to apply. */
export async function resolveHandoffPlan(plan, resolveActor, xpForCr, getPackLabel = (pack) => pack) {
  if (plan?.schema !== "gm-assistant/encounter-plan" || typeof plan.handoffId !== "string" || plan.handoffId.length > 200 || !/^[A-Z0-9-]{1,80}$/.test(plan.roomCode ?? "") || typeof plan.roomName !== "string" || plan.roomName.length > 120 || !/^JournalEntry\.[A-Za-z0-9_-]+\.JournalEntryPage\.[A-Za-z0-9_-]+$/.test(plan.sourceUuid ?? "") || !Array.isArray(plan.monsters) || plan.monsters.length < 1 || plan.monsters.length > 30) {
    throw new Error("Invalid GM Assistant encounter plan.");
  }
  const pending = new Map();
  for (const spec of plan.monsters) {
    if (!/^Actor\.[A-Za-z0-9_-]+$/.test(spec?.uuid ?? "") || !Number.isInteger(spec.count) || spec.count < 1 || spec.count > 100) {
      throw new Error("The GM Assistant encounter plan contains an invalid Actor or count.");
    }
    const actor = await resolveActor(spec.uuid);
    const cr = Number(actor?.system?.details?.cr);
    if (!actor || actor.type !== "npc" || !Number.isFinite(cr)) {
      throw new Error("Could not load a D&D NPC with a valid CR from " + spec.uuid + ". No encounter entries were added.");
    }
    const previous = pending.get(spec.uuid);
    if (previous) { previous.count += spec.count; continue; }
    const type = actor.system?.details?.type;
    pending.set(spec.uuid, {
      monster: {
        uuid: actor.uuid, id: actor.id, name: actor.name, img: actor.img, cr,
        xp: xpForCr(cr) ?? 0,
        creatureType: type?.value || "unknown", subtype: type?.subtype || null,
        size: actor.system?.traits?.size || null, habitats: [],
        hasLairActions: Boolean(actor.system?.resources?.lair?.value),
        sourcePack: actor.pack || "world",
        sourceLabel: actor.pack ? (getPackLabel(actor.pack) ?? actor.pack) : "World Actor",
      },
      count: spec.count,
    });
  }
  return pending;
}
