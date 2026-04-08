/**
 * benchmarks.ts — 5개 参考 미스터리 게임 코퍼스
 *
 * AI 품질 평가의 기준선(ground truth)을 제공하는 수동 제작 게임.
 * 각 게임은 Fun-Metric 5개 차원에서의 기대 점수를 함께 제공.
 *
 * 사용법:
 * ```ts
 * import { BENCHMARK_CORPUS, getBenchmarkById } from './benchmarks';
 * const result = await funMetricScorer.scoreBlueprint(benchmark.blueprint);
 * compareWithGroundTruth(result.metrics, benchmark.expectedScores);
 * ```
 */

import type { FunMetricScore } from './fun-metric.js';

// ── Benchmark 인터페이스 ───────────────────────────────────────────────

export interface BenchmarkWord {
  tempId: string;
  display: { ko: string; en: string };
  category: 'person' | 'place' | 'object' | 'action' | 'time' | 'motive' | 'evidence';
  hint: { ko: string; en: string };
  sourceSceneTempId: string;
}

export interface BenchmarkScene {
  tempId: string;
  name: { ko: string; en: string };
  description: string;
  connections: string[];
  hotspotHints: Array<{
    label: string;
    actionType: string;
    contentHint: string;
    relatedWordId?: string;
  }>;
}

export interface BenchmarkCharacter {
  name: string;
  role: 'culprit' | 'victim' | 'witness' | 'suspect';
  description: string;
  alibi?: string;
  relationships: Array<{ targetName: string; relationship: string }>;
}

export interface BenchmarkPuzzle {
  titleHint: string;
  descriptionHint: string;
  templateDescription: string;
  requiredWordTempIds: string[];
}

export interface BenchmarkSubPuzzle {
  type: string;
  description: string;
  characterNames?: string[];
  events?: string[];
}

export interface BenchmarkBlueprint {
  id: string;
  sessionId: string;
  generatedAt: number;
  title: { ko: string; en: string };
  description: { ko: string; en: string };
  genre: string;
  characters: BenchmarkCharacter[];
  scenes: BenchmarkScene[];
  words: BenchmarkWord[];
  mainPuzzle: BenchmarkPuzzle;
  subPuzzles: BenchmarkSubPuzzle[];
}

export interface BenchmarkCase {
  /** 고유 ID */
  id: string;
  /** 게임 제목 */
  title: { ko: string; en: string };
  /** 난이도 */
  difficulty: 'easy' | 'medium' | 'hard';
  /** 장르 */
  genre: 'noir' | 'classic' | 'historical' | 'thriller' | 'fantasy';
  /** 한 줄 설명 */
  tagline: { ko: string; en: string };
  /** 완전한 게임 구조 */
  blueprint: BenchmarkBlueprint;
  /** Fun-Metric 기대 점수 (기준선) */
  expectedScores: FunMetricScore;
  /** 품질 평가 노트 */
  qualityNotes: { ko: string; en: string };
}

// ── Benchmark 1: Classic Manor Murder (중간 난이도) ──────────────────

const BENCHMARK_01: BenchmarkCase = {
  id: 'benchmark-01',
  title: { ko: '달빛 대저택 살인사건', en: 'Moonlit Manor Murder' },
  difficulty: 'medium',
  genre: 'classic',
  tagline: {
    ko: '폭풍우 치는 밤, 달빛 대저택에서 재력가가 죽었다. 범인은 네 명 중 하나.',
    en: 'On a stormy night, a wealthy industrialist is murdered at Moonlit Manor. One of four suspects is the killer.',
  },
  blueprint: {
    id: 'bm-01',
    sessionId: 'bm-01-session',
    generatedAt: 1700000000000,
    title: { ko: '달빛 대저택 살인사건', en: 'Moonlit Manor Murder' },
    description: {
      ko: '폭풍우가 몰려오던 저녁, 재력가 남궁율은 대저택 서재에서 독극물에 당해 죽었다.当晚 파티에 초대된 네 명의 손님 중 한 명이 범인.',
      en: 'As a storm raged outside, wealthy industrialist Nohngu Yusul was poisoned in the manors study. One of four party guests is the killer.',
    },
    genre: 'classic',
    characters: [
      {
        name: '남궁율',
        role: 'victim',
        description: '60대 재력가, 은화 광산 회장을 은임',
        alibi: undefined,
        relationships: [],
      },
      {
        name: '하윤서',
        role: 'culprit',
        description: '남궁율의 재혼 아내, 30대 미녀, 보험금 목적으로毒殺',
        alibi: '당신은 서재에서 남궁율과 함께 있었다고 주장',
        relationships: [
          { targetName: '남궁율', relationship: '남편 (피해자)' },
          { targetName: '장철민', relationship: '旧교사 (알리바이 조작 협력)' },
        ],
      },
      {
        name: '장철민',
        role: 'suspect',
        description: '남궁율의 비서, 50대, 직장에서 횡령한 돈을 빌려준 인물',
        alibi: '응접실에서 다른 손님들과 함께 있었다고 주장',
        relationships: [
          { targetName: '남궁율', relationship: '고용인' },
          { targetName: '하윤서', relationship: '共謀 관계' },
        ],
      },
      {
        name: '서민지',
        role: 'witness',
        description: '남궁율의 딸, 20대, 아버지의 유언에 불만',
        alibi: '2층 침실에서 독감으로 눅아있었다고 주장',
        relationships: [
          { targetName: '남궁율', relationship: '딸 (피해자)' },
          { targetName: '하윤서', relationship: '계모/이복자매' },
        ],
      },
      {
        name: '박영수',
        role: 'suspect',
        description: '은화 광산 노동자 조합장, 노조 분쟁으로 적대 관계',
        alibi: '옥상에서 바람 식힐 곳으로 갔다고 주장',
        relationships: [
          { targetName: '남궁율', relationship: '노동 쟁의 상대' },
        ],
      },
    ],
    scenes: [
      {
        tempId: 'scene_1',
        name: { ko: '서재', en: 'Study' },
        description: '심야의 고풍스러운 서재, 꺼진 초롱촛불, 먼지 덮인 책장들 사이로 피 묻은 편지 한 장, 어두운 갈색 톤의 압도적 고요함',
        connections: ['scene_2'],
        hotspotHints: [
          { label: '피 묻은 편지', actionType: 'examine', contentHint: '피 묻은 편지에는 "横領"이라는 글씨' },
          { label: '빈 주전자', actionType: 'examine_image', contentHint: '초록색 잔 더미, 하나만 남아있음' },
          { label: '독극물 병', actionType: 'word_reveal', contentHint: '시안화칼륨 소독약', relatedWordId: 'word_4' },
          { label: '유리장 창문', actionType: 'navigate', contentHint: '정원으로 나가는 비상구' },
        ],
      },
      {
        tempId: 'scene_2',
        name: { ko: '응접실', en: 'Drawing Room' },
        description: '폭풍우의 번개가 비치는 응접실, 네오클래식 장식, 흩어진 카드게임 세트, 은은한 촛불, 긴장감 넘치는 미묘한 긴장',
        connections: ['scene_1', 'scene_3'],
        hotspotHints: [
          { label: '카드게임 세트', actionType: 'examine', contentHint: '최근 사용된痕跡 — 누군가 긴장하며 플레이' },
          { label: '빈 포도주잔', actionType: 'examine_image', contentHint: '피 묻은 잔이 하나, 나머지는 깨끗' },
          { label: '시계', actionType: 'word_reveal', contentHint: '가면의시계', relatedWordId: 'word_5' },
          { label: '복도 문', actionType: 'navigate', contentHint: '서재로 가는 복도' },
        ],
      },
      {
        tempId: 'scene_3',
        name: { ko: '정원', en: 'Garden' },
        description: '폭풍우 이후의 정원, 젖은 흙 냄새, 부서진 화분, 무성한 덩굴 사이로 묻힌 낡은 열쇠, 불길한 달빛이 비치는 차가운 청회색 톤',
        connections: ['scene_1'],
        hotspotHints: [
          { label: '부서진 화분', actionType: 'examine', contentHint: '토양에서 시안화물과 닮은白色粉末 발견' },
          { label: '낡은 열쇠', actionType: 'word_reveal', contentHint: '서재秘密 금고 열쇠', relatedWordId: 'word_6' },
          { label: '발자국', actionType: 'examine', contentHint: '창문 아래 작은 여성 신발 발자국' },
        ],
      },
    ],
    words: [
      { tempId: 'word_1', display: { ko: '하윤서', en: 'Ha Yunseo' }, category: 'person', hint: { ko: '피해자의 재혼 아내, 금발 미인', en: 'The victims remarried wife, a beautiful blonde' }, sourceSceneTempId: 'scene_2' },
      { tempId: 'word_2', display: { ko: '서재', en: 'Study' }, category: 'place', hint: { ko: '피해자가 죽은 곳, 독이 든 음료가 있던 곳', en: 'Where the victim died, where the poisoned drink was' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_3', display: { ko: '横領', en: 'Embezzlement' }, category: 'evidence', hint: { ko: '피 묻은 편지에서 발견된 금액, 비서에 대한 의심', en: 'Amount found on bloodied letter, suspicion on secretary' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_4', display: { ko: '시안화칼륨', en: 'Potassium Cyanide' }, category: 'evidence', hint: { ko: '극도로 치명적인毒藥, 공통되지 않은 물질', en: 'Extremely lethal poison, uncommon substance' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_5', display: { ko: '가면의시계', en: 'Clock of Masks' }, category: 'evidence', hint: { ko: '11시 30분에 멈춘 장식용 시계, 범행 시간 단서', en: 'Ornamental clock stopped at 11:30, crime timing clue' }, sourceSceneTempId: 'scene_2' },
      { tempId: 'word_6', display: { ko: '秘密금고', en: 'Secret Safe' }, category: 'object', hint: { ko: '서재 벽장 속 숨겨진 금고, 범행 증거가 있을 수도', en: 'Hidden safe in the study wall, may contain evidence' }, sourceSceneTempId: 'scene_3' },
      { tempId: 'word_7', display: { ko: '여성 신발', en: 'Womens Shoe' }, category: 'evidence', hint: { ko: '창문 아래 발견, 여성 신발 발자국', en: 'Found below window, womens shoe print' }, sourceSceneTempId: 'scene_3' },
      { tempId: 'word_8', display: { ko: '장철민', en: 'Jang Cheolmin' }, category: 'person', hint: { ko: '피해자의 비서, 횡령혐의로 의심받음', en: 'Victims secretary, suspected of embezzlement' }, sourceSceneTempId: 'scene_2' },
    ],
    mainPuzzle: {
      titleHint: '진범을 밝혀라',
      descriptionHint: '수집한 단서들끼리 조합하여 범인의 이름, 범행 장소, 사용 수단을 모두 특정하세요',
      templateDescription: '[빈칸1]이 [빈칸2]에서 [빈칸3]을(를) 사용해 [빈칸4]을(를) [빈칸5]했다',
      requiredWordTempIds: ['word_1', 'word_2', 'word_4', 'word_7'],
    },
    subPuzzles: [
      { type: 'character_id', description: '네 명의 용의자 중 진범을 선택하세요', characterNames: ['하윤서', '장철민', '서민지', '박영수'] },
      { type: 'timeline', description: '당일 저녁 사건의 타임라인을 배열하세요', events: ['카드게임 시작', '남궁율 서재로 이동', '피해자 독살', '비상구 출구'] },
    ],
  },
  expectedScores: {
    game_length_balance: 92,
    clue_clarity: 90,
    puzzle_variety: 88,
    character_depth: 94,
    narrative_coherence: 93,
  },
  qualityNotes: {
    ko: '고전적 밀실 살인구성의 훌륭한 사례. 캐릭터 간 동기가 명확하고 레드 헤링(장철민의 횡령)이 효과적.',
    en: 'Excellent example of classic locked-room murder. Character motivations are clear and the red herring (embezzlement) is effective.',
  },
};

// ── Benchmark 2: Noir Cafe Killing (어려움) ─────────────────────────

const BENCHMARK_02: BenchmarkCase = {
  id: 'benchmark-02',
  title: { ko: '노을빛 카페 살인사건', en: 'Noir Cafe Killing' },
  difficulty: 'hard',
  genre: 'noir',
  tagline: {
    ko: '비 오는 서울의 낡은 카페. 마피야 들이켜진 총성一辆车的挡风玻漓 뒤에서.',
    en: 'In a rain-soaked Seoul back-alley cafe, a gunshot rings out. A mafia enforcer falls behind a car windshield.',
  },
  blueprint: {
    id: 'bm-02',
    sessionId: 'bm-02-session',
    generatedAt: 1700000000000,
    title: { ko: '노을빛 카페 살인사건', en: 'Noir Cafe Killing' },
    description: {
      ko: '비 내리는 서울 골목, 낡은 카페에서 마피아 보스가 권투에 암살됨.目撃者为零.',
      en: 'In a rain-soaked Seoul back-alley, a mafia boss is assassinated at a dive cafe. No witnesses.',
    },
    genre: 'noir',
    characters: [
      {
        name: '최용호',
        role: 'victim',
        description: '50대 마피아 보스, 서울 지하 경제 지배자',
        relationships: [],
      },
      {
        name: '한서윤',
        role: 'culprit',
        description: '30대 여자 총격수, 전직 특수부대,复仇 목적으로 최용호를 암살',
        alibi: '범행 시간에 다른 구역 CCTV에 포착된 적 있는人物',
        relationships: [
          { targetName: '최용호', relationship: '复仇 대상' },
          { targetName: '정우진', relationship: '雇佣者' },
        ],
      },
      {
        name: '정우진',
        role: 'suspect',
        description: '40대 건축업자, 최용호와的事业 분쟁',
        alibi: '事发当晚 자신의 사무실에서 혼자 있었다고 주장',
        relationships: [
          { targetName: '최용호', relationship: '사업적 적대' },
        ],
      },
      {
        name: '김다은',
        role: 'witness',
        description: '20대 웨이트리스, 사고现场의 카페에서 일함',
        alibi: '화장실에 있다가 총성을 들었다고 진술',
        relationships: [
          { targetName: '정우진', relationship: '旧知 관계' },
        ],
      },
    ],
    scenes: [
      {
        tempId: 'scene_1',
        name: { ko: '카페 내부', en: 'Cafe Interior' },
        description: '비 내리는 밤의 낡은 카페, 꺼진 불빛, 피 묻은 카운터, 깨진 커피잔 파편들, 차가운 청회색 암막',
        connections: ['scene_2'],
        hotspotHints: [
          { label: '피 묻은 카운터', actionType: 'examine', contentHint: '최용호가 쓰러진 장소,弹孔 분석 가능' },
          { label: '깨진 커피잔', actionType: 'examine_image', contentHint: '피해자의 잔만 남아있음,其他客户의 잔은?' },
          { label: '방향제', actionType: 'word_reveal', contentHint: '프리지아 향 방향제,女性が使用可能性', relatedWordId: 'word_3' },
          { label: '뒷문', actionType: 'navigate', contentHint: '골목으로 나가는 비상구' },
        ],
      },
      {
        tempId: 'scene_2',
        name: { ko: '골목', en: 'Back Alley' },
        description: '비 내리는 좁은 골목, 젖은 콘크리트, 긴급 출동하는 경찰차량 불빛, 옆건물 옥상에서 내려오는 사다리',
        connections: ['scene_1'],
        hotspotHints: [
          { label: '혈흔', actionType: 'examine', contentHint: '옥상 사다리 아래 혈흔, 발본색이 여성 것' },
          { label: '빈 총알 갑', actionType: 'word_reveal', contentHint: '7.62mm 뇌관, 특수부대 사용 무기', relatedWordId: 'word_5' },
          { label: '옥상 사다리', actionType: 'navigate', contentHint: '옆 건물 옥상으로 연결되는 사다리' },
        ],
      },
      {
        tempId: 'scene_3',
        name: { ko: '옥상', en: 'Rooftop' },
        description: '비 내리는 옥상, 저혈압 식어가는 빗물 웅덩이, 철제 난간, 총격을可用한 위치 분석, 습기 있는 청회색 톤',
        connections: ['scene_2'],
        hotspotHints: [
          { label: '발자국', actionType: 'examine', contentHint: '옥상 페인트 위 젖은 발자국一组, 쌍봉ournalism' },
          { label: '담배 꽁초', actionType: 'word_reveal', contentHint: '특제 민트 맛 꽁초, 고급 브랜드', relatedWordId: 'word_7' },
          { label: '망원총 기대움', actionType: 'examine', contentHint: '난간에 기대어진痕跡,长距离射撃 가능 위치' },
        ],
      },
    ],
    words: [
      { tempId: 'word_1', display: { ko: '한서윤', en: 'Han Seoyun' }, category: 'person', hint: { ko: '전직 특수부대 출신 여자 총격수', en: 'Former special forces female sniper' }, sourceSceneTempId: 'scene_3' },
      { tempId: 'word_2', display: { ko: '카페', en: 'Cafe' }, category: 'place', hint: { ko: '암살事发地点, 단서가 많은现场', en: 'Assassination site, rich with clues' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_3', display: { ko: '프리지아 향', en: 'Freesia Scent' }, category: 'evidence', hint: { ko: '여성용 방향제 향, 진범의 단서', en: 'Womens perfume scent, clue to killer' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_4', display: { ko: '옥상', en: 'Rooftop' }, category: 'place', hint: { ko: '射撃 위치로 사용된 옥상, 망원경痕跡', en: 'Sniper position, telescopic sight marks' }, sourceSceneTempId: 'scene_3' },
      { tempId: 'word_5', display: { ko: '7.62mm 뇌관', en: '7.62mm Shell Casing' }, category: 'evidence', hint: { ko: '특수부대 표준 구경子弹, 근접조달 단서', en: 'Special forces standard caliber, procurement clue' }, sourceSceneTempId: 'scene_2' },
      { tempId: 'word_6', display: { ko: '혈액형', en: 'Blood Type' }, category: 'evidence', hint: { ko: '옥상에서 발견된 혈액형 A형, 수paralleled DNA 추적 가능', en: 'Blood type A found on rooftop, enables DNA tracing' }, sourceSceneTempId: 'scene_2' },
      { tempId: 'word_7', display: { ko: '민트 꽁초', en: 'Mint Cigarette Butt' }, category: 'evidence', hint: { ko: '옥상에서 발견, 진범이 남긴 개인적痕跡', en: 'Found on rooftop, personal trace left by killer' }, sourceSceneTempId: 'scene_3' },
    ],
    mainPuzzle: {
      titleHint: '진범을 특정하라',
      descriptionHint: '혈흔, 향수, 꽁초, 탄피 등 물리적 증거를 조합하여 진범을 특정하세요',
      templateDescription: '진범은 [빈칸1]이고, [빈칸2]에서 [빈칸3]을(를) 사용해 [빈칸4]을(를) 저지른다',
      requiredWordTempIds: ['word_1', 'word_4', 'word_5', 'word_7'],
    },
    subPuzzles: [
      { type: 'timeline', description: '암살事件的 타임라인을 재구성하세요', events: ['사다리 오르기', '노리개 위치 선점', '발포', '도주'] },
      { type: 'relationship', description: '용의자들 사이의 관계를 파악하세요' },
    ],
  },
  expectedScores: {
    game_length_balance: 88,
    clue_clarity: 86,
    puzzle_variety: 92,
    character_depth: 82,
    narrative_coherence: 88,
  },
  qualityNotes: {
    ko: '누아르 장르의代表적 사례. 물리적 증거의 체인이 논리적. 레드 헤링(정우진의 사업 분쟁)이 강력.',
    en: 'Representative noir genre case. Physical evidence chain is logical. Strong red herring (business dispute).',
  },
};

// ── Benchmark 3: Easy Country House (쉬움) ──────────────────────────

const BENCHMARK_03: BenchmarkCase = {
  id: 'benchmark-03',
  title: { ko: '시골 마을 작은 살인사건', en: 'Little Village Murder' },
  difficulty: 'easy',
  genre: 'classic',
  tagline: {
    ko: '한가한 시골 마을,大家一起 먹은 빵之後 마을 이장이 죽었다.毒은 어디서?',
    en: 'A peaceful country village, a shared meal of bread, and the village head is dead. Where did the poison come from?',
  },
  blueprint: {
    id: 'bm-03',
    sessionId: 'bm-03-session',
    generatedAt: 1700000000000,
    title: { ko: '시골 마을 작은 살인사건', en: 'Little Village Murder' },
    description: {
      ko: '한가로운 시골 마을에서 마을 이장이 갑자기 쓰러졌다. 全員 다 같이 빵을 먹었다.',
      en: 'In a peaceful country village, the village head suddenly collapses after everyone shares bread together.',
    },
    genre: 'classic',
    characters: [
      { name: '이병호', role: 'victim', description: '60대 마을 이장', relationships: [] },
      {
        name: '김영자',
        role: 'culprit',
        description: '50대 마을 이장의 아내, 마을 재정을 횡령한 것을 알았기에 살해',
        alibi: '빵을 함께 만들었다고 주장',
        relationships: [
          { targetName: '이병호', relationship: '남편' },
          { targetName: '박순칠', relationship: '共謀' },
        ],
      },
      { name: '박순칠', role: 'suspect', description: '40대 마을서기,횡령에 共犯', alibi: '빵 반죽을 만들었다고 주장', relationships: [{ targetName: '김영자', relationship: '共犯' }] },
      { name: '최말자', role: 'witness', description: '60대 빵집 주인, 빵을 직접 배달', alibi: '빵 배달 후 마을회관에 머물렀다', relationships: [] },
    ],
    scenes: [
      {
        tempId: 'scene_1',
        name: { ko: '마을회관', en: 'Village Hall' },
        description: '한낮의 시골 마을회관, 나무 테이블 위 먹다 남은 빵, 열린 창문으로 들어오는 햇살, 따뜻한 앰버색 톤의 평화로운 아침',
        connections: ['scene_2'],
        hotspotHints: [
          { label: '빵 바구니', actionType: 'examine', contentHint: '빵이 먹다 남은 상태로 놓여있음' },
          { label: '물잔', actionType: 'examine_image', contentHint: '이장의 물잔,底部에 흰색 잔류물' },
          { label: '마을회관 열쇠', actionType: 'word_reveal', contentHint: '마을 이장만 가진 열쇠', relatedWordId: 'word_3' },
        ],
      },
      {
        tempId: 'scene_2',
        name: { ko: '김영자의 집', en: 'Youngs House' },
        description: '따뜻한 오후의 시골 가정, 정갈하게 정돈된 부엌, 밀가루 냄새, 평온한 듯하지만 의심받는 공간',
        connections: ['scene_1'],
        hotspotHints: [
          { label: '밀가루 항아리', actionType: 'examine', contentHint: '밀가루 속에 섞인 흰색 powder —毒?' },
          { label: '마을 장부', actionType: 'word_reveal', contentHint: '횡령 기록이 적힌 마을 장부', relatedWordId: 'word_5' },
          { label: '빈 약병', actionType: 'examine', contentHint: '쓰레기통에서 발견된 빈 약병, 라벨不清' },
        ],
      },
    ],
    words: [
      { tempId: 'word_1', display: { ko: '김영자', en: 'Kim Youngja' }, category: 'person', hint: { ko: '마을 이장의 아내, 수묻음해 보이지만...', en: 'The village heads wife, seems timid but...' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_2', display: { ko: '마을회관', en: 'Village Hall' }, category: 'place', hint: { ko: '事发地点, 全員의 알리바이가 여기서 시작', en: 'Incident location, where all alibis start' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_3', display: { ko: '마을회관 열쇠', en: 'Village Hall Key' }, category: 'evidence', hint: { ko: '이장만 가진 열쇠, 누가 열쇠를 가지고 있었는가?', en: 'Only the head had this key, who had it?' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_4', display: { ko: '밀가루毒', en: 'Flour Poison' }, category: 'evidence', hint: { ko: '밀가루에 섞인 아르스닉, 치명적剂量', en: 'Arsenic mixed in flour, lethal dose' }, sourceSceneTempId: 'scene_2' },
      { tempId: 'word_5', display: { ko: '마을 장부', en: 'Village Ledger' }, category: 'evidence', hint: { ko: '횡령 사실을記錄한 마을 장부', en: 'Village ledger recording embezzlement' }, sourceSceneTempId: 'scene_2' },
    ],
    mainPuzzle: {
      titleHint: '진범과犯行 수단을特定하라',
      descriptionHint: '밀가루, 마을 열쇠, 마을 장부 조합하여 진범을 밝혀내세요',
      templateDescription: '[빈칸1]이 [빈칸2]의 [빈칸3]을(를) 사용해 범행을 저질렀다',
      requiredWordTempIds: ['word_1', 'word_4', 'word_5'],
    },
    subPuzzles: [
      { type: 'character_id', description: '진범을 선택하세요', characterNames: ['김영자', '박순칠', '최말자'] },
    ],
  },
  expectedScores: {
    game_length_balance: 85,
    clue_clarity: 88,
    puzzle_variety: 78,
    character_depth: 75,
    narrative_coherence: 86,
  },
  qualityNotes: {
    ko: '쉬운 난이도의 입문용 사건. 단서가 명확하고 결론이 논리적. 퍼즐 다양성은 낮지만 교육적.',
    en: 'Introductory easy case. Clues are clear and conclusion is logical. Low puzzle variety but educational.',
  },
};

// ── Benchmark 4: Historical Palace Conspiracy (중간-어려움) ─────────

const BENCHMARK_04: BenchmarkCase = {
  id: 'benchmark-04',
  title: { ko: '궁궐 역모의 건', en: 'Palace Intrigue' },
  difficulty: 'medium',
  genre: 'historical',
  tagline: {
    ko: '조선시대 궁궐, 대비의 독사가 발각됐다.宫内有内鬼.',
    en: 'Joseon dynasty palace, the queen dowagers poison scheme is uncovered. There is a spy in the palace.',
  },
  blueprint: {
    id: 'bm-04',
    sessionId: 'bm-04-session',
    generatedAt: 1700000000000,
    title: { ko: '궁궐 역모의 건', en: 'Palace Intrigue' },
    description: {
      ko: '조선 영조 시대, 대비가 세자의 탕약을 조제한 것이 드러났다.宫内有内鬼, 그正体는?',
      en: 'Joseon era, the queen dowagers scheme to poison the Crown Prince is exposed. A palace spy exists, who is it?',
    },
    genre: 'historical',
    characters: [
      { name: '세자', role: 'victim', description: '20대 왕세자', relationships: [] },
      {
        name: '최영애',
        role: 'culprit',
        description: '40대 대비, 세자를廃嫡하기 위해 독을仕組む',
        alibi: '당시 내전에서 서elting했다고 주장',
        relationships: [
          { targetName: '세자', relationship: '시비' },
          { targetName: '이형', relationship: '共谋' },
        ],
      },
      { name: '이형', role: 'suspect', description: '50대 영의정, 대비와 内通', alibi: '政院에서 朝会', relationships: [{ targetName: '최영애', relationship: '内通' }] },
      { name: '宫女月', role: 'witness', description: '20대宫女, 세자의奶娘', alibi: '내전에 없었다', relationships: [{ targetName: '세자', relationship: '奶娘' }] },
    ],
    scenes: [
      {
        tempId: 'scene_1',
        name: { ko: '내전', en: 'Inner Palace' },
        description: '고요한宫殿 내전, 황토 바닥, 비녀 소리만이 들리는 정적, 처마 끝 풍경 소리, 궁궐 특유의 적갈색과 황토색 대비',
        connections: ['scene_2'],
        hotspotHints: [
          { label: '세자의 탕약잔', actionType: 'examine', contentHint: '탕약이 남은 잔, 쓴맛이 남', relatedWordId: 'word_3' },
          { label: '행ulah', actionType: 'word_reveal', contentHint: '궁녀가 몰래持ち出した 약초', relatedWordId: 'word_4' },
          { label: '기록', actionType: 'examine_image', contentHint: '약초仕配 기록, 궁녀의筆跡' },
        ],
      },
      {
        tempId: 'scene_2',
        name: { ko: '御药房', en: 'Royal Pharmacy' },
        description: '저묵의宮廷 약초 저장소, 特産 약초 냄새, 정갈하게 정리된 약병들, 옻나무 냄새 섞인 건조된 허브들',
        connections: ['scene_1'],
        hotspotHints: [
          { label: '비밀 약병', actionType: 'examine', contentHint: '일반 약병과 섞인 특수 약병, 확인 필요' },
          { label: '궁녀의 footprint', actionType: 'word_reveal', contentHint: '약초庫에서 발견된宫女月의 발자국', relatedWordId: 'word_5' },
        ],
      },
    ],
    words: [
      { tempId: 'word_1', display: { ko: '최영애', en: 'Choi Yeonga' }, category: 'person', hint: { ko: '시비를 노리는 대비, 세자에게 독을仕組む', en: 'The ambitious queen dowager' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_2', display: { ko: '내전', en: 'Inner Palace' }, category: 'place', hint: { ko: '事发地点, 세자의 거소', en: 'Where it happened, the Crown Princes chambers' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_3', display: { ko: '독이든 탕약', en: 'Poisoned Herbal Medicine' }, category: 'evidence', hint: { ko: '세자에게 전달된 탕약, 치명적劑量', en: 'The medicine delivered to the Crown Prince' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_4', display: { ko: '이르힌갑', en: 'Aconitum' }, category: 'evidence', hint: { ko: '이르힌갑에서 추출한 독,宫殿 전용毒草', en: 'Poison extracted from aconitum, palace-specific herb' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_5', display: { ko: '궁녀월', en: 'Court Lady Wol' }, category: 'person', hint: { ko: '세자의奶娘,宫内有内鬼의 정체?', en: 'The Crown Princes wet nurse, the palace spy?' }, sourceSceneTempId: 'scene_2' },
    ],
    mainPuzzle: {
      titleHint: '역모의 실체를 밝혀내라',
      descriptionHint: '독초, 궁녀, 기록을 조합하여 대비의陰謀를 밝혀내세요',
      templateDescription: '역모의 主謀는 [빈칸1]이고, [빈칸2]에서 [빈칸3]을(를)入手해 [빈칸4]을(를) 저질렀다',
      requiredWordTempIds: ['word_1', 'word_2', 'word_4', 'word_5'],
    },
    subPuzzles: [
      { type: 'timeline', description: '역모의 時系列을配列하세요', events: ['약초入手', '탕약 조제', '세자에게 전달', '発覚'] },
    ],
  },
  expectedScores: {
    game_length_balance: 90,
    clue_clarity: 87,
    puzzle_variety: 85,
    character_depth: 91,
    narrative_coherence: 90,
  },
  qualityNotes: {
    ko: '역사 장르의优秀 사례. 시대적 배경이 서사와 자연스럽게融合.宫女월의 역할이 훌륭한 레드 헤링.',
    en: 'Excellent historical genre case. Era naturally blends with narrative. The court ladys role is an effective red herring.',
  },
};

// ── Benchmark 5: Modern Tech Startup Murder (쉬움-중간) ─────────────

const BENCHMARK_05: BenchmarkCase = {
  id: 'benchmark-05',
  title: { ko: '스타트업 살인 프로토콜', en: 'Startup Murder Protocol' },
  difficulty: 'easy',
  genre: 'thriller',
  tagline: {
    ko: '밤샘 작업중인 테크 스타트업 사무실. CTO가 코딩 중 갑자기 쓰러졌다.原因是?',
    en: 'A tech startup office in an all-nighter. The CTO collapses while coding. What killed him?',
  },
  blueprint: {
    id: 'bm-05',
    sessionId: 'bm-05-session',
    generatedAt: 1700000000000,
    title: { ko: '스타트업 살인 프로토콜', en: 'Startup Murder Protocol' },
    description: {
      ko: '밤샘 작업 중인 테크 스타트업, CTO가 코딩 중 갑자기 쓰러졌다. 数時間前 커피를orbit로 마셨다.',
      en: 'An all-nighter at a tech startup. The CTO collapses while coding. He drank coffee from an Orbit cup hours earlier.',
    },
    genre: 'thriller',
    characters: [
      { name: '김태현', role: 'victim', description: '30대 CTO, 스타트업 공동 창업자', relationships: [] },
      {
        name: '박서현',
        role: 'culprit',
        description: '30대 개발자, 태현의株 비율을 横領하려고 살해',
        alibi: '같이 밤샘했다고 주장, 다른 방에서 코딩',
        relationships: [
          { targetName: '김태현', relationship: '공동 창업자' },
        ],
      },
      { name: '최이삭', role: 'suspect', description: '20대 인턴,株 Scholarships 받았지만 태현에게侵害당함', alibi: '야식 도시락 사러 나갔다고 주장', relationships: [] },
      { name: '정미래', role: 'witness', description: '20대 디자이너,같은 팀', alibi: '야근 중이었음', relationships: [{ targetName: '김태현', relationship: '동료' }] },
    ],
    scenes: [
      {
        tempId: 'scene_1',
        name: { ko: '오피스', en: 'Office' },
        description: '새벽 3시 스타트업 오피스, 모니터 불빛만 밝은 어두운 공간,Raises desk lamps, 에너지드링크 캔, 따뜻한 형광등 vs 차가운 모니터蓝光',
        connections: ['scene_2'],
        hotspotHints: [
          { label: '태현의 자리', actionType: 'examine', contentHint: '태현이 쓰러진 자리, 키보드 위에 손이 놓인 채' },
          { label: 'Orbit 컵', actionType: 'examine_image', contentHint: '오빗 커피 컵,底部에 이상한 결핍' },
          { label: '코드 에디터', actionType: 'word_reveal', contentHint: '마지막으로 작성된 코드: death note', relatedWordId: 'word_3' },
          { label: '창문', actionType: 'navigate', contentHint: '옥상으로 나가는 비상구' },
        ],
      },
      {
        tempId: 'scene_2',
        name: { ko: '주방', en: 'Kitchen' },
        description: '작은 스타트업 주방, 씻겨 남은 커피잔들, 깨끗하게 정돈된 선반, 새벽의冷房 공기',
        connections: ['scene_1'],
        hotspotHints: [
          { label: '커피포트', actionType: 'examine', contentHint: '마지막으로 사용된 커피포트, 내부 확인 필요' },
          { label: '행잉 마그넷', actionType: 'word_reveal', contentHint: '냉장고 마그넷에 적힌 메모', relatedWordId: 'word_5' },
        ],
      },
    ],
    words: [
      { tempId: 'word_1', display: { ko: '박서현', en: 'Park Seohyun' }, category: 'person', hint: { ko: '공동 창업 개발자,株 갈등이 있었음', en: 'Co-founder developer, had equity disputes' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_2', display: { ko: '오피스', en: 'Office' }, category: 'place', hint: { ko: '事发地点, 코딩 중 갑자기 쓰러진 자리', en: 'Where it happened, collapsed while coding' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_3', display: { ko: '死亡 노트', en: 'Death Note' }, category: 'evidence', hint: { ko: '태현이 마지막에 적은 텍스트,死亡 경향?', en: 'Last text Taehyun wrote, death tendency?' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_4', display: { ko: '오빗 컵', en: 'Orbit Cup' }, category: 'evidence', hint: { ko: ' 커피가 담긴 컵,底部에 약품잔턱', en: 'Coffee cup, strange residue at bottom' }, sourceSceneTempId: 'scene_1' },
      { tempId: 'word_5', display: { ko: '냉장고 메모', en: 'Fridge Memo' }, category: 'evidence', hint: { ko: '서현이 남긴 메모, "오늘은 미리 귀가" —不在証明?', en: 'Note left by Seohyun, alibi?' }, sourceSceneTempId: 'scene_2' },
    ],
    mainPuzzle: {
      titleHint: 'CTO 사망의 진상을 밝혀내라',
      descriptionHint: '오빗 컵, 코드, 냉장고 메모를 조합하여 사건을 해결하세요',
      templateDescription: '[빈칸1]이 [빈칸2]의 [빈칸3]에 [빈칸4]을(를)放入해 [빈칸5]을(를) 저질렀다',
      requiredWordTempIds: ['word_1', 'word_2', 'word_4', 'word_5'],
    },
    subPuzzles: [
      { type: 'character_id', description: '진범을 선택하세요', characterNames: ['박서현', '최이삭', '정미래'] },
    ],
  },
  expectedScores: {
    game_length_balance: 87,
    clue_clarity: 89,
    puzzle_variety: 80,
    character_depth: 76,
    narrative_coherence: 85,
  },
  qualityNotes: {
    ko: '현대 테마의 입문용 사건. 현대적 배경이 친숙하고 단서가 명확.死亡 노트가 좋은反復 단서.',
    en: 'Introductory modern-themed case. Familiar setting, clear clues. Death note is a good repeated clue device.',
  },
};

// ── Export ───────────────────────────────────────────────────────────

export const BENCHMARK_CORPUS: BenchmarkCase[] = [
  BENCHMARK_01,
  BENCHMARK_02,
  BENCHMARK_03,
  BENCHMARK_04,
  BENCHMARK_05,
];

/**
 * ID로 benchmark 검색
 */
export function getBenchmarkById(id: string): BenchmarkCase | undefined {
  return BENCHMARK_CORPUS.find(b => b.id === id);
}

/**
 * 난이도로 benchmark 필터링
 */
export function getBenchmarksByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): BenchmarkCase[] {
  return BENCHMARK_CORPUS.filter(b => b.difficulty === difficulty);
}

/**
 * 장르로 benchmark 필터링
 */
export function getBenchmarksByGenre(genre: 'noir' | 'classic' | 'historical' | 'thriller' | 'fantasy'): BenchmarkCase[] {
  return BENCHMARK_CORPUS.filter(b => b.genre === genre);
}

/**
 * FunMetric 점수 비교 — AI 생성 결과 vs 기준선
 * @param actual AI가 산출한 점수
 * @param expected 기준선 점수
 * @returns 차이 (actual - expected), 음수면 기준선에 미치지 못한 것
 */
export function compareWithGroundTruth(
  actual: FunMetricScore,
  expected: FunMetricScore,
): Record<keyof FunMetricScore, number> {
  return {
    game_length_balance: actual.game_length_balance - expected.game_length_balance,
    clue_clarity: actual.clue_clarity - expected.clue_clarity,
    puzzle_variety: actual.puzzle_variety - expected.puzzle_variety,
    character_depth: actual.character_depth - expected.character_depth,
    narrative_coherence: actual.narrative_coherence - expected.narrative_coherence,
  };
}
