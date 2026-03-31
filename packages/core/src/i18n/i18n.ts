import type { Locale, LocalizedText } from '../models/types.js';

const ENGINE_TEXTS: Record<string, LocalizedText> = {
  'ui.validate': { ko: '확인', en: 'Check' },
  'ui.back': { ko: '돌아가기', en: 'Back' },
  'ui.case_select': { ko: '사건 선택', en: 'Select Case' },
  'ui.locked': { ko: '잠김', en: 'Locked' },
  'ui.completed': { ko: '완료', en: 'Completed' },
  'ui.word_collected': { ko: '단어 수집!', en: 'Word collected!' },
  'ui.puzzle_solved': { ko: '퍼즐 해결!', en: 'Puzzle solved!' },
  'ui.all_correct': { ko: '모두 정답!', en: 'All correct!' },
  'ui.try_again': { ko: '다시 시도해보세요', en: 'Try again' },
  'ui.exploring': { ko: '탐색', en: 'Explore' },
  'ui.thinking': { ko: '추리', en: 'Think' },
  'ui.word_bank': { ko: '단어 목록', en: 'Word Bank' },
  'ui.mute': { ko: '음소거', en: 'Mute' },
  'ui.unmute': { ko: '음소거 해제', en: 'Unmute' },
  'ui.loading': { ko: '로딩 중...', en: 'Loading...' },
  'ui.case_complete_title': { ko: '사건 해결!', en: 'Case Solved!' },
  'ui.next_case': { ko: '다음 사건', en: 'Next Case' },
  'ui.game_complete': { ko: '게임 완료!', en: 'Game Complete!' },
  'ui.clear_words': { ko: '전체 초기화', en: 'Clear All' },
  'ui.reset_game': { ko: '게임 초기화', en: 'Reset Game' },
  'ui.reset_confirm': { ko: '정말 게임을 초기화하시겠습니까? 모든 진행 상황이 삭제됩니다.', en: 'Are you sure you want to reset? All progress will be lost.' },
  'ui.case_solved_msg': { ko: '사건을 해결했습니다!', en: 'Case solved!' },
  'ui.continue': { ko: '계속하기', en: 'Continue' },
  'ui.word_collected_name': { ko: '「{word}」 획득!', en: 'Got "{word}"!' },
  'ui.words_collected_count': { ko: '{count}개 단어 획득!', en: '{count} words collected!' },
  'ui.puzzle_tab_main': { ko: '추리', en: 'Deduce' },
  'ui.puzzle_tab_character': { ko: '인물', en: 'Characters' },
  'ui.puzzle_tab_timeline': { ko: '타임라인', en: 'Timeline' },
  'ui.puzzle_tab_relationship': { ko: '관계', en: 'Relations' },
  'ui.puzzle_tab_scenario': { ko: '시나리오', en: 'Scenario' },
  'ui.close_overlay': { ko: '닫기', en: 'Close' },
  'ui.close_puzzle_confirm': { ko: '풀이 중인 내용이 있습니다. 정말 닫으시겠습니까?', en: 'You have unsaved progress. Close anyway?' },
};

export class I18nManager {
  private locale: Locale;
  private fallbackLocale: Locale;

  constructor(locale: Locale = 'ko', fallbackLocale: Locale = 'ko') {
    this.locale = locale;
    this.fallbackLocale = fallbackLocale;
  }

  resolveText(text: LocalizedText): string {
    const resolved = text[this.locale];
    if (resolved) return resolved;

    const fallback = text[this.fallbackLocale];
    if (fallback) return fallback;

    // 어떤 로케일이든 첫 번째 값 반환
    const values = Object.values(text);
    if (values.length > 0 && values[0]) return values[0];

    console.warn(`[i18n] Missing text for locale "${this.locale}"`);
    return '';
  }

  resolveKey(key: string): string {
    const text = ENGINE_TEXTS[key];
    if (!text) {
      console.warn(`[i18n] Unknown engine text key: "${key}"`);
      return key;
    }
    return this.resolveText(text);
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
  }

  getLocale(): Locale {
    return this.locale;
  }

  getFallbackLocale(): Locale {
    return this.fallbackLocale;
  }
}
