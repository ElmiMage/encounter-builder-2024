/** Pure extraction and evidence-based tactical role classification. */
export const TACTICAL_ROLES = Object.freeze(["defender", "brute", "skirmisher", "artillery", "controller", "support"]);
export const TACTICAL_ROLE_LABELS = Object.freeze({ defender: "Defender", brute: "Brute", skirmisher: "Skirmisher", artillery: "Artillery", controller: "Controller", support: "Support" });

/** Return only uncached entries unless the GM explicitly requests a refresh. */
export function getTacticalRoleLoadPlan(monsters, cache, refresh = false) {
  return monsters.filter((monster) => refresh || !cache.has(monster.uuid));
}

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  if (Array.isArray(value?.contents)) return value.contents;
  if (Array.isArray(value?.values)) return value.values;
  if (value && typeof value === "object" && !value.constructor?.name?.includes("Collection")) return Object.values(value);
  return [];
};
const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

/** Convert dnd5e 6 Actor/Item/Activity data to conservative, sourced facts. */
export function extractTacticalCapabilities(actor) {
  const facts = [];
  const add = (kind, source, detail = "") => facts.push({ kind, source, detail });
  const items = asArray(actor?.items);
  let highestAttackDamage = 0;
  let highestMeleeDamage = 0;
  let hasMelee = false;
  let hasRanged = false;
  let hasLongRange = false;
  let hasStructuredArea = false;
  let hasSaveDamage = false;
  let hasAllyBuff = false;
  let hasDefense = false;
  let hasMobility = false;
  let hasControlEffect = false;
  let hasHealing = false;
  let hasLimitedUse = false;

  for (const [itemIndex, item] of items.entries()) {
    const base = `items[${itemIndex}](${item?.name ?? "unnamed"})`;
    const activities = asArray(item?.system?.activities);
    for (const [activityIndex, activity] of activities.entries()) {
      const src = `${base}.activities[${activityIndex}](${activity?.name ?? activity?.type ?? "activity"})`;
      const range = Number(activity?.range?.value);
      const rangeUnit = activity?.range?.units;
      const longRange = Number(activity?.range?.long);
      const attackType = String(activity?.attack?.type ?? "").toLowerCase();
      const labels = asArray(activity?.labels?.damage);
      const parts = asArray(activity?.damage?.parts);
      const damage = [...labels, ...parts].map((part) => String(part?.formula ?? part?.value ?? ""));
      const damageValue = damage.reduce((max, formula) => {
        const matches = [...formula.matchAll(/(\d+)\s*d\s*(\d+)/gi)];
        const avg = matches.reduce((sum, m) => sum + Number(m[1]) * (Number(m[2]) + 1) / 2, 0);
        const remainder = matches.reduce((text, match) => text.replace(match[0], ""), formula);
        const flat = [...remainder.matchAll(/([+-]\s*\d+)(?!\s*d)/gi)].reduce((sum, match) => sum + Number(match[1].replace(/\s/g, "")), 0);
        return Math.max(max, avg + flat);
      }, 0);
      if (activity?.type === "attack" && damageValue > 0) {
        highestAttackDamage = Math.max(highestAttackDamage, damageValue);
        // Range is explicit when present; an absent range is not silently treated as melee.
        if (attackType === "ranged" || positive(longRange)) {
          hasRanged = true;
          const effectiveRange = positive(longRange) ? longRange : range;
          if (effectiveRange >= 30) hasLongRange = true;
          add("ranged-attack", `${src}.range`, `${effectiveRange || "unknown"} ft`);
        } else if (attackType === "melee" || item?.system?.type?.value === "simpleM" || item?.system?.type?.value === "martialM") {
          hasMelee = true;
          highestMeleeDamage = Math.max(highestMeleeDamage, damageValue);
          add("melee-attack", `${src}.damage`, damage.join(" / "));
        }
        add("damage", `${src}.damage`, damage.join(" / "));
      }
      if (activity?.type === "save") {
        hasSaveDamage ||= damageValue > 0;
        if (activity?.target?.template?.type && activity.target.template.type !== "none") {
          hasStructuredArea = true;
          add("area-template", `${src}.target.template`, activity.target.template.type);
        }
      }
      if (activity?.type === "heal") {
        hasHealing = true;
        add("healing", src, "Structured heal activity");
      }
      const targetType = activity?.target?.affects?.type ?? activity?.target?.type;
      const effectTextFor = (effect) => `${effect?.name ?? ""} ${effect?.description ?? ""} ${asArray(effect?.statuses).join(" ")} ${effect?.flags?.dnd5e?.statusId ?? ""} ${asArray(effect?.changes).map((change) => `${change?.key ?? ""} ${change?.value ?? ""}`).join(" ")}`;
      const effectDescriptions = asArray(activity?.effects).map(effectTextFor).join(" ").toLowerCase();
      const itemEffects = asArray(item?.effects);
      const effectText = `${effectDescriptions} ${itemEffects.map(effectTextFor).join(" ").toLowerCase()}`;
      const statuses = ["frightened", "paralyzed", "poisoned", "restrained", "stunned", "blinded", "charmed", "incapacitated", "prone"].filter((status) => effectText.includes(status));
      if (statuses.length) {
        hasControlEffect = true;
        add("condition-effect", `${src}.effects`, statuses.join(", "));
      }
      if (targetType === "ally" || targetType === "creature" && /ally|friendly|defen[cs]e|armor class|resistance|temporary hit points/i.test(effectText)) {
        hasAllyBuff = true;
        add("ally-target", `${src}.target`, String(targetType));
        if (/defen[cs]e|armor class|system\.attributes\.ac\.|resistance|system\.traits\.(dr|di)|temporary hit points|system\.attributes\.hp\.|ward/i.test(effectText)) hasDefense = true;
      }
      const recharge = activity?.uses?.recovery?.some?.((r) => r?.period === "recharge") || item?.system?.uses?.recovery?.some?.((r) => r?.period === "recharge");
      if (recharge || positive(activity?.uses?.max) || positive(item?.system?.uses?.max)) {
        hasLimitedUse = true;
        add("limited-use", `${src}.uses`, recharge ? "Recharge" : "Limited uses");
      }
    }
    // Only explicit, narrowly recognized traits; prose is a weaker clue.
    const description = String(item?.system?.description?.value ?? "").toLowerCase();
    if (/bonus action[^.]{0,100}\b(hide|disengage|dash|teleport)\b|\b(hide|disengage|dash)\b[^.]{0,100}\bbonus action\b|\bteleport[s]?\b.{0,80}\b(feet|ft\.)\b/.test(description)) {
      hasMobility = true;
      add("mobility-text", `${base}.description`, "Explicit bonus-action mobility wording");
    }
  }
  const movement = actor?.system?.attributes?.movement?.speeds ?? actor?.system?.attributes?.movement;
  const speeds = Object.entries(movement ?? {}).filter(([, value]) => positive(value) && typeof value === "number");
  for (const [mode, value] of speeds) add("movement", `system.attributes.movement.speeds.${mode}`, `${value} ft`);
  const hp = Number(actor?.system?.attributes?.hp?.max);
  const ac = Number(actor?.system?.attributes?.ac?.value);
  if (positive(hp)) add("hit-points", "system.attributes.hp.max", String(hp));
  if (positive(ac)) add("armor-class", "system.attributes.ac.value", String(ac));
  return {
    facts, hp: positive(hp) ? hp : null, ac: positive(ac) ? ac : null,
    highestAttackDamage: positive(highestAttackDamage) ? highestAttackDamage : null,
    highestMeleeDamage: positive(highestMeleeDamage) ? highestMeleeDamage : null,
    flags: { hasMelee, hasRanged, hasLongRange, hasStructuredArea, hasSaveDamage, hasAllyBuff, hasDefense, hasMobility, hasControlEffect, hasHealing, hasLimitedUse, hasMovement: speeds.length > 0 },
  };
}

function result(status, reason, evidence = []) { return { status, reason, evidence }; }

/** Every role is returned; uncertain/missing source data stays Unklar. */
export function classifyTacticalRoles(actor) {
  const c = extractTacticalCapabilities(actor);
  const f = c.flags;
  const evidence = (...kinds) => c.facts.filter((fact) => kinds.includes(fact.kind));
  const roles = {
    defender: f.hasDefense && f.hasAllyBuff
      ? result("Belegt", "Strukturierter Verbündeten-Effekt bietet ausdrücklich Schutz.", evidence("ally-target"))
      : c.ac !== null && c.ac >= 17
        ? result("Unklar", "Hohe AC deutet auf eigene Widerstandsfähigkeit, belegt aber keine Defender-Funktion oder Schutz für Verbündete.", evidence("armor-class"))
        : result("Unklar", "Keine eindeutige strukturierte Schutzfähigkeit erkannt."),
    brute: c.hp !== null && c.hp >= 60 && c.highestMeleeDamage !== null && f.hasMelee
      ? result("Wahrscheinlich", "Hohe Trefferpunkte plus kräftiger strukturierter Nahkampfangriff; Vergleich nach CR fehlt.", evidence("hit-points", "melee-attack", "damage"))
      : result("Unklar", "Für eine Brute-Einordnung fehlen belastbare Kombinationen aus Zähigkeit und Nahkampfschaden."),
    skirmisher: f.hasMobility && (f.hasMelee || f.hasRanged)
      ? result("Wahrscheinlich", "Explizite Mobilitätsfähigkeit zusammen mit einem strukturierten Angriff.", evidence("mobility-text", "melee-attack", "ranged-attack"))
      : result("Unklar", "Bewegungswerte allein belegen keine taktische Hit-and-Run-Funktion."),
    artillery: f.hasRanged && f.hasLongRange && c.highestAttackDamage !== null
      ? result("Belegt", "Strukturierter Fernkampfangriff mit mindestens 30 ft Reichweite und Schaden.", evidence("ranged-attack", "damage"))
      : f.hasRanged && c.highestAttackDamage !== null
        ? result("Wahrscheinlich", "Strukturierter Fernkampfschaden, aber keine belastbare große Reichweite.", evidence("ranged-attack", "damage"))
        : f.hasSaveDamage && f.hasStructuredArea
          ? result("Wahrscheinlich", "Strukturierter Flächen-Rettungswurf mit Schaden; das spricht für Fernwirkung, belegt aber keine Artillerie-Rolle.", evidence("area-template", "damage"))
        : result("Unklar", "Kein ausreichend dokumentierter Fernkampfangriff erkannt."),
    controller: f.hasControlEffect
      ? result("Belegt", "Strukturierter Effekt nennt mindestens einen Zustand.", evidence("condition-effect"))
      : f.hasSaveDamage && f.hasStructuredArea
        ? result("Wahrscheinlich", "Strukturierter Flächen-Rettungswurf kann Gegner beeinflussen; Kontrollwirkung ist nicht belegt.", evidence("area-template"))
        : result("Unklar", "Keine strukturierte Kontrollwirkung; Beschreibungstext allein wird nicht als Beleg gewertet."),
    support: f.hasHealing || f.hasAllyBuff
      ? result("Belegt", f.hasHealing ? "Strukturierte Heilaktivität vorhanden." : "Strukturierter Effekt zielt auf Verbündete.", evidence("healing", "ally-target"))
      : result("Unklar", "Keine strukturierte Heil- oder Verbündetenfähigkeit erkannt."),
  };
  const counts = Object.values(roles).reduce((acc, role) => (acc[role.status]++, acc), { Belegt: 0, Wahrscheinlich: 0, Unklar: 0 });
  const ranked = ["Belegt", "Wahrscheinlich"];
  const supported = TACTICAL_ROLES.filter((role) => ranked.includes(roles[role].status));
  const mainRole = supported.length === 1 ? supported[0] : null;
  const signature = JSON.stringify({ hp: c.hp, ac: c.ac, movement: c.facts.filter((x) => x.kind === "movement"), facts: c.facts });
  return { roles, mainRole, counts, signature, capabilities: c };
}

/** Apply a stored manual role selection for display without discarding automatic evidence. */
export function getTacticalRoleDisplay(evaluation, override) {
  if (!evaluation) return { roles: [], stale: false };
  const stale = Boolean(override && override.signature !== evaluation.signature);
  if (override) {
    const selected = new Set(Array.isArray(override.roles) ? override.roles.filter((role) => TACTICAL_ROLES.includes(role)) : []);
    return {
    stale,
    roles: TACTICAL_ROLES.map((role) => ({
      label: TACTICAL_ROLE_LABELS[role],
      status: selected.has(role) ? "Manuell" : "Unklar",
      reason: selected.has(role) ? "Weltweiter GM-Override" : "Durch manuellen Override ausgeblendet",
    })),
    };
  }
  return { stale: false, roles: Object.entries(evaluation.roles).map(([role, data]) => ({ label: TACTICAL_ROLE_LABELS[role], status: data.status, reason: data.reason })) };
}
