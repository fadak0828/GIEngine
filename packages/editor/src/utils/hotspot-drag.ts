/**
 * hotspot-drag.ts — Pure drag/resize math for hotspot areas.
 *
 * All functions are pure (no side effects, no mutations). They take the
 * original HotspotArea, the current DragState, the drag mode, and the
 * scene dimensions, and return a NEW HotspotArea reflecting the updated
 * position or size.
 */

import type { HotspotArea } from '@gi-engine/core';
import type { DragMode, DragState } from '@/hooks/useCanvasDrag';
import type { SceneDimensions } from './coordinate';

const MIN_SIZE = 10;

/**
 * Clamp a value within [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply a drag (move or resize) to a rect HotspotArea.
 * Returns a new HotspotArea — does not mutate the original.
 *
 * For non-rect areas the original is returned unchanged.
 */
export function applyDragToArea(
  original: HotspotArea,
  dragState: DragState,
  mode: DragMode,
  sceneDimensions: SceneDimensions,
): HotspotArea {
  if (original.type !== 'rect') return original;

  const { x, y, width, height } = original;
  const { deltaX, deltaY } = dragState;
  const { width: sceneW, height: sceneH } = sceneDimensions;

  if (mode === 'move') {
    const newX = clamp(x + deltaX, 0, sceneW - width);
    const newY = clamp(y + deltaY, 0, sceneH - height);
    return { type: 'rect', x: newX, y: newY, width, height };
  }

  // Resize modes — compute candidate new corners
  let newX = x;
  let newY = y;
  let newW = width;
  let newH = height;

  // Right edge
  if (mode === 'resize-e' || mode === 'resize-ne' || mode === 'resize-se') {
    newW = Math.max(MIN_SIZE, width + deltaX);
    newW = Math.min(newW, sceneW - newX);
  }

  // Left edge
  if (mode === 'resize-w' || mode === 'resize-nw' || mode === 'resize-sw') {
    const candidateX = x + deltaX;
    const maxAllowedX = x + width - MIN_SIZE;
    newX = clamp(candidateX, 0, maxAllowedX);
    newW = x + width - newX;
  }

  // Bottom edge
  if (mode === 'resize-s' || mode === 'resize-se' || mode === 'resize-sw') {
    newH = Math.max(MIN_SIZE, height + deltaY);
    newH = Math.min(newH, sceneH - newY);
  }

  // Top edge
  if (mode === 'resize-n' || mode === 'resize-nw' || mode === 'resize-ne') {
    const candidateY = y + deltaY;
    const maxAllowedY = y + height - MIN_SIZE;
    newY = clamp(candidateY, 0, maxAllowedY);
    newH = y + height - newY;
  }

  return { type: 'rect', x: newX, y: newY, width: newW, height: newH };
}
