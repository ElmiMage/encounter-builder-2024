/** Pure extraction and evidence-based tactical role classification. */
export const TACTICAL_ROLES = Object.freeze(["defender", "brute", "skirmisher", "artillery", "controller", "support"]);
export const TACTICAL_ROLE_LABELS = Object.freeze({ defender: "Defender", brute: "Brute", skirmisher: "Skirmisher", artillery: "Artillery", controller: "Controller", support: "Support" });

/** Return only uncached entries unless the GM explicitly requests a refresh. */
export function getTacticalRoleLoadPlan(monsters, cache, refresh = false) {
  return monsters.filter((monster) => refresh || !cache.has(monster.uuid));
}

export const TACTICAL_CR_BANDS = Object.freeze([[0, 2.5], [3, 4.5], [5, 6.5], [7, 10], [11, 16], [17, Infinity]]);
export function tacticalCrBand(cr) {
  if (cr == null || cr === "") return -1;
  const value = Number(cr);
  return TACTICAL_CR_BANDS.findIndex(([min, max]) => Number.isFinite(value) && value >= min && value <= max);
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
  let hasHitAndRun = false;
  let hasAllyProtection = false;
  let hasEnemyBinding = false;
  let hasEnemyControl = false;
  let hasAllyHealing = false;
  let bestMelee = null;
  let bestRanged = null;
  let hasControlEffect = false;
  let hasHealing = false;
  let hasLimitedUse = false;
  let hasRepeatableRanged = false;
  let hasLimitedRanged = false;

  for (const [itemIndex, item] of items.entries()) {
    const base = `items[${itemIndex}](${item?.name ?? "unnamed"})`;
    const activities = asArray(item?.system?.activities);
    for (const [activityIndex, activity] of activities.entries()) {
      const src = `${base}.activities[${activityIndex}](${activity?.name ?? activity?.type ?? "activity"})`;
      const activityRange = activity?.range ?? {};
      const itemRange = item?.system?.range ?? {};
      const range = Number(activityRange.value);
      const longRange = Number(itemRange.long ?? activityRange.long);
      const attackType = String(activity?.attack?.type?.value ?? activity?.attack?.type ?? "").toLowerCase();
      const weaponType = String(item?.system?.type?.value ?? "");
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
        const isRanged = attackType === "ranged" || ["simpleR", "martialR"].includes(weaponType) || positive(longRange);
        const isMelee = !isRanged && (attackType === "melee" || ["natural", "simpleM", "martialM"].includes(weaponType) || positive(range) && activityRange.units !== "self" && range <= 10);
        if (isRanged) {
          hasRanged = true;
          const effectiveRange = positive(longRange) ? longRange : (positive(itemRange.value) ? Number(itemRange.value) : range);
          if (effectiveRange >= 30) hasLongRange = true;
          const limited = positive(activity?.uses?.max) || positive(item?.system?.uses?.max) || activity?.uses?.recovery?.some?.((r) => r?.period === "recharge") || item?.system?.uses?.recovery?.some?.((r) => r?.period === "recharge");
          const record = { damage: damageValue, range: effectiveRange || null, repeatable: !limited, source: src };
          if (!bestRanged || record.damage > bestRanged.damage) bestRanged = record;
          hasRepeatableRanged ||= !limited;
          hasLimitedRanged ||= Boolean(limited);
          add("ranged-attack", `${src}.range`, `${effectiveRange || "unknown"} ft; ${damageValue} average damage`);
        } else if (isMelee) {
          hasMelee = true;
          highestMeleeDamage = Math.max(highestMeleeDamage, damageValue);
          const record = { damage: damageValue, source: src };
          if (!bestMelee || record.damage > bestMelee.damage) bestMelee = record;
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
        const targetType = activity?.target?.affects?.type ?? activity?.target?.type;
        const selfTarget = targetType === "self" || /self/i.test(String(activity?.target?.affects?.special ?? ""));
        const allyTarget = targetType === "ally" || /ally|friendly|another creature|one creature other than you|one creature of its choice/i.test(String(item?.system?.description?.value ?? ""));
        hasAllyHealing ||= !selfTarget && allyTarget;
        add(selfTarget ? "self-healing" : allyTarget ? "ally-healing" : "healing", src, "Structured heal activity; target is not established as an ally unless data/text says so");
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
        if (/defen[cs]e|armor class|system\.attributes\.ac\.|resistance|system\.traits\.(dr|di)|temporary hit points|system\.attributes\.hp\.|ward|protect/i.test(effectText)) { hasDefense = true; hasAllyProtection = true; }
      }
      const recharge = activity?.uses?.recovery?.some?.((r) => r?.period === "recharge") || item?.system?.uses?.recovery?.some?.((r) => r?.period === "recharge");
      if (recharge || positive(activity?.uses?.max) || positive(item?.system?.uses?.max)) {
        hasLimitedUse = true;
        add("limited-use", `${src}.uses`, recharge ? "Recharge" : "Limited uses");
      }
    }
    // Only explicit, narrowly recognized traits; prose is a weaker clue.
    const description = `${item?.name ?? ""} ${item?.system?.description?.value ?? ""}`.toLowerCase();
    if (/bonus action[^.]{0,100}\b(hide|disengage|dash|teleport)\b|\b(hide|disengage|dash)\b[^.]{0,100}\bbonus action\b|\bteleport[s]?\b.{0,80}\b(feet|ft\.)\b|cunning action|after (it|the creature) hits[^.]{0,120}(move|without provoking|opportunity attack)|move[s]? up to \d+ feet without provoking opportunity attacks/i.test(description)) {
      hasMobility = true;
      hasHitAndRun = true;
      add("mobility-text", `${base}.description`, "Explicit tactical mobility / hit-and-run wording");
    }
    if (/grapple|restrain|taunt|compel.{0,40}attack|can't willingly move|cannot willingly move|speed becomes 0/i.test(description)) { hasEnemyBinding = true; add("enemy-binding-text", `${base}.description`, "Description indicates binding, forced focus, or movement restriction"); }
    if (/frightened|paralyzed|poisoned|restrained|stunned|blinded|charmed|incapacitated|prone|banish|incapacit|can't take reactions|cannot take reactions|reduce[s]? (its |the target's )?speed|push(?:es)?|pull(?:s)?|knock(?:s)? prone/i.test(description)) { hasEnemyControl = true; add("enemy-control-text", `${base}.description`, "Description indicates an enemy-facing condition or movement/action control"); }
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
    meleeDamage: bestMelee?.damage ?? null, rangedDamage: bestRanged?.damage ?? null, rangedRange: bestRanged?.range ?? null,
    flags: { hasMelee, hasRanged, hasLongRange, hasStructuredArea, hasSaveDamage, hasAllyBuff, hasDefense, hasMobility, hasHitAndRun, hasAllyProtection, hasEnemyBinding, hasEnemyControl, hasAllyHealing, hasControlEffect, hasHealing, hasLimitedUse, hasRepeatableRanged, hasLimitedRanged, hasMovement: speeds.length > 0 },
  };
}

function result(status, reason, evidence = []) { return { status, reason, evidence }; }

/** Every role is returned; uncertain/missing source data stays Unklar. */
export function classifyTacticalRoles(actor, context = {}) {
  const c = extractTacticalCapabilities(actor);
  const f = c.flags;
  const evidence = (...kinds) => c.facts.filter((fact) => kinds.includes(fact.kind));
  const roles = {
    defender: f.hasDefense && f.hasAllyBuff
      ? result("Belegt", "Strukturierter Verbündeten-Effekt bietet ausdrücklich Schutz.", evidence("ally-target"))
      : c.ac !== null && c.ac >= 17
        ? result("Unklar", "Hohe AC deutet auf eigene Widerstandsfähigkeit, belegt aber keine Defender-Funktion oder Schutz für Verbündete.", evidence("armor-class"))
        : result("Unklar", "Keine eindeutige strukturierte Schutzfähigkeit erkannt."),
    brute: context.bruteEligible === true && f.hasMelee && c.hp !== null && c.meleeDamage !== null
      ? result(context.bruteRelative === true ? "Wahrscheinlich" : "Unklar", context.bruteRelative === true ? "Nahkampfangriff plus HP und Nahkampfschaden oberhalb des 75. Perzentils der verfügbaren CR-Gruppe." : "CR-Gruppe enthält zu wenige vollständige Vergleichsmonster für eine robuste relative Brute-Einordnung.", [...evidence("hit-points", "melee-attack"), ...c.facts.filter((fact) => fact.kind === "melee-attack")])
      : result("Unklar", "Brute erfordert Nahkampf und überdurchschnittliche Robustheit sowie Nahkampfdruck relativ zur CR-Gruppe."),
    skirmisher: f.hasHitAndRun && (f.hasMelee || f.hasRanged)
      ? result("Wahrscheinlich", "Explizite Hit-and-run- oder Repositionierungsfähigkeit plus strukturierter Angriff.", evidence("mobility-text", "melee-attack", "ranged-attack"))
      : result("Unklar", "Bewegungswerte allein belegen keine taktische Hit-and-Run-Funktion."),
    artillery: f.hasRanged && c.rangedDamage !== null && f.hasLongRange && (!f.hasMelee || c.rangedDamage >= (c.meleeDamage ?? 0) * 0.8) && f.hasRepeatableRanged
      ? result("Belegt", "Strukturierter, wiederholbarer Fernkampfangriff mit Reichweite und relevantem Schaden gegenüber der Nahkampfoption.", evidence("ranged-attack", "damage"))
      : f.hasRanged && c.rangedDamage !== null && f.hasLongRange && (!f.hasMelee || c.rangedDamage >= (c.meleeDamage ?? 0) * 0.8) && f.hasLimitedRanged && !f.hasRepeatableRanged
        ? result("Wahrscheinlich", "Relevanter Fernkampfangriff erkannt, aber seine begrenzte Nutzung verhindert eine Aussage als prägende wiederholbare Option.", evidence("ranged-attack", "limited-use"))
        : result("Unklar", "Ein Fernkampfangriff oder Schadensflächen allein belegen keine prägende, wiederholbare Artillerie-Option."),
    controller: f.hasControlEffect || f.hasEnemyControl
      ? result(f.hasControlEffect ? "Belegt" : "Wahrscheinlich", f.hasControlEffect ? "Strukturierter Activity-/Item-Effekt nennt einen Kontrollzustand." : "Beschreibung nennt eine gegnerische Bewegungs-/Handlungseinschränkung; Textregel bleibt heuristisch.", evidence("condition-effect", "enemy-control-text"))
      : result("Unklar", "Reiner Schaden, Flächen-Saves und nicht zielgerichtete Statusdaten belegen keine Kontrollfunktion."),
    support: f.hasAllyHealing || f.hasAllyProtection || f.hasAllyBuff
      ? result(f.hasAllyBuff && c.facts.some((fact) => fact.kind === "ally-target" && fact.detail === "ally") ? "Belegt" : "Wahrscheinlich", "Heilung, Schutz oder Stärkung ist auf Verbündete gerichtet; textbasierte Zieldeutung bleibt heuristisch.", evidence("ally-healing", "ally-target"))
      : result("Unklar", "Keine strukturierte Heil- oder Verbündetenfähigkeit erkannt."),
  };
  if (f.hasEnemyBinding && roles.defender.status === "Unklar") roles.defender = result("Wahrscheinlich", "Explizite Bindungs- oder Fokusfunktion gegen Gegner erkannt.", evidence("enemy-binding-text"));
  const counts = Object.values(roles).reduce((acc, role) => (acc[role.status]++, acc), { Belegt: 0, Wahrscheinlich: 0, Unklar: 0 });
  const ranked = ["Belegt", "Wahrscheinlich"];
  const supported = TACTICAL_ROLES.filter((role) => ranked.includes(roles[role].status));
  const mainRole = supported.length === 1 ? supported[0] : null;
  const significance = Object.fromEntries(TACTICAL_ROLES.map((role) => [role, roles[role].status === "Unklar" ? "Possible" : supported.length === 1 && !(role === "artillery" && !f.hasRepeatableRanged) ? "Main" : "Secondary"]));
  const signature = JSON.stringify({ hp: c.hp, ac: c.ac, movement: c.facts.filter((x) => x.kind === "movement"), facts: c.facts });
  return { roles, mainRole, significance, counts, signature, capabilities: c, comparison: context.comparison ?? null };
}

/** Classify a complete available pool using within-band cohort statistics, never a global fixed HP cutoff. */
export function classifyTacticalRolePool(actors) {
  const profiles = actors.map((actor) => ({ actor, capabilities: extractTacticalCapabilities(actor), cr: actor?.system?.details?.cr == null || actor.system.details.cr === "" ? null : Number(actor.system.details.cr) }));
  const output = new Map();
  for (const profile of profiles) {
    const band = tacticalCrBand(profile.cr);
    const cohort = band < 0 ? [] : profiles.filter((row) => tacticalCrBand(row.cr) === band && row.capabilities.hp !== null && row.capabilities.meleeDamage !== null);
    const hpValues = cohort.map((row) => row.capabilities.hp).sort((a, b) => a - b);
    const damageValues = cohort.map((row) => row.capabilities.meleeDamage).sort((a, b) => a - b);
    const percentile = (values, p) => values.length ? values[Math.floor((values.length - 1) * p)] : null;
    const bruteEligible = cohort.length >= 20;
    const bruteRelative = bruteEligible && profile.capabilities.hp >= percentile(hpValues, 0.75) && profile.capabilities.meleeDamage >= percentile(damageValues, 0.75);
    output.set(profile.actor.uuid, classifyTacticalRoles(profile.actor, { bruteEligible, bruteRelative, cohortSize: cohort.length, crBand: band, comparison: { crBand: band, cohortSize: cohort.length, minimumCohort: 20, hpP75: percentile(hpValues, 0.75), meleeDamageP75: percentile(damageValues, 0.75) } }));
  }
  return output;
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
      significance: selected.has(role) ? selected.size === 1 ? "Main" : "Secondary" : "Possible",
      reason: selected.has(role) ? "Weltweiter GM-Override" : "Durch manuellen Override ausgeblendet",
    })),
    };
  }
  return { stale: false, roles: Object.entries(evaluation.roles).map(([role, data]) => ({ label: TACTICAL_ROLE_LABELS[role], status: data.status, significance: evaluation.significance?.[role] ?? "Possible", reason: data.reason })) };
}
