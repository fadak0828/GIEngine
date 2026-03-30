import { describe, it, expect } from 'vitest';
import { canvasToScene, sceneToCanvas, clampToScene, computeScale, type CanvasRect, type SceneDimensions } from '../src/utils/coordinate';

describe('coordinate transforms', () => {
  const sceneDimensions: SceneDimensions = { width: 1280, height: 720 };
  const canvasRect: CanvasRect = { left: 0, top: 0, width: 640, height: 360 };

  describe('canvasToScene', () => {
    it('converts canvas origin (0,0) to scene origin (0,0)', () => {
      const result = canvasToScene(0, 0, canvasRect, sceneDimensions);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
    });

    it('converts canvas center to scene center', () => {
      const result = canvasToScene(320, 180, canvasRect, sceneDimensions);
      expect(result.x).toBeCloseTo(640);
      expect(result.y).toBeCloseTo(360);
    });

    it('converts canvas bottom-right corner to scene bottom-right corner', () => {
      const result = canvasToScene(640, 360, canvasRect, sceneDimensions);
      expect(result.x).toBeCloseTo(1280);
      expect(result.y).toBeCloseTo(720);
    });

    it('scales proportionally (2x scene width)', () => {
      const result = canvasToScene(100, 50, canvasRect, sceneDimensions);
      expect(result.x).toBeCloseTo(200); // 100 * (1280/640)
      expect(result.y).toBeCloseTo(100); // 50 * (720/360)
    });

    it('handles non-square canvas with different x and y scales', () => {
      const nonSquareCanvas: CanvasRect = { left: 0, top: 0, width: 400, height: 200 };
      const result = canvasToScene(200, 100, nonSquareCanvas, sceneDimensions);
      expect(result.x).toBeCloseTo(640);  // 200 * (1280/400)
      expect(result.y).toBeCloseTo(360);  // 100 * (720/200)
    });

    it('applies canvas offset correctly', () => {
      const offsetCanvas: CanvasRect = { left: 100, top: 50, width: 640, height: 360 };
      // canvasX/Y are already relative to canvas left/top edge — offset is for abs positioning
      const result = canvasToScene(320, 180, offsetCanvas, sceneDimensions);
      expect(result.x).toBeCloseTo(640);
      expect(result.y).toBeCloseTo(360);
    });
  });

  describe('sceneToCanvas', () => {
    it('converts scene origin to canvas origin', () => {
      const result = sceneToCanvas(0, 0, canvasRect, sceneDimensions);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
    });

    it('converts scene center to canvas center', () => {
      const result = sceneToCanvas(640, 360, canvasRect, sceneDimensions);
      expect(result.x).toBeCloseTo(320);
      expect(result.y).toBeCloseTo(180);
    });

    it('converts scene bottom-right to canvas bottom-right', () => {
      const result = sceneToCanvas(1280, 720, canvasRect, sceneDimensions);
      expect(result.x).toBeCloseTo(640);
      expect(result.y).toBeCloseTo(360);
    });

    it('scales proportionally (0.5x of canvas)', () => {
      const result = sceneToCanvas(200, 100, canvasRect, sceneDimensions);
      expect(result.x).toBeCloseTo(100); // 200 * (640/1280)
      expect(result.y).toBeCloseTo(50);  // 100 * (360/720)
    });
  });

  describe('roundtrip: canvasToScene then sceneToCanvas', () => {
    it('produces original canvas coords', () => {
      const cx = 150;
      const cy = 75;
      const scene = canvasToScene(cx, cy, canvasRect, sceneDimensions);
      const canvas = sceneToCanvas(scene.x, scene.y, canvasRect, sceneDimensions);
      expect(canvas.x).toBeCloseTo(cx);
      expect(canvas.y).toBeCloseTo(cy);
    });

    it('produces original scene coords', () => {
      const sx = 960;
      const sy = 540;
      const canvas = sceneToCanvas(sx, sy, canvasRect, sceneDimensions);
      const scene = canvasToScene(canvas.x, canvas.y, canvasRect, sceneDimensions);
      expect(scene.x).toBeCloseTo(sx);
      expect(scene.y).toBeCloseTo(sy);
    });
  });

  describe('clampToScene', () => {
    it('passes through values within bounds', () => {
      const result = clampToScene(640, 360, sceneDimensions);
      expect(result.x).toBe(640);
      expect(result.y).toBe(360);
    });

    it('clamps negative x to 0', () => {
      const result = clampToScene(-10, 100, sceneDimensions);
      expect(result.x).toBe(0);
    });

    it('clamps x exceeding scene width', () => {
      const result = clampToScene(1500, 100, sceneDimensions);
      expect(result.x).toBe(1280);
    });

    it('clamps y to scene height', () => {
      const result = clampToScene(100, 800, sceneDimensions);
      expect(result.y).toBe(720);
    });

    it('clamps both axes simultaneously', () => {
      const result = clampToScene(-50, 1000, sceneDimensions);
      expect(result.x).toBe(0);
      expect(result.y).toBe(720);
    });
  });

  describe('computeScale', () => {
    it('returns correct scale factors for 2x downscale', () => {
      const result = computeScale(canvasRect, sceneDimensions);
      expect(result.scaleX).toBeCloseTo(0.5); // 640/1280
      expect(result.scaleY).toBeCloseTo(0.5); // 360/720
    });

    it('returns 1 for equal dimensions', () => {
      const equalCanvas: CanvasRect = { left: 0, top: 0, width: 1280, height: 720 };
      const result = computeScale(equalCanvas, sceneDimensions);
      expect(result.scaleX).toBeCloseTo(1);
      expect(result.scaleY).toBeCloseTo(1);
    });

    it('handles different x and y scales', () => {
      const wideCanvas: CanvasRect = { left: 0, top: 0, width: 1280, height: 360 };
      const result = computeScale(wideCanvas, sceneDimensions);
      expect(result.scaleX).toBeCloseTo(1);    // 1280/1280
      expect(result.scaleY).toBeCloseTo(0.5);  // 360/720
    });
  });
});
