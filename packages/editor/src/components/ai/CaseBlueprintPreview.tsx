/**
 * CaseBlueprintPreview - preview generated case blueprint
 * Phase 5b / Phase 6
 */

import React, { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type {
  BlueprintCharacter,
  BlueprintScene,
  BlueprintWord,
} from '@/store/interview-slice';
import styles from './CaseBlueprintPreview.module.css';

const ROLE_LABEL: Record<string, string> = {
  culprit: 'Culprit',
  victim: 'Victim',
  suspect: 'Suspect',
  witness: 'Witness',
};

const ROLE_CLASS_KEY: Record<string, string> = {
  culprit: 'roleCulprit',
  victim: 'roleVictim',
  suspect: 'roleSuspect',
  witness: 'roleWitness',
};

const cx = (...tokens: Array<string | false | null | undefined>): string =>
  tokens.filter((token): token is string => Boolean(token)).join(' ');

function roleClass(role: string): string {
  const key = ROLE_CLASS_KEY[role] ?? 'roleDefault';
  return styles[key];
}

function ProgressBar({ percent, step }: { percent: number; step: string }): React.ReactElement {
  return (
    <div className={styles.progressCard}>
      <div className={styles.progressHeader}>
        <div className={styles.progressStep}>{step}</div>
        <div className={styles.progressPercent}>{percent}%</div>
      </div>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function CaseBlueprintPreview(): React.ReactElement | null {
  const {
    interview,
    closeBlueprintPreview,
    resetInterview,
    applyBlueprintToEditor,
    project,
  } = useEditorStore();

  const { blueprintPreviewOpen, blueprint, generationProgress } = interview;
  const [generateBg, setGenerateBg] = useState(false);

  const isGenerating = generationProgress !== null;

  if (!blueprintPreviewOpen || !blueprint) return null;

  const handleApply = () => {
    if (!project || isGenerating) return;

    const actId = project.acts[0]?.id ?? null;
    if (!actId) return;

    void applyBlueprintToEditor(actId, generateBg);
  };

  const handleDiscard = () => {
    if (isGenerating) return;
    resetInterview();
  };

  const handleBackToInterview = () => {
    if (isGenerating) return;
    closeBlueprintPreview();
  };

  return (
    <>
      <div
        onClick={isGenerating ? undefined : handleBackToInterview}
        className={styles.backdrop}
      />

      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerBody}>
            <div className={styles.title}>Case Blueprint Preview</div>
            <div className={styles.subtitle}>
              Review generated case structure before applying it to the project.
            </div>
          </div>

          <button
            onClick={isGenerating ? undefined : handleBackToInterview}
            disabled={isGenerating}
            aria-label="미리보기 닫기"
            className={cx(styles.closeButton, isGenerating && styles.buttonDisabled)}
          >
            X
          </button>
        </div>

        <div className={styles.content}>
          {isGenerating && generationProgress && (
            <ProgressBar percent={generationProgress.percent} step={generationProgress.step} />
          )}

          {interview.error && !isGenerating && (
            <div className={styles.errorBox}>{interview.error}</div>
          )}

          <div className={styles.metaBlock}>
            <div className={styles.blueprintTitle}>{blueprint.title.ko}</div>
            <div className={styles.blueprintDescription}>{blueprint.description.ko}</div>
            <div className={styles.metaBadges}>
              <span className={cx(styles.badge, styles.accentBadge)}>
                Genre: {blueprint.genre}
              </span>
              <span className={styles.badge}>Scenes: {blueprint.scenes.length}</span>
              <span className={styles.badge}>Words: {blueprint.words.length}</span>
              <span className={styles.badge}>Characters: {blueprint.characters.length}</span>
            </div>
          </div>

          {blueprint.characters.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Characters</div>
              <div className={styles.characterList}>
                {blueprint.characters.map((char, i) => (
                  <CharacterCard key={i} char={char} />
                ))}
              </div>
            </section>
          )}

          {blueprint.scenes.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Scene Structure</div>
              <div className={styles.sceneList}>
                {blueprint.scenes.map((scene, i) => (
                  <SceneCard key={i} scene={scene} />
                ))}
              </div>
            </section>
          )}

          {blueprint.words.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Word List</div>
              <div className={styles.wordList}>
                {blueprint.words.map((word, i) => (
                  <WordTag key={i} word={word} />
                ))}
              </div>
            </section>
          )}

          {blueprint.mainPuzzle && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Main Puzzle</div>
              <div className={styles.mainPuzzleTitle}>{blueprint.mainPuzzle.titleHint}</div>
              <div className={styles.mainPuzzleDescription}>
                {blueprint.mainPuzzle.descriptionHint}
              </div>
              {blueprint.mainPuzzle.requiredWordTempIds.length > 0 && (
                <div className={styles.requiredWords}>
                  Required words: {blueprint.mainPuzzle.requiredWordTempIds.length}
                </div>
              )}
            </section>
          )}

          {blueprint.subPuzzles.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                Sub Puzzles ({blueprint.subPuzzles.length})
              </div>
              <div className={styles.puzzleList}>
                {blueprint.subPuzzles.map((sp, i) => (
                  <div key={i} className={styles.puzzleItem}>
                    <span className={styles.badge}>{sp.type}</span>
                    <span>{sp.description}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className={styles.footer}>
          {!isGenerating && (
            <label className={styles.backgroundOption}>
              <input
                type="checkbox"
                checked={generateBg}
                onChange={(e) => setGenerateBg(e.target.checked)}
                className={styles.backgroundCheckbox}
              />
              Generate background image with AI
            </label>
          )}

          <div className={styles.spacer} />

          <button
            onClick={handleDiscard}
            disabled={isGenerating}
            className={cx(styles.ghostButton, isGenerating && styles.buttonDisabled)}
          >
            Discard
          </button>

          <button
            onClick={handleBackToInterview}
            disabled={isGenerating}
            className={cx(styles.ghostButton, isGenerating && styles.buttonDisabled)}
          >
            Back to Interview
          </button>

          <button
            onClick={handleApply}
            disabled={isGenerating}
            className={cx(styles.primaryButton, isGenerating && styles.buttonDisabled)}
          >
            {isGenerating ? 'Generating...' : 'Create Case'}
          </button>
        </div>
      </div>
    </>
  );
}

function CharacterCard({ char }: { char: BlueprintCharacter }): React.ReactElement {
  const cls = roleClass(char.role);

  return (
    <div className={styles.characterRow}>
      <div className={cx(styles.roleDot, cls)} />

      <div className={styles.characterBody}>
        <div className={styles.characterTitle}>
          {char.name}
          <span className={cx(styles.roleLabel, cls)}>[{ROLE_LABEL[char.role] ?? char.role}]</span>
        </div>

        <div className={styles.characterDescription}>{char.description}</div>

        {char.alibi && <div className={styles.alibi}>Alibi: {char.alibi}</div>}
      </div>
    </div>
  );
}

function SceneCard({ scene }: { scene: BlueprintScene }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.sceneCard}>
      <button
        onClick={() => setExpanded((value) => !value)}
        className={styles.sceneToggle}
      >
        <span className={styles.sceneArrow}>{expanded ? '▾' : '▸'}</span>
        <span className={styles.sceneName}>{scene.name.ko}</span>
        {scene.hotspotHints.length > 0 && (
          <span className={cx(styles.badge, styles.sceneMetaBadge)}>
            {scene.hotspotHints.length} hotspots
          </span>
        )}
      </button>

      {expanded && (
        <div className={styles.sceneExpanded}>
          <div className={styles.sceneDescription}>{scene.description}</div>

          {scene.connections.length > 0 && (
            <div className={styles.sceneConnections}>
              Connections: {scene.connections.join(', ')}
            </div>
          )}

          {scene.hotspotHints.length > 0 && (
            <div className={styles.hotspotList}>
              {scene.hotspotHints.map((hint, i) => (
                <div key={i} className={styles.hotspotRow}>
                  <span className={cx(styles.badge, styles.hotspotType)}>{hint.actionType}</span>
                  <span>{hint.label}</span>
                  {hint.contentHint && (
                    <span className={styles.hotspotHint}>→ {hint.contentHint}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WordTag({ word }: { word: BlueprintWord }): React.ReactElement {
  return (
    <div className={styles.wordTag}>
      <div className={styles.wordDisplay}>{word.display.ko}</div>
      <div className={styles.wordCategory}>{word.category}</div>
    </div>
  );
}