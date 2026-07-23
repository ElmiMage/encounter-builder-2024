/**
 * Groups a flat list of { collection, label, total, enabled, groupKey,
 * groupLabel } pack entries into { groupKey, groupLabel, packs,
 * allEnabled, someEnabled } buckets, sorted alphabetically by group
 * label. Pure logic — no Foundry dependency — since groupKey/groupLabel
 * are already resolved upstream (see getPackGroupInfo in
 * compendium-browser.js).
 *
 * `someEnabled` (true) combined with `allEnabled` (false) means "mixed"
 * — some but not all packs in the group are enabled — which the UI
 * renders as an indeterminate (dash) checkbox rather than a plain
 * checked/unchecked one, so it's clear individual sub-selections are
 * still in effect even though the group-level box isn't fully checked.
 */
export function groupPacksBySource(packs) {
  const groups = new Map();
  for (const pack of packs) {
    if (!groups.has(pack.groupKey)) {
      groups.set(pack.groupKey, { groupKey: pack.groupKey, groupLabel: pack.groupLabel, packs: [] });
    }
    groups.get(pack.groupKey).packs.push(pack);
  }

  return [...groups.values()]
    .map((g) => {
      const allEnabled = g.packs.every((p) => p.enabled);
      const someEnabled = g.packs.some((p) => p.enabled);
      return { ...g, allEnabled, someEnabled, mixed: someEnabled && !allEnabled };
    })
    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel));
}
