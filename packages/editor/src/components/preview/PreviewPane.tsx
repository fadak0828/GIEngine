import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { GameDefinition, Case, Scene } from '@/store/types';
import type { PreviewMode } from '@/store/types';

const REFRESH_DEBOUNCE_MS = 800;

// ── Runtime existence check ──────────────────────────────────────────────────

async function checkRuntimeExists(): Promise<boolean> {
  try {
    const res = await fetch('/runtime/index.iife.js', { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

// ── srcdoc builder ───────────────────────────────────────────────────────────

interface SrcdocOptions {
  gameData: GameDefinition;
  locale: string;
  mode: PreviewMode;
  caseId?: string;
  sceneId?: string;
}

function buildSrcdoc({ gameData, locale, mode, caseId, sceneId }: SrcdocOptions): string {
  // For 'scene' mode navigate directly to the selected scene.
  // For 'case' mode start from the beginning of the selected case.
  // If neither mode has a caseId the game starts at the case_select screen.
  const startAt =
    mode === 'scene' && caseId
      ? JSON.stringify({ caseId, sceneId })
      : mode === 'case' && caseId
        ? JSON.stringify({ caseId })
        : 'null';

  const jsonData = JSON.stringify(gameData).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#0f0f1a;overflow:hidden}
    #gi-root{width:100%;height:100%}
    #gi-error{
      display:none;color:#ff6b6b;font-family:monospace;font-size:12px;
      padding:16px;white-space:pre-wrap;word-break:break-all;
    }
  </style>
</head>
<body>
  <div id="gi-root"></div>
  <pre id="gi-error"></pre>
  <script src="/runtime/index.iife.js"></script>
  <script>
    (async function() {
      try {
        if (typeof window.__giEngineBoot__ !== 'function') {
          throw new Error('Runtime not loaded.\\nRun: npm run build -w packages/runtime');
        }
        const root = document.getElementById('gi-root');
        const gameData = ${jsonData};
        const startAt = ${startAt};
        await window.__giEngineBoot__(root, gameData, { startAt, loadSave: false });
      } catch (e) {
        const el = document.getElementById('gi-error');
        el.style.display = 'block';
        el.textContent = 'Preview error: ' + (e && e.message ? e.message : String(e));
        console.error('[Preview]', e);
      }
    })();
  </script>
</body>
</html>`;
}

// ── Toolbar button ───────────────────────────────────────────────────────────

interface TbBtnProps {
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'play' | 'stop';
}

function TbBtn({ onClick, active, title, children, variant = 'default' }: TbBtnProps): React.ReactElement {
  const bg =
    variant === 'play'
      ? 'var(--accent)'
      : variant === 'stop'
        ? '#e74c3c'
        : active
          ? 'rgba(255,255,255,0.12)'
          : 'transparent';
  const color =
    variant === 'play' || variant === 'stop'
      ? '#fff'
      : active
        ? 'var(--text-primary)'
        : 'var(--text-secondary)';

  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        fontSize: 11,
        background: bg,
        color,
        border: '1px solid ' + (variant !== 'default' ? 'transparent' : 'var(--border-color)'),
        borderRadius: 3,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontWeight: variant !== 'default' ? 700 : 400,
      }}
    >
      {children}
    </button>
  );
}

// ── Info overlay ─────────────────────────────────────────────────────────────

interface InfoOverlayProps {
  caseName?: string;
  sceneName?: string;
  mode: PreviewMode;
}

function InfoOverlay({ caseName, sceneName, mode }: InfoOverlayProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        display: 'flex',
        gap: 6,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <span
        style={{
          background: 'rgba(0,0,0,0.65)',
          color: 'var(--accent)',
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {mode === 'scene' ? '씬 미리보기' : '케이스 미리보기'}
      </span>
      {caseName && (
        <span
          style={{
            background: 'rgba(0,0,0,0.55)',
            color: '#ccc',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 3,
          }}
        >
          {caseName}
        </span>
      )}
      {sceneName && mode === 'scene' && (
        <span
          style={{
            background: 'rgba(0,0,0,0.55)',
            color: '#eee',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 3,
          }}
        >
          {sceneName}
        </span>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function PreviewPane(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const selection = useEditorStore(s => s.selection);
  const ui = useEditorStore(s => s.ui);
  const words = useEditorStore(s => s.words);
  const {
    setPreviewLocale,
    setPreviewVisible,
    setPreviewMode,
    setPreviewPlaying,
  } = useEditorStore();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [runtimeExists, setRuntimeExists] = useState<boolean | null>(null);
  // srcdocKey forces iframe recreation when incremented
  const [srcdocKey, setSrcdocKey] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshot of project JSON at last render (for change detection)
  const lastProjectJsonRef = useRef<string>('');

  // Resolve selected case & scene
  let selectedCase: Case | null = null;
  let selectedScene: Scene | null = null;
  if (project && selection.caseId) {
    for (const act of project.acts) {
      const c = act.cases.find(cs => cs.id === selection.caseId);
      if (c) {
        selectedCase = c;
        if (selection.sceneId) {
          selectedScene = c.scenes.find(s => s.id === selection.sceneId) ?? null;
        }
        break;
      }
    }
  }

  // Check runtime once on mount
  useEffect(() => {
    checkRuntimeExists().then(setRuntimeExists);
  }, []);

  // Auto-refresh when project data changes while playing
  useEffect(() => {
    if (!ui.previewPlaying || !project) return;

    const json = JSON.stringify(project);
    if (json === lastProjectJsonRef.current) return;

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      lastProjectJsonRef.current = json;
      setSrcdocKey(k => k + 1);
    }, REFRESH_DEBOUNCE_MS);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [project, ui.previewPlaying]);

  // When selection changes (scene), refresh immediately if playing
  useEffect(() => {
    if (!ui.previewPlaying) return;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      setSrcdocKey(k => k + 1);
    }, 200);
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [selection.sceneId, selection.caseId, ui.previewLocale]);

  const handlePlay = useCallback(() => {
    if (!project) return;
    lastProjectJsonRef.current = JSON.stringify(project);
    setSrcdocKey(k => k + 1);
    setPreviewPlaying(true);
  }, [project, setPreviewPlaying]);

  const handleStop = useCallback(() => {
    setPreviewPlaying(false);
  }, [setPreviewPlaying]);

  const handleRefresh = useCallback(() => {
    if (!project) return;
    lastProjectJsonRef.current = JSON.stringify(project);
    setSrcdocKey(k => k + 1);
  }, [project]);

  // ── Collapsed state ────────────────────────────────────────────────────────

  if (!ui.previewVisible) {
    return (
      <div
        style={{
          height: 36,
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setPreviewVisible(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ▲ 프리뷰 열기
        </button>
      </div>
    );
  }

  // ── Build srcdoc (only when playing) ──────────────────────────────────────

  const srcdoc =
    ui.previewPlaying && project
      ? buildSrcdoc({
          gameData: project,
          locale: ui.previewLocale,
          mode: ui.previewMode,
          caseId: selectedCase?.id,
          sceneId: selectedScene?.id,
        })
      : null;

  // ── Determine display name for locale ─────────────────────────────────────

  const getLocalizedName = (
    text?: { ko?: string; en?: string } | string | null
  ): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return (text as Record<string, string>)[ui.editorLocale] ?? text.ko ?? text.en ?? '';
  };

  const caseName = getLocalizedName(selectedCase?.title);
  const sceneName = getLocalizedName(selectedScene?.name);

  // ── Expanded state ─────────────────────────────────────────────────────────

  return (
    <div
      style={{
        height: ui.previewHeight,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 6,
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginRight: 4,
          }}
        >
          프리뷰
        </span>

        {/* Mode selector */}
        <TbBtn
          onClick={() => setPreviewMode('scene')}
          active={ui.previewMode === 'scene'}
          title="선택한 씬을 바로 미리봅니다"
        >
          씬
        </TbBtn>
        <TbBtn
          onClick={() => setPreviewMode('case')}
          active={ui.previewMode === 'case'}
          title="케이스 처음부터 미리봅니다"
        >
          케이스
        </TbBtn>

        <div style={{ width: 1, height: 18, background: 'var(--border-color)', margin: '0 2px' }} />

        {/* Locale toggle */}
        {(['ko', 'en'] as const).map(locale => (
          <TbBtn
            key={locale}
            onClick={() => setPreviewLocale(locale)}
            active={ui.previewLocale === locale}
          >
            {locale.toUpperCase()}
          </TbBtn>
        ))}

        <div style={{ flex: 1 }} />

        {/* Play / Stop / Refresh */}
        {ui.previewPlaying ? (
          <>
            <TbBtn onClick={handleRefresh} title="새로고침 (단축키: 씬 재선택)">
              ⟳ 새로고침
            </TbBtn>
            <TbBtn onClick={handleStop} variant="stop" title="미리보기 중지">
              ⏹ 중지
            </TbBtn>
          </>
        ) : (
          <TbBtn
            onClick={handlePlay}
            variant="play"
            title={!project ? '프로젝트가 없습니다' : !selectedCase ? '씬을 선택하세요' : undefined}
          >
            ▶ 실행
          </TbBtn>
        )}

        {/* Collapse */}
        <button
          onClick={() => { setPreviewPlaying(false); setPreviewVisible(false); }}
          title="프리뷰 닫기"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 4px',
            marginLeft: 2,
          }}
        >
          ▼
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {!ui.previewPlaying ? (
          // Stopped state
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
              gap: 12,
            }}
          >
            {!project ? (
              <span>프로젝트를 열거나 새로 만드세요</span>
            ) : !selectedCase ? (
              <span>씬을 선택한 후 ▶ 실행을 클릭하세요</span>
            ) : (
              <>
                <span>
                  {ui.previewMode === 'scene'
                    ? selectedScene
                      ? `"${caseName} / ${sceneName}" 씬 미리보기 준비`
                      : `케이스 "${caseName}" — 씬을 선택하세요`
                    : `케이스 "${caseName}" 미리보기 준비`}
                </span>
                <button
                  onClick={handlePlay}
                  style={{
                    padding: '6px 18px',
                    background: 'var(--accent)',
                    color: '#000',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  ▶ 실행
                </button>
              </>
            )}
          </div>
        ) : runtimeExists === null ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            런타임 확인 중...
          </div>
        ) : runtimeExists === false ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
              gap: 8,
            }}
          >
            런타임 빌드 필요 —{' '}
            <code
              style={{
                background: 'var(--bg-card)',
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 12,
              }}
            >
              npm run build -w packages/runtime
            </code>
          </div>
        ) : srcdoc ? (
          <>
            <iframe
              key={srcdocKey}
              ref={iframeRef}
              srcDoc={srcdoc}
              style={{ width: '100%', height: '100%', border: 'none', background: '#0f0f1a' }}
              title="게임 프리뷰"
              sandbox="allow-scripts allow-same-origin"
            />
            <InfoOverlay
              caseName={caseName || undefined}
              sceneName={sceneName || undefined}
              mode={ui.previewMode}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
