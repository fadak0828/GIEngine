/**
 * regenerate-prompt.ts — 부분 재생성 프롬프트
 *
 * 사용자가 특정 씬/단어/퍼즐/캐릭터만 다시 생성하고 싶을 때 사용
 */

import type { Locale } from '@gi-engine/core';
import type { CaseBlueprint } from '../../interview/types.js';

export interface RegenerateScenePromptOptions {
  originalBlueprint: CaseBlueprint;
  sceneTempId: string;
  locale: Locale;
  /** 재생성 이유 힌트 (예: "单서 부족", "장소 부적절") */
  reasonHint?: string;
}

export interface RegenerateWordPromptOptions {
  originalBlueprint: CaseBlueprint;
  wordTempId: string;
  locale: Locale;
  reasonHint?: string;
}

export interface RegeneratePuzzlePromptOptions {
  originalBlueprint: CaseBlueprint;
  locale: Locale;
  reasonHint?: string;
}

function localeName(locale: Locale): string {
  return locale === 'ko' ? '한국어' : 'English';
}

type KoEn = 'ko' | 'en';

function koen(locale: Locale): KoEn {
  return locale === 'ko' ? 'ko' : 'en';
}

/** Safely access a LocalizedText field by locale */
function localizedText(text: { ko: string; en: string }, locale: KoEn): string {
  return text[locale];
}

/**
 * 씬 재생성 프롬프트 — 다른 씬의 설정은 유지하며 해당 씬만 재생성
 */
export function buildRegenerateScenePrompt(options: RegenerateScenePromptOptions): string {
  const { originalBlueprint, sceneTempId, locale, reasonHint } = options;
  const ln = localeName(locale);
  const ke = koen(locale);

  const otherScenes = originalBlueprint.scenes.filter(s => s.tempId !== sceneTempId);
  const targetScene = originalBlueprint.scenes.find(s => s.tempId === sceneTempId);

  const reasonText = reasonHint ? `\n재생성 요청 이유: ${reasonHint}` : '';

  return `당신은 추리 게임 사건 설계 전문가입니다.
기존 사건 구조에서 특정 씬(scene)만 재생성하세요.${reasonText}

## 현재 사건 구조 (참고용 — 다른 씬은 절대 변경하지 마세요)

제목: ${JSON.stringify(originalBlueprint.title)}
${ke === 'ko' ? '설명' : 'Description'}: ${JSON.stringify(originalBlueprint.description)}
장르: ${originalBlueprint.genre}

## 재생성할 씬 정보

tempId: ${sceneTempId}
${targetScene ? `현재 설명: ${targetScene.description}` : ''}
${targetScene ? `현재 핫스팟 수: ${targetScene.hotspotHints.length}` : ''}

## 절대 변경하지 않을 씬들

${otherScenes.map(s => `- ${s.tempId}: ${localizedText(s.name, ke)} — ${s.description}`).join('\n')}

## 캐릭터 (변경 금지)

${originalBlueprint.characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n')}

## 핵심 단서 목록 (변경 금지)

${originalBlueprint.words.map(w => `- ${w.tempId}: ${localizedText(w.display, ke)} (${w.category}) — 힌트: ${w.hint ? localizedText(w.hint, ke) : '없음'}`).join('\n')}

## 재생성 규칙

1. **씬 설명**: 시간대+조명+색감+주요오브젝트+분위기 키워드를 반드시 포함
2. **핫스팟 5~8개**: examine/word_reveal/examine_image/navigate 조합
3. **기존 단서 참조**: 새로 생성하는 씬 hotspotHints에서 이미 존재하는 단어 tempId를 재참조
4. **기존 씬과 연결**: connections에 유효한 scene tempId만 포함
5. **${ke === 'ko' ? '한국어/영어' : 'Korean/English'}**: 모든 LocalizedText의 ko/en 필드 모두 채우기
6. **절대**: 다른 씬, 캐릭터, 단어를 수정하지 마세요

마크다운 코드 펜스 없이 순수 JSON만 응답:
{
  "tempId": "${sceneTempId}",
  "name": { "ko": "새 씬 이름", "en": "New Scene Name" },
  "description": "새 배경 이미지용 상세 설명",
  "connections": ["참조할 기존 씬 tempId들"],
  "hotspotHints": [
    {
      "label": "핫스팟 이름",
      "actionType": "examine|examine_image|word_reveal|navigate",
      "contentHint": "조사 시 보여줄 내용",
      "positionHint": { "x": 0.2, "y": 0.3, "description": "위치 설명" },
      "relatedWordId": "기존 단어 tempId (word_reveal만)"
    }
  ]
}`;
}

/**
 * 단어(단서) 재생성 프롬프트 — 다른 설정은 유지하며 해당 단서만 재생성
 */
export function buildRegenerateWordPrompt(options: RegenerateWordPromptOptions): string {
  const { originalBlueprint, wordTempId, locale, reasonHint } = options;
  const ln = localeName(locale);
  const ke = koen(locale);

  const otherWords = originalBlueprint.words.filter(w => w.tempId !== wordTempId);
  const targetWord = originalBlueprint.words.find(w => w.tempId === wordTempId);

  const reasonText = reasonHint ? `\n재생성 요청 이유: ${reasonHint}` : '';

  return `당신은 추리 게임 사건 설계 전문가입니다.
기존 사건 구조에서 특정 단서(word)만 재생성하세요.${reasonText}

## 현재 사건 구조 (참고용 — 다른 단서는 변경 금지)

제목: ${JSON.stringify(originalBlueprint.title)}
장르: ${originalBlueprint.genre}

## 재생성할 단서 정보

tempId: ${wordTempId}
${targetWord ? `현재 표시: ${JSON.stringify(targetWord.display)}` : ''}
${targetWord ? `현재 카테고리: ${targetWord.category}` : ''}
${targetWord ? `현재 힌트: ${JSON.stringify(targetWord.hint)}` : ''}
${targetWord ? `현재 출처 씬: ${targetWord.sourceSceneTempId}` : ''}

## 절대 변경하지 않을 단서들

${otherWords.map(w => `- ${w.tempId}: ${localizedText(w.display, ke)} (${w.category})`).join('\n')}

## 캐릭터 (변경 금지 — 관계 이해용)

${originalBlueprint.characters.map(c => `- ${c.name} (${c.role})`).join('\n')}

## 재생성 규칙

1. **카테고리 유지**: 가능하다면 기존 카테고리를 유지 (person/place/object/action/time/motive/evidence)
2. **스토리 충실**: 사건 플롯에 맞는 새로운 단서 생성
3. **힌트 품질**: 플레이어가 생각하게 만드는 서술적 힌트 (명확하지 않지만 방향을 줌)
4. **${ke === 'ko' ? '한국어/영어' : 'Korean/English'}**: 모든 LocalizedText의 ko/en 필드 모두 채우기
5. **범위**: tempId, display, category, hint, sourceSceneTempId만 수정
6. **mainPuzzle 참조**: requiredWordTempIds에서 해당 tempId가 사용되고 있다면 새 단서도 맞게 교체

마크다운 코드 펜스 없이 순수 JSON만 응답:
{
  "tempId": "${wordTempId}",
  "display": { "ko": "새 단어 표시", "en": "New Word Display" },
  "category": "person|place|object|action|time|motive|evidence",
  "hint": { "ko": "새 힌트", "en": "New Hint" },
  "sourceSceneTempId": "해당 단서를 얻을 수 있는 기존 씬 tempId"
}`;
}

/**
 * 메인 퍼즐 재생성 프롬프트
 */
export function buildRegeneratePuzzlePrompt(options: RegeneratePuzzlePromptOptions): string {
  const { originalBlueprint, locale, reasonHint } = options;
  const ln = localeName(locale);
  const ke = koen(locale);

  const reasonText = reasonHint ? `\n재생성 요청 이유: ${reasonHint}` : '';

  return `당신은 추리 게임 퍼즐 설계 전문가입니다.
기존 사건 구조의 메인 퍼즐(mainPuzzle)만 재생성하세요.${reasonText}

## 사건 정보

제목: ${JSON.stringify(originalBlueprint.title)}
${ke === 'ko' ? '설명' : 'Description'}: ${JSON.stringify(originalBlueprint.description)}

## 사용 가능한 단서들

${originalBlueprint.words.map(w => `- ${w.tempId}: ${localizedText(w.display, ke)} (${w.category})`).join('\n')}

## 현재 메인 퍼즐

${JSON.stringify(originalBlueprint.mainPuzzle, null, 2)}

## 재생성 규칙

1. **${ke === 'ko' ? '6~10개' : '6~10'} 단서 조합**: requiredWordTempIds에 6~10개의 기존 tempId 포함
2. **레드 헤링 포함**: 정답 조합 외에 잘못된 조합도 제공하여 플레이어 혼란 유발
3. **${ke === 'ko' ? '빈칸 문장 형식' : 'Fill-in-blank format'}**: "[빈칸1]이(가) [빈칸2]에서..." 형식
4. **퍼즐 다양성**: 이전 버전과 다른 구조/문장 사용
5. **${ke === 'ko' ? '한국어/영어' : 'Korean/English'}**: titleHint, descriptionHint, templateDescription의 ko/en 모두 채우기

마크다운 코드 펜스 없이 순수 JSON만 응답:
{
  "titleHint": { "ko": "제목 힌트", "en": "Title Hint" },
  "descriptionHint": { "ko": "설명 힌트", "en": "Description Hint" },
  "templateDescription": { "ko": "[빈칸1]이(가)...", "en": "[Blank1]..." },
  "requiredWordTempIds": ["word_1", "word_2", "word_3"]
}`;
}
