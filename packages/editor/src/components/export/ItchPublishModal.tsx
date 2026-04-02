import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { GameDefinition } from '@gi-engine/core';
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap';

interface ItchPublishModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-built HTML export (used for itch.txt preview) */
  exportHtml?: string;
  exportFileName?: string;
}

type Phase = 'config' | 'preview' | 'downloading' | 'success' | 'error';

export function ItchPublishModal({ open, onClose, exportHtml, exportFileName }: ItchPublishModalProps): React.ReactElement | null {
  const project = useEditorStore(s => s.project);
  const itch = useEditorStore(s => s.itch);
  const setItchCredentials = useEditorStore(s => s.setItchCredentials);
  const setItchPublishConfig = useEditorStore(s => s.setItchPublishConfig);

  const [phase, setPhase] = useState<Phase>('config');
  const [apiKey, setApiKey] = useState('');
  const [pageId, setPageId] = useState('');
  const [username, setUsername] = useState('');
  const [tags, setTags] = useState('gi-engine, mystery, interactive-fiction');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [butlerCommand, setButlerCommand] = useState<string | null>(null);
  const [embedSnippet, setEmbedSnippet] = useState<string | null>(null);
  const [itchTxtContent, setItchTxtContent] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const embedRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Pre-fill from stored config
  useEffect(() => {
    if (open) {
      if (itch.credentials) {
        setApiKey(itch.credentials.apiKey);
        setUsername(itch.credentials.username);
      }
      if (itch.publishConfig) {
        setPageId(itch.publishConfig.pageId);
        setTags(itch.publishConfig.tags);
      }
      setPhase('config');
      setErrorMessage(null);
    }
  }, [open, itch.credentials, itch.publishConfig]);

  if (!open || !project) return null;

  const gameDef = project as GameDefinition;
  const title = gameDef.title.ko ?? gameDef.title.en ?? 'GIEngine Game';
  const slug = gameDef.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const generateItchTxt = (): string => {
    const description = gameDef.description?.ko ?? gameDef.description?.en ?? title;
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const lines: string[] = [
      `title: ${title}`,
      `itchseite: html`,
      ...(tagList.length > 0 ? [`tags: ${tagList.join(', ')}`] : []),
      '',
      `## ${title}`,
      description,
      '',
      `Made with [GIEngine](https://github.com/paperclip-ai/GIEngine)`,
    ];
    return lines.join('\n');
  };

  const generateEmbedSnippet = (): string => {
    const srcPageId = pageId || `${username}/${slug}`;
    return `<iframe
  src="https://${srcPageId.replace('/', '.itch.io/')}/${exportFileName ?? 'game.html'}"
  width="960"
  height="540"
  frameborder="0"
  allowfullscreen>
</iframe>`;
  };

  const handleValidateAndPreview = async () => {
    if (!apiKey.trim() || !pageId.trim()) {
      setErrorMessage('API 키와 Page ID를 모두 입력해 주세요.');
      return;
    }

    if (!pageId.includes('/')) {
      setErrorMessage('Page ID는 "username/game-slug" 형식이어야 합니다.');
      return;
    }

    setErrorMessage(null);
    setPhase('downloading');

    try {
      // Validate API key by fetching user info
      const response = await fetch('https://itch.io/api/1/me', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('API 키가 유효하지 않습니다. itch.io 설정에서 새 API 키를 발급받아 주세요.');
        }
        throw new Error(`itch.io API 오류: HTTP ${response.status}`);
      }

      const data = (await response.json()) as { username?: string };
      const resolvedUsername = data.username ?? username;

      // Save credentials
      setItchCredentials({ apiKey: apiKey.trim(), username: resolvedUsername });

      // Save publish config
      setItchPublishConfig({
        pageId: pageId.trim(),
        title,
        tags,
      });

      // Generate preview content
      const itchTxt = generateItchTxt();
      const embed = generateEmbedSnippet();
      const resolvedPageId = pageId.includes('/') ? pageId : `${resolvedUsername}/${slug}`;

      setItchTxtContent(itchTxt);
      setEmbedSnippet(embed);
      setButlerCommand(`butler push ./build ${resolvedPageId} --latest`);
      setPhase('preview');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      setPhase('error');
    }
  };

  const handleDownloadItchTxt = () => {
    if (!itchTxtContent) return;
    const blob = new Blob([itchTxtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'itch.txt';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtml = () => {
    if (!exportHtml || !exportFileName) return;
    const blob = new Blob([exportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleClose = () => {
    setPhase('config');
    setErrorMessage(null);
    onClose();
  };

  useDialogFocusTrap(open, dialogRef, handleClose);

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 520,
    maxHeight: '90vh',
    overflowY: 'auto',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
    zIndex: 1001,
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="modal-backdrop"
        style={{ zIndex: 1000 }}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="itch-publish-title"
        aria-label="itch.io 게임 배포"
        style={modalStyle}
      >
        {/* Header */}
        <div className="modal-header">
          <div id="itch-publish-title" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            🎮 itch.io 发布
          </div>
          <button onClick={handleClose} className="modal-close" aria-label="itch.io 배포 닫기">
            ×
          </button>
        </div>

        {/* Game info */}
        <div style={{ marginBottom: 16, padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{title}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
            예상 슬러그: <code style={{ color: 'var(--accent)' }}>{username ? `${username}/` : ''}{slug}</code>
          </div>
        </div>

        {/* Error */}
        {phase === 'error' && errorMessage && (
          <div className="alert-error" style={{ marginBottom: 12 }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Phase: Config */}
        {(phase === 'config' || phase === 'error') && (
          <>
            {/* API Key */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                itch.io API 키 <a href="https://itch.io/user/settings/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 10 }}>(발급받기 →)</a>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="••••••••••••••••••••••"
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Username */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                itch.io 사용자명
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="your-username"
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Page ID */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                itch.io Page ID <span style={{ color: 'var(--danger-text)' }}>*</span>
              </label>
              <input
                type="text"
                value={pageId}
                onChange={e => setPageId(e.target.value)}
                placeholder="username/my-game"
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                태그 (쉼표로 구분)
              </label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="gi-engine, mystery, interactive-fiction"
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={handleValidateAndPreview}
              style={{ width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            >
              검증 및 미리보기
            </button>
          </>
        )}

        {/* Phase: Validating */}
        {phase === 'downloading' && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
            🔄 API 키 검증 중...
          </div>
        )}

        {/* Phase: Preview / Success */}
        {phase === 'preview' && (
          <>
            {/* itch.txt preview */}
            {itchTxtContent && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>itch.txt 미리보기</label>
                  <button
                    onClick={handleDownloadItchTxt}
                    style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    📥 다운로드
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '6px 8px', fontSize: 11, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {itchTxtContent}
                </pre>
              </div>
            )}

            {/* Butler command */}
            {butlerCommand && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Butler 푸시 명령어
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    type="text"
                    readOnly
                    value={butlerCommand}
                    onClick={() => copyToClipboard(butlerCommand, 'butler')}
                    className="font-mono"
                    style={{ flex: 1, padding: '6px 8px', fontSize: 11, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                  />
                  <button
                    onClick={() => copyToClipboard(butlerCommand, 'butler')}
                    style={{ padding: '6px 10px', fontSize: 11, background: 'var(--bg-card)', color: copied === 'butler' ? 'var(--success)' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {copied === 'butler' ? '✅' : '📋'}
                  </button>
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                  1. HTML 파일을 <code style={{ color: 'var(--accent)' }}>./build</code> 폴더에 배치하세요.
                  {' '}
                  2. 위 명령어를 실행하세요.
                  {' '}
                  3. <a href={`https://itch.io/${pageId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>itch.io 페이지에서 확인 →</a>
                </div>
              </div>
            )}

            {/* Download HTML */}
            {exportHtml && exportFileName && (
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={handleDownloadHtml}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                >
                  📦 HTML 파일 다운로드 ({exportFileName})
                </button>
              </div>
            )}

            {/* Embed code */}
            {embedSnippet && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>임베드 코드</label>
                  <button
                    onClick={() => copyToClipboard(embedSnippet, 'embed')}
                    style={{ fontSize: 10, color: copied === 'embed' ? 'var(--success)' : 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {copied === 'embed' ? '✅ 복사됨' : '📋 복사'}
                  </button>
                </div>
                <textarea
                  ref={embedRef}
                  readOnly
                  rows={4}
                  value={embedSnippet}
                  onClick={() => embedRef.current?.select()}
                  className="font-mono"
                  style={{ width: '100%', padding: '6px 8px', fontSize: 11, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Butler not installed warning */}
            <div className="alert-warning" style={{ marginBottom: 16 }}>
              💡 Butler CLI가 설치되어 있어야 자동 푸시가 가능합니다.{' '}
              <a href="https://itch.io/butler" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--partial)' }}>butler 설치하기 →</a>
            </div>

            <button
              onClick={handleClose}
              style={{ width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            >
              완료
            </button>
          </>
        )}
      </div>
    </>
  );
}
