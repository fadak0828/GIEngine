import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasDrag, type DragMode } from '../src/hooks/useCanvasDrag';
import type { CanvasRect, SceneDimensions } from '../src/utils/coordinate';

/**
 * Build a minimal React.RefObject<CanvasRect | null>
 */
function makeRectRef(rect: CanvasRect | null) {
  return { current: rect } as React.RefObject<CanvasRect | null>;
}

const defaultScene: SceneDimensions = { width: 1280, height: 720 };
const defaultRect: CanvasRect = { left: 0, top: 0, width: 640, height: 360 };

/**
 * Create a fake PointerEvent with the given clientX/clientY.
 * We need addEventListener/removeEventListener on currentTarget.
 */
function makePointerEvent(
  type: string,
  clientX: number,
  clientY: number,
  pointerId = 1
): Partial<React.PointerEvent & PointerEvent> {
  const listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
  const target = {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    addEventListener(event: string, cb: EventListenerOrEventListenerObject) {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    },
    removeEventListener(event: string, cb: EventListenerOrEventListenerObject) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(l => l !== cb);
      }
    },
    _listeners: listeners,
  };
  return {
    type,
    clientX,
    clientY,
    pointerId,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: target as unknown as EventTarget & Element,
  };
}

describe('useCanvasDrag', () => {
  it('returns null dragState initially', () => {
    const ref = makeRectRef(defaultRect);
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene })
    );
    expect(result.current.dragState).toBeNull();
  });

  it('exposes a startDrag function', () => {
    const ref = makeRectRef(defaultRect);
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene })
    );
    expect(typeof result.current.startDrag).toBe('function');
  });

  it('returns null dragState when canvasRectRef.current is null', () => {
    const ref = makeRectRef(null);
    const onDragStart = vi.fn();
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene, onDragStart })
    );
    const event = makePointerEvent('pointerdown', 100, 50, 1);
    act(() => {
      result.current.startDrag(event as React.PointerEvent, 'move');
    });
    // Without a canvas rect, drag should not start
    expect(result.current.dragState).toBeNull();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('sets dragState on startDrag', () => {
    const ref = makeRectRef(defaultRect);
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene })
    );
    const event = makePointerEvent('pointerdown', 320, 180, 1);
    act(() => {
      result.current.startDrag(event as React.PointerEvent, 'move');
    });
    expect(result.current.dragState).not.toBeNull();
    expect(result.current.dragState!.isDragging).toBe(true);
    expect(result.current.dragState!.deltaX).toBe(0);
    expect(result.current.dragState!.deltaY).toBe(0);
  });

  it('calls onDragStart with correct scene coordinates', () => {
    const ref = makeRectRef(defaultRect);
    const onDragStart = vi.fn();
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene, onDragStart })
    );
    // canvas (320, 180) → scene (640, 360) for a 2x downscaled canvas
    const event = makePointerEvent('pointerdown', 320, 180, 1);
    act(() => {
      result.current.startDrag(event as React.PointerEvent, 'move');
    });
    expect(onDragStart).toHaveBeenCalledWith(640, 360, 'move');
  });

  it('calls onDragStart with correct mode for resize-nw', () => {
    const ref = makeRectRef(defaultRect);
    const onDragStart = vi.fn();
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene, onDragStart })
    );
    const event = makePointerEvent('pointerdown', 0, 0, 1);
    act(() => {
      result.current.startDrag(event as React.PointerEvent, 'resize-nw');
    });
    expect(onDragStart).toHaveBeenCalledWith(0, 0, 'resize-nw');
  });

  it('computes initial startSceneX and startSceneY correctly', () => {
    const ref = makeRectRef(defaultRect);
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene })
    );
    // canvas (160, 90) → scene (320, 180)
    const event = makePointerEvent('pointerdown', 160, 90, 1);
    act(() => {
      result.current.startDrag(event as React.PointerEvent, 'move');
    });
    expect(result.current.dragState!.startSceneX).toBeCloseTo(320);
    expect(result.current.dragState!.startSceneY).toBeCloseTo(180);
    expect(result.current.dragState!.currentSceneX).toBeCloseTo(320);
    expect(result.current.dragState!.currentSceneY).toBeCloseTo(180);
  });

  it('calls preventDefault and stopPropagation on startDrag', () => {
    const ref = makeRectRef(defaultRect);
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene })
    );
    const event = makePointerEvent('pointerdown', 0, 0, 1);
    act(() => {
      result.current.startDrag(event as React.PointerEvent, 'move');
    });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('calls setPointerCapture on the currentTarget', () => {
    const ref = makeRectRef(defaultRect);
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene })
    );
    const event = makePointerEvent('pointerdown', 0, 0, 42);
    act(() => {
      result.current.startDrag(event as React.PointerEvent, 'move');
    });
    const target = event.currentTarget as ReturnType<typeof makePointerEvent>['currentTarget'] & { setPointerCapture: ReturnType<typeof vi.fn> };
    expect((target as unknown as { setPointerCapture: ReturnType<typeof vi.fn> }).setPointerCapture).toHaveBeenCalledWith(42);
  });

  it('updates dragState on pointermove event', () => {
    const ref = makeRectRef(defaultRect);
    const onDragMove = vi.fn();
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene, onDragMove })
    );
    const downEvent = makePointerEvent('pointerdown', 160, 90, 1);
    act(() => {
      result.current.startDrag(downEvent as React.PointerEvent, 'move');
    });
    // Simulate pointermove by invoking registered listener
    const target = downEvent.currentTarget as unknown as { _listeners: Record<string, EventListenerOrEventListenerObject[]> };
    const moveListeners = target._listeners['pointermove'] ?? [];
    expect(moveListeners.length).toBeGreaterThan(0);
    const moveEvent = { clientX: 320, clientY: 180, pointerId: 1 } as PointerEvent;
    act(() => {
      (moveListeners[0] as EventListener)(moveEvent);
    });
    // New position: canvas (320,180) → scene (640,360); delta from (320,180): (+320,+180)
    expect(result.current.dragState!.currentSceneX).toBeCloseTo(640);
    expect(result.current.dragState!.currentSceneY).toBeCloseTo(360);
    expect(result.current.dragState!.deltaX).toBeCloseTo(320);
    expect(result.current.dragState!.deltaY).toBeCloseTo(180);
    expect(onDragMove).toHaveBeenCalled();
  });

  it('resets dragState to null on pointerup', () => {
    const ref = makeRectRef(defaultRect);
    const onDragEnd = vi.fn();
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene, onDragEnd })
    );
    const downEvent = makePointerEvent('pointerdown', 160, 90, 1);
    act(() => {
      result.current.startDrag(downEvent as React.PointerEvent, 'move');
    });
    const target = downEvent.currentTarget as unknown as { _listeners: Record<string, EventListenerOrEventListenerObject[]>; releasePointerCapture: ReturnType<typeof vi.fn> };
    const upListeners = target._listeners['pointerup'] ?? [];
    const upEvent = { clientX: 320, clientY: 180, pointerId: 1 } as PointerEvent;
    act(() => {
      (upListeners[0] as EventListener)(upEvent);
    });
    expect(result.current.dragState).toBeNull();
    expect(onDragEnd).toHaveBeenCalled();
  });

  it('onDragEnd receives isDragging=false in final state', () => {
    const ref = makeRectRef(defaultRect);
    const onDragEnd = vi.fn();
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene, onDragEnd })
    );
    const downEvent = makePointerEvent('pointerdown', 160, 90, 1);
    act(() => {
      result.current.startDrag(downEvent as React.PointerEvent, 'move');
    });
    const target = downEvent.currentTarget as unknown as { _listeners: Record<string, EventListenerOrEventListenerObject[]> };
    const upListeners = target._listeners['pointerup'] ?? [];
    act(() => {
      (upListeners[0] as EventListener)({ clientX: 320, clientY: 180, pointerId: 1 } as PointerEvent);
    });
    const finalState = onDragEnd.mock.calls[0][0];
    expect(finalState.isDragging).toBe(false);
  });

  it('onDragEnd is called with the current mode', () => {
    const ref = makeRectRef(defaultRect);
    const onDragEnd = vi.fn();
    const { result } = renderHook(() =>
      useCanvasDrag({ canvasRectRef: ref, sceneDimensions: defaultScene, onDragEnd })
    );
    const downEvent = makePointerEvent('pointerdown', 0, 0, 1);
    act(() => {
      result.current.startDrag(downEvent as React.PointerEvent, 'resize-se');
    });
    const target = downEvent.currentTarget as unknown as { _listeners: Record<string, EventListenerOrEventListenerObject[]> };
    act(() => {
      (target._listeners['pointerup'][0] as EventListener)(
        { clientX: 100, clientY: 100, pointerId: 1 } as PointerEvent
      );
    });
    expect(onDragEnd).toHaveBeenCalledWith(expect.anything(), 'resize-se');
  });
});
