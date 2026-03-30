import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';

// Check if runtime IIFE exists (bundled at build time)
// In dev, we can't dynamically check file existence, so we try a fetch
async function checkRuntimeExists(): Promise<boolean> {
  try {
    const res = await fetch('/runtime/index.iife.js', { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

export function PreviewPane(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const selection = useEditorStore(s => s.selection);
  const ui = useEditorStore(s => s.ui);
  const { setPreviewLocale, setPreviewVisible } = useEditorStore();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [runtimeExists, setRuntimeExists] = useState<boolean | null>(null);

  useEffect(() => {
    checkRuntimeExists().then(setRuntimeExists);
  }, []);

  // Find selected scene
  let selectedScene = null;
  let selectedCase = null;
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

  if (!ui.previewVisible) {
    return (
      <div style={{ height: 36, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        <button
          onClick={() => setPreviewVisible(true)}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}
        >
          ▲ 프리뷰 열기
        </button>
      </div>
    );
  }

  return (
    <div style={{
      height: ui.previewHeight,
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Preview toolbar */}
      <div style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          프리뷰
        </span>
        <div style={{ flex: 1 }} />
        {/* Locale toggle */}
        {(['ko', 'en'] as const).map(locale => (
          <button
            key={locale}
            onClick={() => setPreviewLocale(locale)}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              background: ui.previewLocale === locale ? 'var(--accent)' : 'transparent',
              color: ui.previewLocale === locale ? '#000' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {locale.toUpperCase()}
          </button>
        ))}
        <button
          onClick={() => setPreviewVisible(false)}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
        >
          ▼
        </button>
      </div>

      {/* Preview content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {!selection.sceneId ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            프리뷰: 씬을 선택하세요
          </div>
        ) : runtimeExists === null ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            런타임 확인 중...
          </div>
        ) : runtimeExists === false ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            런타임 빌드 필요 — <code style={{ marginLeft: 8, background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>npm run build -w packages/runtime</code>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            style={{ width: '100%', height: '100%', border: 'none', background: '#0f0f1a' }}
            title="게임 프리뷰"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}
