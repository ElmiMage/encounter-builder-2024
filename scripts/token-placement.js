/**
 * Pure math for computing token drop positions — deliberately has zero
 * Foundry API dependencies so it can be unit-tested with plain Node.
 *
 * Places tokens in a rough spiral/ring pattern around a center point,
 * similar in spirit to what other encounter builders do when dropping
 * a full encounter onto a scene at once.
 */

/**
 * @param {number} centerX - pixel X to spiral around
 * @param {number} centerY - pixel Y to spiral around
 * @param {number} count - how many positions to generate
 * @param {number} spacing - distance between adjacent positions (pixels,
 *   typically one grid square)
 * @returns {{x:number, y:number}[]}
 */
export function computeSpiralPositions(centerX, centerY, count, spacing) {
  if (count <= 0) return [];
  const positions = [{ x: centerX, y: centerY }];
  if (count === 1) return positions;

  // Ring-by-ring placement: ring 1 has 6 slots, ring 2 has 12, etc.
  // (hex-ish spacing looks natural on both square and hex grids at this
  // level of approximation)
  let ring = 1;
  while (positions.length < count) {
    const slotsInRing = ring * 6;
    for (let i = 0; i < slotsInRing && positions.length < count; i++) {
      const angle = (2 * Math.PI * i) / slotsInRing;
      const radius = ring * spacing;
      positions.push({
        x: centerX + Math.round(radius * Math.cos(angle)),
        y: centerY + Math.round(radius * Math.sin(angle)),
      });
    }
    ring++;
  }
  return positions;
}

/**
 * Clamps a list of positions so nothing falls outside the scene bounds,
 * shifting the whole formation inward rather than clipping individual
 * points (keeps the group shape intact).
 */
export function clampToSceneBounds(positions, sceneWidth, sceneHeight, margin = 50) {
  const minX = Math.min(...positions.map((p) => p.x));
  const maxX = Math.max(...positions.map((p) => p.x));
  const minY = Math.min(...positions.map((p) => p.y));
  const maxY = Math.max(...positions.map((p) => p.y));

  let dx = 0;
  let dy = 0;
  if (minX < margin) dx = margin - minX;
  else if (maxX > sceneWidth - margin) dx = sceneWidth - margin - maxX;
  if (minY < margin) dy = margin - minY;
  else if (maxY > sceneHeight - margin) dy = sceneHeight - margin - maxY;

  if (dx === 0 && dy === 0) return positions;
  return positions.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}
