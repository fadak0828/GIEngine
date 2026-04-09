/**
 * hotspot-detector.ts 단위 테스트
 *
 * 검증 항목:
 * 1. 빈 핫스팟 리스트 → 즉시 빈 배열 반환
 * 2. Vision 감지 성공 → 정규화 좌표를 픽셀로 변환하여 반환
 * 3. 부분 감지 실패 (일부 hotspot 누락) → fallback to smart positions
 * 4. API 에러 → fallback to smart positions
 * 5. parseBoundingBoxes: JSON 형식 파싱
 * 6. parseBoundingBoxes: regex 패턴 파싱
 * 7. normalizedToPixel: 정규화 → 픽셀 변환
 * 8. fallback 신뢰도는 0.5, 성공 시 0.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectHotspotsFromImage } from '../src/generators/hotspot-detector.js';

// ─── 모킹 ─────────────────────────────────────────────────────────────────────

vi.mock('../src/providers/factory.js', () => ({
  getProvider: vi.fn(),
}));

vi.mock('../src/interview/blueprint-converter.js', () => ({
  calcSmartHotspotPositions: vi.fn(),
}));

import { getProvider } from '../src/providers/factory.js';
import { AIProvider } from '../src/providers/index.js';
import { calcSmartHotspotPositions } from '../src/interview/blueprint-converter.js';

const mockGetProvider = vi.mocked(getProvider);
const mockCalcSmartPositions = vi.mocked(calcSmartHotspotPositions);

const mockProvider = {
  analyzeImage: vi.fn(),
};

// ─── 픽스처 ───────────────────────────────────────────────────────────────────

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;

function makeHotspot(id: string, label = '오브젝트', actionType = 'examine') {
  return { hotspotId: id, label, actionType };
}

function makeSmartPositionResult(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    x: 100 + i * 200,
    y: 200,
    width: 140,
    height: 100,
  }));
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

describe('detectHotspotsFromImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalcSmartPositions.mockImplementation((hotspots, _w, _h) =>
      makeSmartPositionResult(hotspots.length),
    );
    mockGetProvider.mockReturnValue(mockProvider as unknown as AIProvider);
  });

  // ── 1. 빈 핫스팟 ─────────────────────────────────────────────────────────

  it('핫스팟 리스트가 비어 있으면 API 호출 없이 빈 배열을 반환해야 함', async () => {
    const result = await detectHotspotsFromImage({
      imageBase64: 'base64data',
      hotspots: [],
      sceneWidth: SCENE_WIDTH,
      sceneHeight: SCENE_HEIGHT,
    });

    expect(result).toEqual([]);
    expect(mockProvider.analyzeImage).not.toHaveBeenCalled();
  });

  // ── 2. Vision 감지 성공 (JSON 응답) ──────────────────────────────────────

  it('Vision API가 유효한 JSON을 반환하면 모든 핫스팟이 감지되어야 함', async () => {
    const hotspots = [makeHotspot('hs-1', '나무'), makeHotspot('hs-2', '문')];

    // Vision API 응답: 정규화된 좌표 (0-1 범위)
    mockProvider.analyzeImage.mockResolvedValueOnce(
      JSON.stringify({
        detections: [
          { hotspotId: 'hs-1', bbox: [0.1, 0.2, 0.15, 0.18], confidence: 0.9 },
          { hotspotId: 'hs-2', bbox: [0.6, 0.5, 0.12, 0.2], confidence: 0.85 },
        ],
      }),
    );

    const result = await detectHotspotsFromImage({
      imageBase64: 'base64data',
      hotspots,
      sceneWidth: SCENE_WIDTH,
      sceneHeight: SCENE_HEIGHT,
    });

    expect(result).toHaveLength(2);

    // hs-1: x=0.1*1920=192, y=0.2*1080=216, w=0.15*1920=288, h=0.18*1080=194 (round)
    const hs1 = result.find(r => r.hotspotId === 'hs-1');
    expect(hs1).toBeDefined();
    expect(hs1!.area.type).toBe('rect');
    expect((hs1!.area as { x: number; y: number }).x).toBe(192);
    expect((hs1!.area as { y: number }).y).toBe(216);
    expect(hs1!.confidence).toBe(0.8);

    // hs-2: x=0.6*1920=1152, y=0.5*1080=540
    const hs2 = result.find(r => r.hotspotId === 'hs-2');
    expect(hs2).toBeDefined();
    expect((hs2!.area as { x: number }).x).toBe(1152);
    expect((hs2!.area as { y: number }).y).toBe(540);
  });

  it('감지된 모든 핫스팟의 신뢰도는 0.8이어야 함', async () => {
    const hotspots = [makeHotspot('hs-1')];
    mockProvider.analyzeImage.mockResolvedValueOnce(
      JSON.stringify({
        detections: [{ hotspotId: 'hs-1', bbox: [0.1, 0.1, 0.1, 0.1], confidence: 0.99 }],
      }),
    );

    const result = await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: 1920,
      sceneHeight: 1080,
    });

    expect(result[0].confidence).toBe(0.8);
  });

  // ── 3. 부분 감지 실패 → fallback ──────────────────────────────────────────

  it('일부 핫스팟이 감지되지 않으면 fallback smart positions를 반환해야 함', async () => {
    const hotspots = [makeHotspot('hs-1'), makeHotspot('hs-2'), makeHotspot('hs-3')];

    // hs-3만 누락
    mockProvider.analyzeImage.mockResolvedValueOnce(
      JSON.stringify({
        detections: [
          { hotspotId: 'hs-1', bbox: [0.1, 0.2, 0.1, 0.1], confidence: 0.9 },
          { hotspotId: 'hs-2', bbox: [0.5, 0.5, 0.1, 0.1], confidence: 0.8 },
        ],
      }),
    );

    const result = await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: SCENE_WIDTH,
      sceneHeight: SCENE_HEIGHT,
    });

    expect(mockCalcSmartPositions).toHaveBeenCalledOnce();
    expect(result).toHaveLength(3);
    // fallback 신뢰도는 0.5
    expect(result.every(r => r.confidence === 0.5)).toBe(true);
  });

  it('응답에서 감지된 핫스팟이 0개이면 fallback을 사용해야 함', async () => {
    const hotspots = [makeHotspot('hs-1')];
    mockProvider.analyzeImage.mockResolvedValueOnce(
      JSON.stringify({ detections: [] }),
    );

    const result = await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: 1920,
      sceneHeight: 1080,
    });

    expect(mockCalcSmartPositions).toHaveBeenCalledOnce();
    expect(result[0].confidence).toBe(0.5);
  });

  // ── 4. API 에러 → fallback ────────────────────────────────────────────────

  it('Vision API 호출이 실패하면 fallback smart positions를 반환해야 함', async () => {
    const hotspots = [makeHotspot('hs-1'), makeHotspot('hs-2')];
    mockProvider.analyzeImage.mockRejectedValueOnce(new Error('API quota exceeded'));

    const result = await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: SCENE_WIDTH,
      sceneHeight: SCENE_HEIGHT,
    });

    expect(mockCalcSmartPositions).toHaveBeenCalledOnce();
    expect(result).toHaveLength(2);
    expect(result.every(r => r.confidence === 0.5)).toBe(true);
  });

  it('응답이 유효하지 않은 JSON이면 fallback을 사용해야 함', async () => {
    const hotspots = [makeHotspot('hs-1')];
    mockProvider.analyzeImage.mockResolvedValueOnce('잘못된 JSON 응답입니다');

    const result = await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: 1920,
      sceneHeight: 1080,
    });

    expect(mockCalcSmartPositions).toHaveBeenCalledOnce();
    expect(result[0].confidence).toBe(0.5);
  });

  // ── 5. normalizedToPixel 변환 검증 ────────────────────────────────────────

  it('정규화된 좌표가 올바르게 픽셀 좌표로 변환되어야 함', async () => {
    const hotspots = [makeHotspot('hs-1')];
    // 0.5, 0.5, 0.2, 0.1 → x=960, y=540, w=384, h=108
    mockProvider.analyzeImage.mockResolvedValueOnce(
      JSON.stringify({
        detections: [{ hotspotId: 'hs-1', bbox: [0.5, 0.5, 0.2, 0.1], confidence: 0.9 }],
      }),
    );

    const result = await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: 1920,
      sceneHeight: 1080,
    });

    expect(result).toHaveLength(1);
    const area = result[0].area as { x: number; y: number; width: number; height: number };
    expect(area.x).toBe(960);   // 0.5 * 1920
    expect(area.y).toBe(540);   // 0.5 * 1080
    expect(area.width).toBe(384);  // 0.2 * 1920
    expect(area.height).toBe(108); // 0.1 * 1080
  });

  it('Math.round가 적용되어 정수 픽셀 값을 반환해야 함', async () => {
    const hotspots = [makeHotspot('hs-1')];
    // 0.333... → Math.round(0.333 * 1920) = Math.round(639.36) = 639
    mockProvider.analyzeImage.mockResolvedValueOnce(
      JSON.stringify({
        detections: [{ hotspotId: 'hs-1', bbox: [1 / 3, 1 / 3, 0.1, 0.1], confidence: 0.9 }],
      }),
    );

    const result = await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: 1920,
      sceneHeight: 1080,
    });

    const area = result[0].area as { x: number; y: number };
    expect(Number.isInteger(area.x)).toBe(true);
    expect(Number.isInteger(area.y)).toBe(true);
  });

  // ── 6. fallback 좌표 구조 검증 ────────────────────────────────────────────

  it('fallback 결과의 각 hotspotId가 입력과 일치해야 함', async () => {
    const hotspots = [
      makeHotspot('hs-alpha', '책상'),
      makeHotspot('hs-beta', '의자'),
    ];
    mockProvider.analyzeImage.mockRejectedValueOnce(new Error('timeout'));
    mockCalcSmartPositions.mockReturnValueOnce([
      { x: 100, y: 200, width: 140, height: 100 },
      { x: 400, y: 300, width: 140, height: 100 },
    ]);

    const result = await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: SCENE_WIDTH,
      sceneHeight: SCENE_HEIGHT,
    });

    expect(result[0].hotspotId).toBe('hs-alpha');
    expect(result[1].hotspotId).toBe('hs-beta');
    expect((result[0].area as { x: number }).x).toBe(100);
    expect((result[1].area as { x: number }).x).toBe(400);
  });

  it('fallback 호출 시 calcSmartHotspotPositions에 올바른 인자를 전달해야 함', async () => {
    const hotspots = [makeHotspot('hs-1', '문', 'navigate')];
    mockProvider.analyzeImage.mockRejectedValueOnce(new Error('error'));

    await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: 800,
      sceneHeight: 600,
    });

    expect(mockCalcSmartPositions).toHaveBeenCalledWith(
      [{ action: { type: 'navigate' } }],
      800,
      600,
    );
  });

  // ── 7. area.type 검증 ─────────────────────────────────────────────────────

  it('감지된 핫스팟의 area.type은 "rect"이어야 함', async () => {
    const hotspots = [makeHotspot('hs-1')];
    mockProvider.analyzeImage.mockResolvedValueOnce(
      JSON.stringify({
        detections: [{ hotspotId: 'hs-1', bbox: [0.1, 0.1, 0.1, 0.1], confidence: 0.9 }],
      }),
    );

    const result = await detectHotspotsFromImage({
      imageBase64: 'img',
      hotspots,
      sceneWidth: 1920,
      sceneHeight: 1080,
    });

    expect(result[0].area.type).toBe('rect');
  });
});
