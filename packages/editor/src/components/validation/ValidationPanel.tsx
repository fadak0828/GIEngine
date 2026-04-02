import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { validateProjectDefinition } from '@gi-engine/core';
import type { ProjectIssue } from '@gi-engine/core';

export function ValidationPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const words = useEditorStore(s => s.words);
  const { setSelection, setActivePanel } = useEditorStore();

  const result = useMemo(() => {
    if (!project) return null;
    return validateProjectDefinition(project, words);
  }, [project, words]);

  const handleIssueClick = (issue: ProjectIssue) => {
    if (!issue.target) return;
    const { caseId, sceneId, hotspotId } = issue.target;
    setSelection({ caseId, sceneId: sceneId ?? null, hotspotId: hotspotId ?? null });
    if (sceneId) {
      setActivePanel('scene');
    }
  };

  if (!project) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
        프로젝트를 먼저 열어주세요.
      </div>
    );
  }

  if (!result) return <div />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          프로젝트 검증
        </span>
        <span style={{
          fontSize: 11,
          padding: '1px 6px',
          borderRadius: 10,
          background: result.isValid ? 'rgba(74,222,128,0.15)' : 'rgba(196,64,64,0.15)',
          color: result.isValid ? 'var(--success)' : 'var(--danger)',
          fontWeight: 600,
        }}>
          {result.isValid ? '✓ 정상' : `오류 ${result.errorCount}`}
        </span>
        {result.warningCount > 0 && (
          <span style={{
            fontSize: 11,
            padding: '1px 6px',
            borderRadius: 10,
            background: 'rgba(251,191,36,0.15)',
            color: 'var(--partial)',
            fontWeight: 600,
          }}>
            경고 {result.warningCount}
          </span>
        )}
      </div>

      {/* Issue list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {result.issues.length === 0 ? (
          <div style={{ padding: '20px 14px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            검증 문제가 없습니다.
          </div>
        ) : (
          result.issues.map((issue, i) => (
            <div
              key={i}
              onClick={() => handleIssueClick(issue)}
              style={{
                padding: '8px 14px',
                cursor: issue.target ? 'pointer' : 'default',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
              onMouseEnter={e => {
                if (issue.target) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: issue.severity === 'error' ? 'var(--danger)' : 'var(--partial)',
                flexShrink: 0,
                marginTop: 1,
              }}>
                {issue.severity === 'error' ? '✕' : '⚠'}
              </span>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {issue.message}
                </div>
                {issue.target && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    클릭하여 이동
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
