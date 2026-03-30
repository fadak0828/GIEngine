/**
 * coordinate.ts — Canvas ↔ Scene coordinate transforms
 *
 * The scene has a fixed "design resolution" (e.g. 1280×720).
 * The canvas element on screen may be a different size due to scaling.
 * These helpers convert between the two coordinate spaces.
 */

export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SceneDimensions {
  width: number;
  height: number;
}

/**
 * Convert a canvas pixel coordinate to scene-space coordinates.
 *
 * @param canvasX - X in canvas pixels (relative to canvas element left edge)
 * @param canvasY - Y in canvas pixels (relative to canvas element top edge)
 * @param canvasRect - Bounding rect of the canvas element in the page
 * @param sceneDimensions - Design resolution of the scene
 * @returns {x, y} in scene coordinates (0..width, 0..height)
 */
export function canvasToScene(
  canvasX: number,
  canvasY: number,
  canvasRect: CanvasRect,
  sceneDimensions: SceneDimensions,
): { x: number; y: number } {
  const scaleX = sceneDimensions.width / canvasRect.width;
  const scaleY = sceneDimensions.height / canvasRect.height;
  return {
    x: canvasX * scaleX,
    y: canvasY * scaleY,
  };
}

/**
 * Convert a scene-space coordinate to canvas pixel coordinates.
 *
 * @param sceneX - X in scene coordinates
 * @param sceneY - Y in scene coordinates
 * @param canvasRect - Bounding rect of the canvas element in the page
 * @param sceneDimensions - Design resolution of the scene
 * @returns {x, y} in canvas pixels relative to canvas element
 */
export function sceneToCanvas(
  sceneX: number,
  sceneY: number,
  canvasRect: CanvasRect,
  sceneDimensions: SceneDimensions,
): { x: number; y: number } {
  const scaleX = canvasRect.width / sceneDimensions.width;
  const scaleY = canvasRect.height / sceneDimensions.height;
  return {
    x: sceneX * scaleX,
    y: sceneY * scaleY,
  };
}

/**
 * Clamp coordinates to scene boundaries.
 */
export function clampToScene(
  x: number,
  y: number,
  sceneDimensions: SceneDimensions,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(sceneDimensions.width, x)),
    y: Math.max(0, Math.min(sceneDimensions.height, y)),
  };
}

/**
 * Compute scale factor from scene design dimensions to canvas element dimensions.
 */
export function computeScale(
  canvasRect: CanvasRect,
  sceneDimensions: SceneDimensions,
): { scaleX: number; scaleY: number } {
  return {
    scaleX: canvasRect.width / sceneDimensions.width,
    scaleY: canvasRect.height / sceneDimensions.height,
  };
}
