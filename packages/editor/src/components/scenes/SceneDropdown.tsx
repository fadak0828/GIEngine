import React, { useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useEditorStore } from '@/store/editor-store';
import { useClickOutside } from '@/hooks/useClickOutside';
import type { Scene } from '@gi-engine/core';
import s from './SceneDropdown.module.css';

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
    <div ref={containerRef} className={s.root}>
      {props.label && (
        <label id={labelId} className="field-label">
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
        className="dropdown-trigger"
      >
        {props.sceneId === '' ? (
          <span className="dropdown-placeholder">Select scene...</span>
        ) : (
          <span
            className={`chip${isDangling ? ' danger' : ''}`}
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
              className="chip-clear"
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
          className="dropdown-panel"
        >
          <div className="dropdown-search-row">
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
              className="dropdown-search"
            />
          </div>

          {caseScenes.length === 0 ? (
            <div className="dropdown-empty">No scenes found in this case.</div>
          ) : filteredScenes.length === 0 ? (
            <div className="dropdown-empty">No matching scenes.</div>
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
                  className={`dropdown-option${isSelected ? ' dropdown-option-selected' : ''}`}
                >
                  {isSelected && (
                    <span className={s.optionCheck}>*</span>
                  )}
                  <span className={s.optionText}>{getSceneName(scene)}</span>
                  <span className={s.optionId}>[{scene.id}]</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
