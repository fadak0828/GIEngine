/**
 * feedback.ts — 사용자 피드백 수집 및 분석 시스템
 *
 * AI 생성 게임에 대한 사용자 평점/코멘트를 수집하여
 * 로컬 스토리지에 저장하고 집계 통계를 반환합니다.
 *
 * 사용법:
 * ```ts
 * submitFeedback('game-123', { rating: 5, tags: ['재밌어요', '단서 명확'], comments: '좋아요' });
 * const stats = getAggregatedStats();
 * console.log(stats.averageRating); // 4.2
 * ```
 */

export type FeedbackTag =
  | '재밌어요'
  | '단서가 명확해요'
  | '퍼즐이 창의적이에요'
  | '스토리가 몰입감이 있어요'
  | '캐릭터가 생동감이 있어요'
  | '단서가 부족해요'
  | '퍼즐이 불친절해요'
  | '스토리가 혼란스러워요'
  | '너무 쉬워요'
  | '너무 어려워요'
  | '배경이 아름다워요'
  | '전투감이 부족해요'
  | '전혀 inúmer'
  | '단서가 많았으면 해요'
  | '다른 플레이어와 공유하고 싶어요';

export interface GameFeedback {
  /** 고유 피드백 ID */
  id: string;
  /** 게임/사건 ID (CaseBlueprint.id 또는 생성 세션 ID) */
  gameId: string;
  /** 사용자 평점 1-5 */
  rating: 1 | 2 | 3 | 4 | 5;
  /** 피드백 태그 (복수 선택 가능) */
  tags: FeedbackTag[];
  /** 선택적 코멘트 */
  comments?: string;
  /** 플레이 시간 (대략적, 분 단위) */
  playDurationMinutes?: number;
  /** 완료 여부 */
  completed: boolean;
  /** 피드백 제출 시각 */
  submittedAt: number;
  /** Fun-Metric 점수 (피드백 시점의 AI 점수) */
  aiQualityScore?: number;
}

export interface AggregatedStats {
  totalFeedbacks: number;
  averageRating: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  tagFrequencies: Record<string, number>;
  completionRate: number;
  averagePlayDurationMinutes: number;
  /** 가장 많이 선택된 태그 상위 5개 */
  topTags: Array<{ tag: string; count: number }>;
}

// ── Storage 키 ──────────────────────────────────────────────────────

const STORAGE_KEY = 'gi-engine-game-feedback';

// ── ID 생성 ─────────────────────────────────────────────────────────

function generateFeedbackId(): string {
  return 'fb-xxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── 저장소 접근 ─────────────────────────────────────────────────────

function loadFeedbacks(): GameFeedback[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GameFeedback[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFeedbacks(feedbacks: GameFeedback[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feedbacks));
  } catch (err) {
    console.warn('[GIEngine] Failed to save feedback:', err);
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * 게임에 대한 사용자 피드백을 제출합니다.
 *
 * @param gameId 게임/사건 ID
 * @param feedback 피드백 데이터 (rating 필수, tags/comments 선택)
 * @returns 제출된 피드백 (생성된 ID 포함)
 */
export function submitFeedback(
  gameId: string,
  feedback: Omit<GameFeedback, 'id' | 'gameId' | 'submittedAt'>,
): GameFeedback {
  const entry: GameFeedback = {
    ...feedback,
    id: generateFeedbackId(),
    gameId,
    submittedAt: Date.now(),
  };

  const feedbacks = loadFeedbacks();
  feedbacks.push(entry);
  saveFeedbacks(feedbacks);

  return entry;
}

/**
 * 특정 게임에 대한 모든 피드백을 조회합니다.
 */
export function getFeedbacksForGame(gameId: string): GameFeedback[] {
  return loadFeedbacks().filter(f => f.gameId === gameId);
}

/**
 * 특정 게임의 평균 평점을 조회합니다.
 */
export function getAverageRatingForGame(gameId: string): number | null {
  const feedbacks = getFeedbacksForGame(gameId);
  if (feedbacks.length === 0) return null;

  const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
  return Math.round((sum / feedbacks.length) * 10) / 10; // 소수점 1자리
}

/**
 * 전체 게임에 대한 집계 통계를 반환합니다.
 *
 * @param limitGameIds 특정 게임 ID 목록 (지정 시 해당 게임만 필터링)
 */
export function getAggregatedStats(limitGameIds?: string[]): AggregatedStats {
  let feedbacks = loadFeedbacks();

  if (limitGameIds && limitGameIds.length > 0) {
    const ids = new Set(limitGameIds);
    feedbacks = feedbacks.filter(f => ids.has(f.gameId));
  }

  if (feedbacks.length === 0) {
    return {
      totalFeedbacks: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      tagFrequencies: {},
      completionRate: 0,
      averagePlayDurationMinutes: 0,
      topTags: [],
    };
  }

  // 평균 평점
  const ratingSum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
  const averageRating = Math.round((ratingSum / feedbacks.length) * 10) / 10;

  // 평점 분포
  const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const f of feedbacks) {
    ratingDistribution[f.rating] = (ratingDistribution[f.rating] ?? 0) + 1;
  }

  // 태그 빈도
  const tagFrequencies: Record<string, number> = {};
  for (const f of feedbacks) {
    for (const tag of f.tags) {
      tagFrequencies[tag] = (tagFrequencies[tag] ?? 0) + 1;
    }
  }

  // 상위 태그 5개
  const topTags = Object.entries(tagFrequencies)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 완료율
  const completedCount = feedbacks.filter(f => f.completed).length;
  const completionRate = Math.round((completedCount / feedbacks.length) * 100);

  // 평균 플레이 시간
  const withDuration = feedbacks.filter(f => f.playDurationMinutes != null);
  const avgDuration = withDuration.length > 0
    ? Math.round(withDuration.reduce((acc, f) => acc + (f.playDurationMinutes ?? 0), 0) / withDuration.length)
    : 0;

  return {
    totalFeedbacks: feedbacks.length,
    averageRating,
    ratingDistribution,
    tagFrequencies,
    completionRate,
    averagePlayDurationMinutes: avgDuration,
    topTags,
  };
}

/**
 * 모든 피드백을 삭제합니다 (디버그용).
 */
export function clearAllFeedbacks(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 특정 게임의 피드백을 삭제합니다.
 */
export function deleteFeedback(feedbackId: string): boolean {
  const feedbacks = loadFeedbacks();
  const filtered = feedbacks.filter(f => f.id !== feedbackId);
  if (filtered.length === feedbacks.length) return false;
  saveFeedbacks(filtered);
  return true;
}

/**
 * 게임 피드백 데이터를 JSON으로 내보냅니다 (배치 분석용).
 */
export function exportFeedbacksAsJson(): string {
  return JSON.stringify(loadFeedbacks(), null, 2);
}
