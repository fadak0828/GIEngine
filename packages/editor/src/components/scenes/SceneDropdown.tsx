import React, { useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useEditorStore } from '@/store/editor-store';
import { useClickOutside } from '@/hooks/useClickOutside';
import type { Scene } from '@gi-engine/core';

interface SceneDropdownProps {
  caseId: string;
  sceneId: string;
  onChange: (sceneId: string) => void;
  label?: string;
}

type SceneOption = Pick<Scene, 'id' | 'name'>;

function getSceneName(scene: SceneOption): string {
  const ko = scene.name.ko.trim();
  if (ko) return ko;

  const en = (scene.name.en ?? '').trim();
  if (en) return en;

  return scene.id;
}

export function SceneDropdown(props: SceneDropdownProps): React.ReactElement {
  const caseScenes = useEditorStore(
    useShallow(s => {
      if (!s.project) return [] as SceneOption[];

      for (const act of s.project.acts) {
        const selectedCase = act.cases.find(cs => cs.id === props.caseId);
        if (selectedCase) return selectedCase.scenes;
      }

      return [] as SceneOption[];
    }),
  );

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const labelId = useId();

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  const selectedScene = caseScenes.find(scene => scene.id === props.sceneId);
  const isDangling = props.sceneId !== '' && !selectedScene;

  const needle = search.trim().toLowerCase();
  const filteredScenes = needle === ''
    ? caseScenes
    : caseScenes.filter(scene => {
      const nameKo = scene.name.ko.toLowerCase();
      const nameEn = (scene.name.en ?? '').toLowerCase();
      const sceneId = scene.id.toLowerCase();
      return sceneId.includes(needle) || nameKo.includes(needle) || nameEn.includes(needle);
    });

  const handleSelect = (sceneId: string) => {
    props.onChange(sceneId);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    props.onChange('');
  };

  const focusSearch = () => {
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const focusOption = (index: number) => {
    requestAnimationFrame(() => optionRefs.current[index]?.focus());
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(prev => !prev);
      if (!isOpen) focusSearch();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      focusSearch();
      return;
    }
    if (e.key === 'Escape') {
      if (!isOpen) return;
      e.preventDefault();
      setIsOpen(false);
      setSearch('');
    }
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
      {props.label && (
        <label
          id={labelId}
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {props.label}
        </label>
      )}

        <div
          ref={triggerRef}
          onClick={() => setIsOpen(prev => !prev)}
          onKeyDown={handleTriggerKeyDown}
          tabIndex={0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-labelledby={props.label ? labelId : undefined}
          aria-label={props.label ? undefined : '씬 선택'}
          style={{
            display: 'flex',
            alignItems: 'center',
          gap: 4,
          padding: 6,
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          background: 'var(--bg-card)',
          minHeight: 34,
          cursor: 'pointer',
        }}
      >
        {props.sceneId === '' ? (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', userSelect: 'none' }}>
            Select scene...
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 6px',
              borderRadius: 3,
              fontSize: 11,
              border: `1px solid ${isDangling ? 'var(--danger)' : 'var(--accent)'}`,
              color: isDangling ? 'var(--danger)' : 'var(--text-primary)',
              background: 'transparent',
            }}
          >
            {selectedScene ? getSceneName(selectedScene) : `(Unknown - ${props.sceneId})`}
            {selectedScene && (
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                [{selectedScene.id}]
              </span>
            )}
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isDangling ? 'var(--danger)' : 'var(--text-muted)',
                padding: 0,
                lineHeight: 1,
                fontSize: 12,
                fontWeight: 700,
              }}
              title="Clear"
              aria-label="선택된 씬 제거"
            >
              x
            </button>
          </span>
        )}
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="씬 목록"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: 2,
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            background: 'var(--bg-card)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxHeight: 240,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                  setSearch('');
                  triggerRef.current?.focus();
                  return;
                }
                if (e.key === 'ArrowDown' && filteredScenes.length > 0) {
                  e.preventDefault();
                  focusOption(0);
                }
              }}
              placeholder="Search scene..."
              autoFocus
              style={{
                width: '100%',
                padding: '3px 6px',
                fontSize: 11,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {caseScenes.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              No scenes found in this case.
            </div>
          ) : filteredScenes.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              No matching scenes.
            </div>
          ) : (
            filteredScenes.map((scene, optionIndex) => {
              const isSelected = props.sceneId === scene.id;
              return (
                <button
                  key={scene.id}
                  ref={el => {
                    optionRefs.current[optionIndex] = el;
                  }}
                  type="button"
                  onClick={() => handleSelect(scene.id)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsOpen(false);
                      setSearch('');
                      triggerRef.current?.focus();
                      return;
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      const next = Math.min(optionIndex + 1, filteredScenes.length - 1);
                      focusOption(next);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (optionIndex === 0) {
                        searchRef.current?.focus();
                        return;
                      }
                      focusOption(optionIndex - 1);
                    }
                  }}
                  role="option"
                  aria-selected={isSelected}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    background: isSelected ? 'var(--accent-dim)' : 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {isSelected && (
                    <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
                      *
                    </span>
                  )}
                  <span style={{ fontWeight: 500 }}>{getSceneName(scene)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    [{scene.id}]
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
