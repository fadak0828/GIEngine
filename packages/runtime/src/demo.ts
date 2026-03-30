import { GIEngine } from './index.js';
import type { GameDefinition } from '@gi-engine/core';

// Load sample game definition
// Vite handles JSON imports natively
const gameDefRaw = await fetch('/sample-game.json').then(r => r.json()).catch(() => null);

// Fallback: inline minimal game definition if fetch fails
const fallbackDef: GameDefinition = {
  id: 'gi-demo',
  version: '1.0.0',
  title: { ko: 'GIEngine 데모', en: 'GIEngine Demo' },
  description: {
    ko: '골든 아이돌 스타일 추리게임 엔진 데모입니다.',
    en: 'A demo of the Golden Idol-style detective game engine.',
  },
  supportedLocales: ['ko', 'en'],
  settings: {
    validationFeedbackDuration: 2500,
    autoSaveInterval: 0,
    debug: true,
    unlockMode: 'all_unlocked',
    cssPrefix: 'gi',
  },
  acts: [
    {
      id: 'act-1',
      title: { ko: '제1막', en: 'Act 1' },
      cases: [
        {
          id: 'demo-case-1',
          title: { ko: '첫 번째 사건', en: 'The First Case' },
          description: {
            ko: '저택에서 단서를 찾아라. 핫스팟을 클릭하여 단어를 수집하고 퍼즐을 풀어라.',
            en: 'Find clues in the manor. Click hotspots to collect words and solve the puzzle.',
          },
          thumbnail: '',
          prerequisites: [],
          scenes: [
            {
              id: 'scene-main',
              name: { ko: '거실', en: 'Living Room' },
              background: '',
              dimensions: { width: 1280, height: 720 },
              layers: [],
              hotspots: [
                {
                  id: 'hs-letter',
                  area: { type: 'rect', x: 200, y: 180, width: 160, height: 110 },
                  action: {
                    type: 'examine',
                    content: {
                      ko: '낡은 편지가 있다. "박 회장은 배신자다. 오늘 밤 모든 것이 끝난다." — 익명',
                      en: 'An old letter. "Chairman Park is a traitor. Tonight everything ends." — Anonymous',
                    },
                  },
                  cursor: 'pointer',
                  ariaLabel: { ko: '편지', en: 'Letter' },
                },
                {
                  id: 'hs-knife',
                  area: { type: 'rect', x: 600, y: 300, width: 120, height: 80 },
                  action: { type: 'word_reveal', wordIds: ['word-knife'] },
                  cursor: 'pointer',
                  ariaLabel: { ko: '칼', en: 'Knife' },
                },
                {
                  id: 'hs-photo',
                  area: { type: 'rect', x: 900, y: 150, width: 140, height: 100 },
                  action: { type: 'word_reveal', wordIds: ['word-kim'] },
                  cursor: 'pointer',
                  ariaLabel: { ko: '사진', en: 'Photo' },
                },
                {
                  id: 'hs-puzzle',
                  area: { type: 'rect', x: 520, y: 480, width: 200, height: 60 },
                  action: { type: 'examine', content: { ko: '[퍼즐 열기]', en: '[Open Puzzle]' } },
                  cursor: 'pointer',
                  ariaLabel: { ko: '추론 노트', en: 'Deduction Notes' },
                },
              ],
            },
          ],
          puzzles: {
            main: {
              id: 'puzzle-main',
              title: { ko: '사건의 진상', en: 'The Truth of the Case' },
              type: 'fill_in_blank',
              template: {
                segments: [
                  { type: 'slot', slotId: 'slot-killer' },
                  { type: 'text', content: { ko: '이(가) ', en: ' used a ' } },
                  { type: 'slot', slotId: 'slot-weapon' },
                  { type: 'text', content: { ko: '으로 범행을 저질렀다', en: ' to commit the crime' } },
                ],
              },
              answers: {
                'slot-killer': { correctWordId: 'word-kim' },
                'slot-weapon': { correctWordId: 'word-knife', partiallyCorrectWordIds: ['word-rope'] },
              },
            },
            sub: [],
          },
        },
      ],
    },
  ],
  assets: {
    items: {
      'word-knife': {
        id: 'word-knife',
        type: 'image',
        src: '',
        mimeType: 'image/png',
      },
      'word-kim': {
        id: 'word-kim',
        type: 'image',
        src: '',
        mimeType: 'image/png',
      },
      'word-rope': {
        id: 'word-rope',
        type: 'image',
        src: '',
        mimeType: 'image/png',
      },
    },
  },
};

const definition: GameDefinition = gameDefRaw ?? fallbackDef;
// Force debug on in dev
definition.settings.debug = true;

// Mount engine
const container = document.getElementById('game-container') as HTMLElement;
const engine = new GIEngine({ container, definition, loadSave: false });

await engine.start();

// --- Toolbar wiring ---

const stateDisplay = document.getElementById('state-display') as HTMLElement;

// Poll state for display (lightweight — just reads an object property)
setInterval(() => {
  const s = engine.getState();
  stateDisplay.textContent = s.type + ('caseId' in s ? ` · ${s.caseId}` : '');
}, 200);

document.getElementById('btn-reset')?.addEventListener('click', () => {
  engine.reset();
});

let locale: 'ko' | 'en' = (definition.supportedLocales[0] as 'ko' | 'en') ?? 'ko';
document.getElementById('btn-locale')?.addEventListener('click', () => {
  locale = locale === 'ko' ? 'en' : 'ko';
  engine.setLocale(locale);
});

document.getElementById('btn-debug')?.addEventListener('click', () => {
  definition.settings.debug = !definition.settings.debug;
  console.log('[GIEngine] debug:', definition.settings.debug);
});
