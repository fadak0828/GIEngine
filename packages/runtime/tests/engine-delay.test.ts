/**
 * engine.ts scheduleDelayedEffects — Phase 4 딜레이 메커니즘 단위 테스트
 *
 * scheduleDelayedEffects(effects):
 *   - delay 타입 SideEffect는 이후 효과들에 대해 누적 지연(ms)을 설정
 *   - delay 없는 효과는 즉시 실행
 *   - delay 후 효과는 setTimeout으로 스케줄
 *   - 여러 delay가 누적됨
 *
 * GIEngine 전체를 instantiate하지 않고 scheduleDelayedEffects를 격리 테스트.
 * executeSideEffect를 vi.spyOn으로 대체하여 타이밍만 검증.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SideEffect, AssetManifest } from '@gi-engine/core';
import { GIEngine } from '../src/engine';

// ── 최소 GameDefinition 팩토리 ───────────────────────────────────────────────

function makeMinimalDef() {
  return {
    id: 'test-game',
    version: '1.0.0',
    title: { ko: '테스트', en: 'Test' },
    description: { ko: '', en: '' },
    supportedLocales: ['ko' as const],
    settings: {
      validationFeedbackDuration: 1500,
      autoSaveInterval: 30000,
      debug: false,
      unlockMode: 'sequential' as const,
      cssPrefix: 'gi',
    },
    acts: [],
    assets: { items: {} } as AssetManifest,
  };
}

// ── 테스트 헬퍼 ──────────────────────────────────────────────────────────────

function makeEngine() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const engine = new GIEngine({
    container,
    definition: makeMinimalDef(),
    loadSave: false,
  });
  return { engine, container };
}

// ── SideEffect 팩토리 ─────────────────────────────────────────────────────────

const unlockEffect = (caseId = 'case-1'): SideEffect => ({ type: 'unlock_case', caseId });
const delayEffect = (duration: number): SideEffect => ({ type: 'delay', duration });

// ────────────────────────────────────────────────────────────────────────────

describe('GIEngine.scheduleDelayedEffects — Phase 4 딜레이 메커니즘', () => {
  let engine: GIEngine;
  let container: HTMLElement;
  let executespy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ engine, container } = makeEngine());
    // executeSideEffect를 spy로 대체 (실제 side effect 실행 방지)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executespy = vi.spyOn(engine as any, 'executeSideEffect').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('delay 없는 효과 — 즉시 실행', () => {
    it('단일 효과 → 지연 없이 즉시 executeSideEffect 호출', () => {
      const eff = unlockEffect('c1');
      engine.scheduleDelayedEffects([eff]);

      expect(executespy).toHaveBeenCalledTimes(1);
      expect(executespy).toHaveBeenCalledWith(eff);
    });

    it('여러 효과 → 모두 즉시 실행', () => {
      const effects: SideEffect[] = [unlockEffect('c1'), unlockEffect('c2'), unlockEffect('c3')];
      engine.scheduleDelayedEffects(effects);

      expect(executespy).toHaveBeenCalledTimes(3);
    });

    it('빈 배열 → executeSideEffect 호출 없음', () => {
      engine.scheduleDelayedEffects([]);
      expect(executespy).not.toHaveBeenCalled();
    });
  });

  describe('delay SideEffect 선행 — 이후 효과는 setTimeout으로 스케줄', () => {
    it('delay(500) → 이후 효과는 500ms 후 실행', () => {
      const eff = unlockEffect('c1');
      engine.scheduleDelayedEffects([delayEffect(500), eff]);

      // 즉시는 호출되지 않음
      expect(executespy).not.toHaveBeenCalled();

      // 499ms 후에도 아직 실행 안 됨
      vi.advanceTimersByTime(499);
      expect(executespy).not.toHaveBeenCalled();

      // 500ms 후 실행
      vi.advanceTimersByTime(1);
      expect(executespy).toHaveBeenCalledOnce();
      expect(executespy).toHaveBeenCalledWith(eff);
    });

    it('delay가 순수 지연만 있고 뒤에 효과가 없으면 아무것도 호출되지 않음', () => {
      engine.scheduleDelayedEffects([delayEffect(1000)]);
      vi.advanceTimersByTime(2000);
      expect(executespy).not.toHaveBeenCalled();
    });
  });

  describe('누적 딜레이 — 여러 delay SideEffect 합산', () => {
    it('delay(200) + eff1 + delay(300) + eff2 → eff1은 200ms, eff2는 500ms 후 실행', () => {
      const eff1 = unlockEffect('c1');
      const eff2 = unlockEffect('c2');

      engine.scheduleDelayedEffects([
        delayEffect(200),
        eff1,
        delayEffect(300),
        eff2,
      ]);

      // t=0: 아무것도 실행 안 됨
      expect(executespy).not.toHaveBeenCalled();

      // t=200: eff1 실행
      vi.advanceTimersByTime(200);
      expect(executespy).toHaveBeenCalledTimes(1);
      expect(executespy).toHaveBeenNthCalledWith(1, eff1);

      // t=500: eff2 실행
      vi.advanceTimersByTime(300);
      expect(executespy).toHaveBeenCalledTimes(2);
      expect(executespy).toHaveBeenNthCalledWith(2, eff2);
    });

    it('delay 없는 효과가 먼저, 그 다음 delay + 효과 — 즉시 실행 후 지연 실행', () => {
      const eff1 = unlockEffect('c1'); // delay 없음 → 즉시
      const eff2 = unlockEffect('c2'); // delay(1000) 후 → 1초 뒤

      engine.scheduleDelayedEffects([eff1, delayEffect(1000), eff2]);

      // eff1은 즉시 실행
      expect(executespy).toHaveBeenCalledTimes(1);
      expect(executespy).toHaveBeenCalledWith(eff1);

      // eff2는 아직 실행 안 됨
      vi.advanceTimersByTime(999);
      expect(executespy).toHaveBeenCalledTimes(1);

      // 1000ms 후 eff2 실행
      vi.advanceTimersByTime(1);
      expect(executespy).toHaveBeenCalledTimes(2);
      expect(executespy).toHaveBeenNthCalledWith(2, eff2);
    });

    it('세 개의 delay가 모두 누적됨 — delay(100)+delay(200)+delay(300)+eff → 600ms 후 실행', () => {
      const eff = unlockEffect('c1');
      engine.scheduleDelayedEffects([
        delayEffect(100),
        delayEffect(200),
        delayEffect(300),
        eff,
      ]);

      vi.advanceTimersByTime(599);
      expect(executespy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(executespy).toHaveBeenCalledOnce();
    });
  });

  describe('delay 직후 효과 순서 보장', () => {
    it('delay + [eff1, eff2] 연속 — 두 효과 모두 지연 후 실행', () => {
      const eff1 = unlockEffect('c1');
      const eff2 = unlockEffect('c2');

      engine.scheduleDelayedEffects([delayEffect(300), eff1, eff2]);

      vi.advanceTimersByTime(300);
      // eff1은 delay 300ms 후
      expect(executespy).toHaveBeenNthCalledWith(1, eff1);
      // eff2는 eff1 이후 즉시 (delay 여전히 300ms 누적 중이므로 함께 300ms에 실행)
      expect(executespy).toHaveBeenNthCalledWith(2, eff2);
      expect(executespy).toHaveBeenCalledTimes(2);
    });
  });
});
