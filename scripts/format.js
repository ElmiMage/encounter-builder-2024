/**
 * Pure display-formatting helpers — no Foundry dependency, unit-testable
 * with plain Node.
 */

/**
 * Turns a raw system key like "veryRare" or "undead" into a
 * human-readable label: "Very Rare", "Undead". Idempotent on strings
 * that are already spelled out ("Arctic" stays "Arctic").
 */
export function humanizeToken(value) {
  if (!value) return value;
  const spaced = String(value).replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
