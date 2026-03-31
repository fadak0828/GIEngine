import React, { useState, useMemo } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { validateProjectDefinition } from '@gi-engine/core';

// Inline type to avoid compile-time dependency on @gi-engine/exporter
interface BrowserExportResult {
  html: string;
  fileName: string;
  totalSize: number;
  breakdown: { js: number; css: number; assets: number; data: number };
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

type Phase = 'idle' | 'exporting' | 'success' | 'error';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ExportModal({ open, onClose }: ExportModalProps): React.ReactElement | null {
  const project = useEditorStore(s => s.project);
  const words = useEditorStore(s => s.words);

  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<'development' | 'production'>('production');
  const [result, setResult] = useState<BrowserExportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validation = useMemo(() => {
    if (!project) return null;
    return validateProjectDefinition(project, words);
  }, [project, words]);

  if (!open) return null;

  const fileName = `${project?.id ?? 'game'}.html`;
  const isExporting = phase === 'exporting';

  const handleClose = () => {
    if (isExporting) return;
    // Reset state on close
    setPhase('idle');
    setResult(null);
    setErrorMessage(null);
    onClose();
  };

  const handleExport = async () => {
    if (!project) return;
    setPhase('exporting');
    setResult(null);
    setErrorMessage(null);
    try {
      // Merge editor words into the game definition's words dictionary
      const wordsDict: Record<string, { id: string; display: { ko: string; en: string }; category?: string; hint?: { ko: string; en: string } }> = { ...(project as any).words };
      for (const w of words) {
        wordsDict[w.id] = {
          id: w.id,
          display: w.display,
          ...(w.category ? { category: w.category } : {}),
          ...(w.hint ? { hint: w.hint } : {}),
        };
      }
      const exportDef = { ...project, words: wordsDict };

      const exporterModule = await import('@gi-engine/exporter');
      const exportResult = await exporterModule.browserExport({ gameDefinition: exportDef as never, mode });

      // Trigger download
      const blob = new Blob([exportResult.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportResult.fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setResult(exportResult);
      setPhase('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      setPhase('error');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
          cursor: isExporting ? 'not-allowed' : 'pointer',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: 20,
        zIndex: 1001,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            📤 HTML 익스포트
          </div>
          <button
            onClick={handleClose}
            disabled={isExporting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              fontSize: 18,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* File name display */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            출력 파일명
          </label>
          <div style={{
            padding: '6px 8px',
            fontSize: 12,
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
          }}>
            {fileName}
          </div>
        </div>

        {/* Validation summary */}
        {validation && !validation.isValid && (
          <div style={{
            marginBottom: 12,
            padding: '8px 10px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 3,
            fontSize: 12,
            color: '#ef4444',
          }}>
            ⚠ 프로젝트에 오류 {validation.errorCount}개가 있습니다.
            익스포트 전 검증 탭에서 확인하세요.
          </div>
        )}
        {validation && validation.isValid && validation.warningCount > 0 && (
          <div style={{
            marginBottom: 12,
            padding: '8px 10px',
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 3,
            fontSize: 12,
            color: '#fbbf24',
          }}>
            ⚠ 경고 {validation.warningCount}개가 있습니다. 확인 후 익스포트하세요.
          </div>
        )}

        {/* Mode selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            빌드 모드
          </label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as 'development' | 'production')}
            disabled={isExporting}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 12,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              outline: 'none',
              cursor: isExporting ? 'not-allowed' : 'pointer',
            }}
          >
            <option value="production">프로덕션 (최소화)</option>
            <option value="development">개발 (가독성)</option>
          </select>
        </div>

        {/* Success: size breakdown */}
        {phase === 'success' && result && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 8, fontWeight: 600 }}>
              ✅ 다운로드 완료
            </div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <tbody>
                {([
                  ['JS 런타임', result.breakdown.js],
                  ['CSS', result.breakdown.css],
                  ['에셋', result.breakdown.assets],
                  ['게임 데이터', result.breakdown.data],
                ] as [string, number][]).map(([label, size]) => (
                  <tr key={label}>
                    <td style={{ padding: '2px 0', color: 'var(--text-muted)' }}>{label}</td>
                    <td style={{ padding: '2px 0', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatSize(size)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '4px 0', color: 'var(--text-primary)', fontWeight: 600 }}>총 크기</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{formatSize(result.totalSize)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && errorMessage && (
          <div style={{
            marginBottom: 12,
            padding: '8px 10px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 3,
            fontSize: 12,
            color: '#ef4444',
          }}>
            {errorMessage}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleClose}
            disabled={isExporting}
            style={{
              flex: 1,
              padding: '7px 12px',
              fontSize: 12,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              cursor: isExporting ? 'not-allowed' : 'pointer',
            }}
          >
            {phase === 'success' ? '닫기' : '취소'}
          </button>
          {phase !== 'success' && (
            <button
              onClick={handleExport}
              disabled={isExporting || !project}
              style={{
                flex: 2,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: !isExporting && project ? 'var(--accent)' : 'var(--bg-card)',
                color: !isExporting && project ? '#000' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 3,
                cursor: !isExporting && project ? 'pointer' : 'not-allowed',
              }}
            >
              {isExporting ? '익스포트 중...' : phase === 'error' ? '다시 시도' : 'HTML 내보내기'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
