import React from 'react';
import { useEditorStore } from '@/store/editor-store';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen(): React.ReactElement {
  const { newProject } = useEditorStore();

  const handleNewProject = () => {
    newProject();
  };

  const handleTryDemo = () => {
    const store = useEditorStore.getState();
    store.newProject();
    store.addAct();
    const state = useEditorStore.getState();
    const actId = state.project?.acts[0]?.id;
    if (actId) {
      store.addCase(actId);
      const state2 = useEditorStore.getState();
      const caseId = state2.project?.acts[0]?.cases[0]?.id;
      const sceneId = state2.project?.acts[0]?.cases[0]?.scenes[0]?.id;
      if (caseId && sceneId) {
        store.setSelection({ actId, caseId, sceneId });
      }
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        backgroundImage: `
          radial-gradient(circle at top, rgba(212, 150, 58, 0.16), transparent 56%),
          linear-gradient(45deg, rgba(255, 255, 255, 0.02) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.02) 75%, rgba(255, 255, 255, 0.02)),
          linear-gradient(45deg, transparent 25%, rgba(0, 0, 0, 0.22) 25%, rgba(0, 0, 0, 0.22) 75%, transparent 75%, transparent)
        `,
        backgroundSize: '100% 100%, 24px 24px, 24px 24px',
        backgroundPosition: '0 0, 0 0, 12px 12px',
        color: 'var(--text-primary)',
        padding: 'var(--space-2xl)',
      }}
    >
      <section
        style={{
          width: 'min(680px, 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          background: 'rgba(36, 31, 26, 0.82)',
          boxShadow: '0 18px 50px rgba(0, 0, 0, 0.42)',
          backdropFilter: 'blur(6px)',
          textAlign: 'center',
          padding: 'clamp(24px, 5vw, 48px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-xl)',
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
            }}
          >
            Warm Industrial Workspace
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontWeight: 400,
              fontSize: 'clamp(34px, 5vw, 48px)',
              lineHeight: 1.15,
              color: 'var(--text-primary)',
            }}
          >
            GIEngine Editor
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 'clamp(15px, 2.2vw, 18px)',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            Build detective cases with a focused, token-driven authoring workflow.
          </p>
        </header>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 'var(--space-md)',
          }}
        >
          <button
            onClick={handleNewProject}
            className={styles.primaryBtn}
            aria-label="새 프로젝트 시작"
          >
            Start New Project
          </button>
          <button
            onClick={handleTryDemo}
            className={styles.ghostBtn}
            aria-label="데모 케이스 체험하기"
          >
            Try Demo Case
          </button>
        </div>

        <div
          style={{
            margin: '0 auto',
            maxWidth: 560,
            paddingTop: 'var(--space-sm)',
            borderTop: '1px solid var(--border-color)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2xs)',
          }}
        >
          <p style={{ margin: 0 }}>
            Start from a blank project or open a demo to explore editor interactions quickly.
          </p>
          <p style={{ margin: 0 }}>
            Export your final mystery game as a standalone HTML runtime package.
          </p>
        </div>
      </section>
    </div>
  );
}
