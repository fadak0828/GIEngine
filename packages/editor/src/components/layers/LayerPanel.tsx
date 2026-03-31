import React, { useState } from 'react';
import type { SceneLayer } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';

interface LayerPanelProps {
  layers: SceneLayer[];
  caseId: string;
  sceneId: string;
}

export function LayerPanel({
  layers,
  caseId,
  sceneId,
}: LayerPanelProps): React.ReactElement {
  const selection = useEditorStore(s => s.selection);
  const project = useEditorStore(s => s.project);
  const { addLayer, deleteLayer, updateLayer, setSelection, reorderLayers } =
    useEditorStore();

  const [collapsed, setCollapsed] = useState(false);
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  const handleAdd = () => {
    addLayer(caseId, sceneId);
  };

  const handleSelect = (layerId: string) => {
    setSelection({
      layerId: selection.layerId === layerId ? null : layerId,
      hotspotId: null,
    });
  };

  const handleDelete = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();
    deleteLayer(caseId, sceneId, layerId);
  };

  const handleToggleVisible = (e: React.MouseEvent, layer: SceneLayer) => {
    e.stopPropagation();
    updateLayer(caseId, sceneId, layer.id, { visible: !layer.visible });
  };

  // ── DnD handlers ──────────────────────────────────────────────

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    layerId: string,
  ) => {
    setDragLayerId(layerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    layerId: string,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== layerId) setDragOverId(layerId);
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetLayerId: string,
  ) => {
    e.preventDefault();
    if (!dragLayerId || dragLayerId === targetLayerId) {
      setDragLayerId(null);
      setDragOverId(null);
      return;
    }
    const fromIndex = sortedLayers.findIndex(l => l.id === dragLayerId);
    const toIndex = sortedLayers.findIndex(l => l.id === targetLayerId);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderLayers(caseId, sceneId, fromIndex, toIndex);
    }
    setDragLayerId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragLayerId(null);
    setDragOverId(null);
  };

  // ── Thumbnail helper ──────────────────────────────────────────

  const getThumbSrc = (layer: SceneLayer): string | null => {
    if (!layer.image) return null;
    const asset = project?.assets.items[layer.image];
    if (!asset) return null;
    return asset.inline
      ? `data:${asset.mimeType};base64,${asset.inline}`
      : asset.src || null;
  };

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-color)',
        paddingTop: 12,
        marginTop: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: collapsed ? 0 : 8,
        }}
      >
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              transform: collapsed ? 'none' : 'rotate(90deg)',
              transition: 'transform 0.15s',
              display: 'inline-block',
            }}
          >
            &#9654;
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            레이어 ({layers.length})
          </span>
        </button>
        {!collapsed && (
          <button
            onClick={handleAdd}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + 추가
          </button>
        )}
      </div>

      {/* Layer list */}
      {!collapsed && (
        <>
          {layers.length === 0 ? (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                padding: '8px 0',
              }}
            >
              레이어가 없습니다. 추가 버튼을 눌러 생성하세요.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sortedLayers.map(layer => {
                const isSelected = selection.layerId === layer.id;
                const isDragging = dragLayerId === layer.id;
                const isDragOver = dragOverId === layer.id && dragLayerId !== layer.id;
                const thumbSrc = getThumbSrc(layer);

                return (
                  <div
                    key={layer.id}
                    draggable
                    onClick={() => handleSelect(layer.id)}
                    onDragStart={e => handleDragStart(e, layer.id)}
                    onDragOver={e => handleDragOver(e, layer.id)}
                    onDrop={e => handleDrop(e, layer.id)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      borderRadius: 4,
                      cursor: 'grab',
                      background: isSelected
                        ? 'var(--bg-card)'
                        : 'transparent',
                      border: isDragOver
                        ? '1px solid var(--accent)'
                        : isSelected
                        ? '1px solid var(--accent)'
                        : '1px solid transparent',
                      opacity: isDragging ? 0.4 : 1,
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      transition: 'opacity 0.1s',
                    }}
                  >
                    {/* Drag handle */}
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        cursor: 'grab',
                        userSelect: 'none',
                        flexShrink: 0,
                      }}
                    >
                      ⠿
                    </span>

                    {/* Thumbnail */}
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt=""
                        style={{
                          width: 24,
                          height: 24,
                          objectFit: 'cover',
                          borderRadius: 2,
                          flexShrink: 0,
                          border: '1px solid var(--border-color)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 2,
                          flexShrink: 0,
                          border: '1px dashed var(--border-color)',
                          background:
                            'repeating-conic-gradient(var(--bg-card) 0% 25%, var(--bg-panel) 0% 50%) 0 0 / 8px 8px',
                        }}
                      />
                    )}

                    {/* Visibility toggle */}
                    <button
                      onClick={e => handleToggleVisible(e, layer)}
                      title={layer.visible ? '숨기기' : '표시'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: 13,
                        lineHeight: 1,
                        color: layer.visible
                          ? 'var(--accent)'
                          : 'var(--text-muted)',
                        opacity: layer.visible ? 1 : 0.5,
                        flexShrink: 0,
                      }}
                    >
                      {layer.visible ? '👁' : '👁‍🗨'}
                    </button>

                    {/* Layer ID */}
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 11,
                      }}
                    >
                      {layer.id}
                    </span>

                    {/* zIndex badge */}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        minWidth: 18,
                        height: 16,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        padding: '0 4px',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    >
                      z{layer.zIndex}
                    </span>

                    {/* Delete button */}
                    <button
                      onClick={e => handleDelete(e, layer.id)}
                      title="삭제"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                      onMouseEnter={e =>
                        (e.currentTarget.style.color = 'var(--danger)')
                      }
                      onMouseLeave={e =>
                        (e.currentTarget.style.color = 'var(--text-muted)')
                      }
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
