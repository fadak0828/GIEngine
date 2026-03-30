import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasToScene, type CanvasRect, type SceneDimensions } from '@/utils/coordinate';

export type DragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'resize-n' | 'resize-s' | 'resize-w' | 'resize-e';

export interface DragState {
  isDragging: boolean;
  startSceneX: number;
  startSceneY: number;
  currentSceneX: number;
  currentSceneY: number;
  deltaX: number;
  deltaY: number;
}

interface UseCanvasDragOptions {
  canvasRectRef: React.RefObject<CanvasRect | null>;
  sceneDimensions: SceneDimensions;
  onDragStart?: (sceneX: number, sceneY: number, mode: DragMode) => void;
  onDragMove?: (dragState: DragState, mode: DragMode) => void;
  onDragEnd?: (dragState: DragState, mode: DragMode) => void;
}

interface UseCanvasDragReturn {
  startDrag: (e: React.PointerEvent, mode: DragMode) => void;
  dragState: DragState | null;
}

export function useCanvasDrag({
  canvasRectRef,
  sceneDimensions,
  onDragStart,
  onDragMove,
  onDragEnd,
}: UseCanvasDragOptions): UseCanvasDragReturn {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const modeRef = useRef<DragMode>('move');
  const startSceneRef = useRef({ x: 0, y: 0 });

  // Store active drag cleanup so unmount during a drag doesn't leak listeners
  const activeDragCleanupRef = useRef<(() => void) | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      activeDragCleanupRef.current?.();
      activeDragCleanupRef.current = null;
    };
  }, []);

  const startDrag = useCallback((e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    modeRef.current = mode;

    const canvasRect = canvasRectRef.current;
    if (!canvasRect) return;

    const clientX = e.clientX - canvasRect.left;
    const clientY = e.clientY - canvasRect.top;
    const { x: sceneX, y: sceneY } = canvasToScene(clientX, clientY, canvasRect, sceneDimensions);

    startSceneRef.current = { x: sceneX, y: sceneY };

    const initial: DragState = {
      isDragging: true,
      startSceneX: sceneX,
      startSceneY: sceneY,
      currentSceneX: sceneX,
      currentSceneY: sceneY,
      deltaX: 0,
      deltaY: 0,
    };
    setDragState(initial);
    onDragStart?.(sceneX, sceneY, mode);

    const handleMove = (moveEvent: PointerEvent) => {
      const rect = canvasRectRef.current;
      if (!rect) return;
      const cx = moveEvent.clientX - rect.left;
      const cy = moveEvent.clientY - rect.top;
      const { x: curX, y: curY } = canvasToScene(cx, cy, rect, sceneDimensions);
      const updated: DragState = {
        isDragging: true,
        startSceneX: startSceneRef.current.x,
        startSceneY: startSceneRef.current.y,
        currentSceneX: curX,
        currentSceneY: curY,
        deltaX: curX - startSceneRef.current.x,
        deltaY: curY - startSceneRef.current.y,
      };
      setDragState(updated);
      onDragMove?.(updated, modeRef.current);
    };

    const cleanup = () => {
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      activeDragCleanupRef.current = null;
    };

    const handleUp = (upEvent: PointerEvent) => {
      const rect = canvasRectRef.current;
      target.releasePointerCapture(upEvent.pointerId);
      cleanup();

      if (!rect) {
        setDragState(null);
        return;
      }
      const cx = upEvent.clientX - rect.left;
      const cy = upEvent.clientY - rect.top;
      const { x: curX, y: curY } = canvasToScene(cx, cy, rect, sceneDimensions);
      const final: DragState = {
        isDragging: false,
        startSceneX: startSceneRef.current.x,
        startSceneY: startSceneRef.current.y,
        currentSceneX: curX,
        currentSceneY: curY,
        deltaX: curX - startSceneRef.current.x,
        deltaY: curY - startSceneRef.current.y,
      };
      setDragState(null);
      onDragEnd?.(final, modeRef.current);
    };

    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
    activeDragCleanupRef.current = cleanup;
  }, [canvasRectRef, sceneDimensions, onDragStart, onDragMove, onDragEnd]);

  return { startDrag, dragState };
}
