/**
 * Prompts the GM to click a point on the canvas, resolving with local
 * canvas coordinates {x, y} to spiral the encounter's tokens around.
 *
 * Falls back to the scene center immediately (with a warning) if the
 * canvas isn't ready for interaction — this can legitimately happen if
 * the app is opened before a scene has finished loading.
 *
 * NOTE: depends on Foundry's global `canvas`/`ui` and PIXI's event
 * system, so unlike the other modules in this project this file can't
 * be unit-tested with plain Node — it needs a real Foundry session.
 */
export function pickCanvasPoint(scene) {
  if (!canvas?.ready || !canvas.stage) {
    const dims = scene.dimensions ?? { width: scene.width, height: scene.height };
    ui.notifications?.warn("Canvas not ready — placing encounter at scene center instead.");
    return Promise.resolve({ x: dims.width / 2, y: dims.height / 2 });
  }

  ui.notifications.info("Click on the canvas to choose where to place the encounter.");
  const previousCursor = canvas.stage.cursor;
  canvas.stage.cursor = "crosshair";

  return new Promise((resolve) => {
    const handler = (event) => {
      canvas.stage.off("pointerdown", handler);
      canvas.stage.cursor = previousCursor;
      // PIXI v7 (Foundry V11+) uses federated events with getLocalPosition
      // directly on the event; older interaction events nest it under
      // event.data. Supporting both keeps this working across the
      // V12-V14 range the module targets.
      const pos = event.getLocalPosition
        ? event.getLocalPosition(canvas.stage)
        : event.data.getLocalPosition(canvas.stage);
      resolve({ x: pos.x, y: pos.y });
    };
    canvas.stage.on("pointerdown", handler);
  });
}
