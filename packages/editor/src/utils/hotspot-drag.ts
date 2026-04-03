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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export interface GridSnapOptions {
  enabled: boolean;
  gridSize: number;
  shiftHeld: boolean;
}

export function applyDragToArea(
  original: HotspotArea,
  dragState: DragState,
  mode: DragMode,
  sceneDimensions: SceneDimensions,
  gridSnap?: GridSnapOptions,
): HotspotArea {
  if (original.type !== 'rect') return original;

  const { x, y, width, height } = original;
  const { deltaX, deltaY } = dragState;
  const { width: sceneW, height: sceneH } = sceneDimensions;
  const useSnap = gridSnap?.enabled && !gridSnap?.shiftHeld;
  const gridSize = gridSnap?.gridSize ?? 10;

  if (mode === 'move') {
    let newX = x + deltaX;
    let newY = y + deltaY;
    if (useSnap) {
      newX = snapToGrid(newX, gridSize);
      newY = snapToGrid(newY, gridSize);
    }
    newX = clamp(newX, 0, sceneW - width);
    newY = clamp(newY, 0, sceneH - height);
    return { type: 'rect', x: newX, y: newY, width, height };
  }

  let newX = x;
  let newY = y;
  let newW = width;
  let newH = height;

  if (mode === 'resize-e' || mode === 'resize-ne' || mode === 'resize-se') {
    newW = Math.max(MIN_SIZE, width + deltaX);
    if (useSnap) newW = snapToGrid(newX + newW, gridSize) - newX;
    newW = Math.min(newW, sceneW - newX);
  }

  if (mode === 'resize-w' || mode === 'resize-nw' || mode === 'resize-sw') {
    const candidateX = x + deltaX;
    if (useSnap) {
      const snappedRight = snapToGrid(x + width, gridSize);
      const snappedLeft = snapToGrid(candidateX, gridSize);
      newX = clamp(snappedLeft, 0, snappedRight - MIN_SIZE);
      newW = snappedRight - newX;
    } else {
      const maxAllowedX = x + width - MIN_SIZE;
      newX = clamp(candidateX, 0, maxAllowedX);
      newW = x + width - newX;
    }
  }

  if (mode === 'resize-s' || mode === 'resize-se' || mode === 'resize-sw') {
    newH = Math.max(MIN_SIZE, height + deltaY);
    if (useSnap) newH = snapToGrid(newY + newH, gridSize) - newY;
    newH = Math.min(newH, sceneH - newY);
  }

  if (mode === 'resize-n' || mode === 'resize-nw' || mode === 'resize-ne') {
    const candidateY = y + deltaY;
    if (useSnap) {
      const snappedBottom = snapToGrid(y + height, gridSize);
      const snappedTop = snapToGrid(candidateY, gridSize);
      newY = clamp(snappedTop, 0, snappedBottom - MIN_SIZE);
      newH = snappedBottom - newY;
    } else {
      const maxAllowedY = y + height - MIN_SIZE;
      newY = clamp(candidateY, 0, maxAllowedY);
      newH = y + height - newY;
    }
  }

  return { type: 'rect', x: newX, y: newY, width: newW, height: newH };
}
