// ============================================================
// GIEngine Core Types — 모든 인터페이스와 타입 정의
// ============================================================

// --- Locale & i18n ---

export type Locale = 'ko' | 'en';

export interface LocalizedText {
  ko: string;
  en: string;
}

// --- Game Definition (최상위) ---

export interface GameDefinition {
  id: string;
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  supportedLocales: Locale[];
  settings: GameSettings;
  acts: Act[];
  assets: AssetManifest;
  words?: Record<string, WordDefinition>;
}

export interface GameSettings {
  validationFeedbackDuration: number;
  autoSaveInterval: number;
  debug: boolean;
  unlockMode: 'sequential' | 'all_unlocked';
  cssPrefix: string;
}

// --- Act & Case ---

export interface Act {
  id: string;
  title: LocalizedText;
  cases: Case[];
}

export interface Case {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  scenes: Scene[];
  puzzles: PuzzleSet;
  prerequisites: string[];
  thumbnail: AssetRef;
}

// --- Scene & Layer ---

export interface Scene {
  id: string;
  name: LocalizedText;
  background: AssetRef;
  dimensions: { width: number; height: number };
  hotspots: Hotspot[];
  layers: SceneLayer[];
  onEnter?: ActionSequence;
  audio?: AssetRef;
  bgm?: AssetRef;       // 씬 진입 시 자동 재생할 BGM
  bgmStop?: boolean;    // true면 씬 진입 시 BGM 정지
  /** true면 씬 크기가 뷰포트보다 클 때 드래그 패닝 허용 */
  scrollable?: boolean;
}

export interface SceneLayer {
  id: string;
  image: AssetRef;
  position: Position;
  zIndex: number;
  visible: boolean;
}

// --- Hotspot ---

export interface Hotspot {
  id: string;
  name?: string;  // editor-only label; ignored by runtime
  area: HotspotArea;
  action: HotspotAction;
  cursor: string;
  condition?: VisibilityCondition;
  ariaLabel: LocalizedText;
}

export type HotspotArea =
  | { type: 'rect'; x: number; y: number; width: number; height: number }
  | { type: 'circle'; cx: number; cy: number; radius: number }
  | { type: 'polygon'; points: [number, number][] };

export type VisibilityCondition =
  | { type: 'layer_visible'; layerId: string }
  | { type: 'word_collected'; wordId: string }
  | { type: 'puzzle_solved'; puzzleId: string }
  | { type: 'and'; conditions: VisibilityCondition[] }
  | { type: 'or'; conditions: VisibilityCondition[] }
  | { type: 'not'; condition: VisibilityCondition };

// --- Hotspot Actions ---

export type HotspotAction =
  | ExamineAction
  | ExamineImageAction
  | WordRevealAction
  | NavigateAction
  | ToggleLayerAction
  | CompositeAction
  | PlaySoundAction
  | DelayAction;

export interface ExamineAction {
  type: 'examine';
  content: LocalizedText;
  title?: LocalizedText;
  highlightedWords?: string[];
  collectibleWords?: CollectibleWord[];
}

export interface ExamineImageAction {
  type: 'examine_image';
  image: AssetRef;
  caption?: LocalizedText;
  innerHotspots?: Hotspot[];
}

export interface WordRevealAction {
  type: 'word_reveal';
  wordIds: string[];
  feedback?: LocalizedText;
}

export type SceneTransitionType = 'fade' | 'slide_left' | 'slide_right' | 'instant' | 'dissolve' | 'wipe_left' | 'wipe_right';

export interface NavigateAction {
  type: 'navigate';
  targetSceneId: string;
  transition?: SceneTransitionType;
}

export interface ToggleLayerAction {
  type: 'toggle_layer';
  layerId: string;
  visible?: boolean;
}

export interface CompositeAction {
  type: 'composite';
  actions: HotspotAction[];
  delayBetween?: number;
}

export interface PlaySoundAction {
  type: 'play_sound';
  assetRef: AssetRef;
}

/**
 * 씬 전환 시퀀스 내에서 일시 중지를 삽입하는 딜레이 액션.
 * onEnter ActionSequence 및 CompositeAction 내에서 사용.
 */
export interface DelayAction {
  type: 'delay';
  /** 대기 시간 (밀리초) */
  duration: number;
}

export type ActionSequence = HotspotAction[];

// --- Word & WordBank ---

export interface WordDefinition {
  id: string;
  display: LocalizedText;
  category?: WordCategory;
  hint?: LocalizedText;
}

export interface Word {
  id: string;
  display: LocalizedText;
  category?: WordCategory;
  caseId: string;
  hint?: LocalizedText;
  imageUrl?: string;
}

export type WordCategory =
  | 'person'
  | 'place'
  | 'object'
  | 'action'
  | 'time'
  | 'motive'
  | 'evidence'
  | (string & {});

export interface CollectibleWord {
  wordId: string;
  textMatch: LocalizedText;
}

// --- Puzzle ---

export interface PuzzleSet {
  main: Puzzle;
  sub: SubPuzzle[];
}

export interface Puzzle {
  id: string;
  title: LocalizedText;
  description?: LocalizedText;
  type: 'fill_in_blank';
  template: PuzzleTemplate;
  answers: Record<string, AnswerDefinition>;
  minWordsRequired?: number;
  hintConfig?: HintConfig;
  hints?: Hint[];
}

export type SubPuzzle =
  | CharacterIdPuzzle
  | ScenarioPuzzle
  | TimelinePuzzle
  | RelationshipPuzzle;

export interface CharacterIdPuzzle {
  id: string;
  title: LocalizedText;
  type: 'character_id';
  characters: CharacterSlot[];
}

export interface CharacterSlot {
  portrait: AssetRef;
  nameSlotId: string;
  answerId: string;
}

export interface ScenarioPuzzle {
  id: string;
  title: LocalizedText;
  type: 'scenario';
  template: PuzzleTemplate;
  answers: Record<string, AnswerDefinition>;
}

export interface TimelinePuzzle {
  id: string;
  title: LocalizedText;
  type: 'timeline';
  slots: TimelineSlot[];
}

export interface TimelineSlot {
  slotId: string;
  label: LocalizedText;
  answerId: string;
}

export interface RelationshipEdge {
  fromNodeId: string;
  toNodeId: string;
  slotId: string;
  answerId: string;
  /** true이면 역방향 엣지와 동일한 단어가 배정되어야 함 (대칭 검증) */
  symmetric?: boolean;
}

export interface RelationshipPuzzle {
  id: string;
  title: LocalizedText;
  type: 'relationship';
  nodes: { id: string; label: LocalizedText; portrait?: AssetRef }[];
  edges: RelationshipEdge[];
}

export interface PuzzleTemplate {
  sections?: PuzzleSection[];
  segments: PuzzleSegment[];
}

export interface PuzzleSection {
  id: string;
  label?: LocalizedText;
}

export type PuzzleSegment =
  | { type: 'text'; content: LocalizedText }
  | { type: 'slot'; slotId: string; sectionId?: string; placeholder?: LocalizedText; acceptCategory?: WordCategory }
  | { type: 'line_break' };

export interface AnswerDefinition {
  correctWordId: string;
  partiallyCorrectWordIds?: string[];
}

// --- Assets ---

export type AssetCategory =
  | 'background'
  | 'character'
  | 'object'
  | 'ui'
  | 'audio_bgm'
  | 'audio_sfx'
  | 'font';

export interface AssetManifest {
  items: Record<string, AssetDefinition>;
}

export type AssetRef = string;

export interface AssetDefinition {
  id: string;
  type: 'image' | 'audio' | 'font';
  src: string;
  inline?: string;
  mimeType: string;
  size?: number;
  alt?: LocalizedText;
  // Extended metadata
  tags?: string[];
  folder?: string;
  category?: AssetCategory;
  dimensions?: { width: number; height: number };
  duration?: number;
  fileSize?: number;
}

// --- Save State ---

export interface SaveState {
  gameId: string;
  gameVersion: string;
  savedAt: string;
  currentLocale: Locale;
  caseStates: Record<string, CaseState>;
  currentPosition: { caseId: string; sceneId: string } | null;
  flags: Record<string, boolean | string | number>;
}

export interface CaseState {
  status: 'locked' | 'unlocked' | 'completed';
  collectedWordIds: string[];
  puzzleStates: Record<string, PuzzleState>;
  visitedSceneIds: string[];
  visitedHotspotIds: string[];
  layerVisibility: Record<string, boolean>;
}

export interface PuzzleState {
  solved: boolean;
  slotAssignments: Record<string, string | null>;
  lastValidation?: Record<string, 'correct' | 'partial' | 'incorrect'>;
  attemptCount: number;
}

// --- Game State (Runtime) ---

export type GameState =
  | { type: 'loading'; progress: number }
  | { type: 'case_select' }
  | { type: 'exploring'; caseId: string; sceneId: string; sub: ExploringSubState }
  | { type: 'thinking'; caseId: string; puzzleId: string; sub: ThinkingSubState }
  | { type: 'case_completed'; caseId: string }
  | { type: 'game_completed' };

export type ExploringSubState =
  | { type: 'idle' }
  | { type: 'examining_text'; content: LocalizedText; title?: LocalizedText; highlightedWords?: string[]; collectibleWords?: CollectibleWord[] }
  | { type: 'examining_image'; image: AssetRef; caption?: LocalizedText; innerHotspots?: Hotspot[] }
  | { type: 'word_collected'; wordIds: string[] }
  | { type: 'transitioning'; targetSceneId: string }
  | { type: 'puzzle_overlay'; puzzleId: string; solved?: boolean };

export type ThinkingSubState =
  | { type: 'editing' }
  | { type: 'dragging'; wordId: string; sourceSlotId?: string }
  | { type: 'validating' }
  | { type: 'showing_result'; results: ValidationResult }
  | { type: 'solved' };

// --- Game Events ---

export type GameEvent =
  | { type: 'ASSETS_LOADED' }
  | { type: 'SELECT_CASE'; caseId: string }
  | { type: 'NAVIGATE_SCENE'; sceneId: string }
  | { type: 'OPEN_PUZZLE'; puzzleId: string }
  | { type: 'CLOSE_PUZZLE' }
  | { type: 'ASSIGN_WORD'; slotId: string; wordId: string }
  | { type: 'UNASSIGN_WORD'; slotId: string }
  | { type: 'VALIDATE_PUZZLE' }
  | { type: 'CLEAR_ALL_WORDS' }
  | { type: 'CLOSE_POPUP' }
  | { type: 'BACK_TO_SELECT' }
  | { type: 'RESET_GAME' }
  | { type: 'COLLECT_WORD'; wordId: string }
  | { type: 'TOGGLE_LAYER'; layerId: string; visible?: boolean }
  | { type: 'CHANGE_LOCALE'; locale: Locale }
  | { type: 'HOTSPOT_CLICK'; hotspotId: string }
  | { type: 'INNER_HOTSPOT_CLICK'; hotspotId: string }
  | { type: 'OPEN_PUZZLE_OVERLAY'; puzzleId: string }
  | { type: 'CLOSE_PUZZLE_OVERLAY' }
  | { type: 'COLLECT_WORD_IN_POPUP'; wordId: string }
  | { type: 'REQUEST_HINT'; puzzleId: string; level: 1 | 2 | 3 }
  | { type: 'APPLY_HINT_PENALTY'; puzzleId: string; penalty: number };

// --- State Transition Result ---

export interface StateTransitionResult {
  nextState: GameState;
  saveState?: Partial<SaveState>;
  effects: SideEffect[];
}

export type SideEffect =
  | { type: 'play_sound'; assetRef: AssetRef }
  | { type: 'play_bgm'; assetRef: AssetRef; loop?: boolean; fadeDuration?: number }
  | { type: 'stop_bgm'; fadeDuration?: number }
  | { type: 'save_game' }
  | { type: 'show_popup'; content: PopupContent }
  | { type: 'close_popup' }
  | { type: 'animation'; target: string; animation: string }
  | { type: 'unlock_case'; caseId: string }
  | { type: 'word_collected_in_popup'; wordId: string }
  /** onEnter 시퀀스에서 레이어 가시성 변경 */
  | { type: 'toggle_layer'; layerId: string; visible?: boolean }
  /** 씬 전환 시퀀스에서 지정 시간(ms)만큼 대기 */
  | { type: 'delay'; duration: number };

export interface PopupContent {
  title?: LocalizedText;
  body: LocalizedText;
  image?: AssetRef;
}

// --- Validation ---

export interface ValidationResult {
  allCorrect: boolean;
  slotResults: Record<string, 'correct' | 'partial' | 'incorrect'>;
  segmentResults?: Record<string, { correct: number; total: number }>;
}

// --- Hint System ---

export interface HintConfig {
  maxHints: number;
  cooldownSec: number;
  scorePenalty?: number;
}

export interface Hint {
  id: string;
  puzzleId: string;
  level: 1 | 2 | 3;
  text: LocalizedText;
  condition?: string;
}

// --- Common Types ---

export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface BoundingBox extends Position, Dimensions {}

// --- Helpers ---

/** 모든 Act에서 Case를 플랫하게 추출 */
export function getAllCases(def: GameDefinition): Case[] {
  return def.acts.flatMap(act => act.cases);
}

/** 게임 정의에서 특정 Case 찾기 */
export function findCase(def: GameDefinition, caseId: string): Case | undefined {
  return getAllCases(def).find(c => c.id === caseId);
}

/** Case에서 특정 Scene 찾기 */
export function findScene(caseData: Case, sceneId: string): Scene | undefined {
  return caseData.scenes.find(s => s.id === sceneId);
}

/** 게임 정의에서 특정 단어 목록에서 Word 찾기 */
export function findWord(words: Word[], wordId: string): Word | undefined {
  return words.find(w => w.id === wordId);
}

/** 퍼즐 세트에서 특정 퍼즐 찾기 (메인 + 서브) */
export function findPuzzle(puzzleSet: PuzzleSet, puzzleId: string): Puzzle | SubPuzzle | undefined {
  if (puzzleSet.main.id === puzzleId) return puzzleSet.main;
  return puzzleSet.sub.find(p => p.id === puzzleId);
}
