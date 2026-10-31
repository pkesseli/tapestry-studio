import { normalizeAlias } from '@tapestry/core';
import type { EntityKind } from '@tapestry/core';
import { analyze, mentionAt } from '@tapestry/script';
import type { StudioState } from '@tapestry/service';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AddEntityCard } from './AddEntityCard';
import { InScenePanel } from './InScenePanel';
import { SceneList } from './SceneList';
import { ScriptEditor } from './ScriptEditor';
import type { ScriptEditorHandle } from './ScriptEditor';
import { displayName, modifierLabel } from './format';
import { footageByScene } from './footage';
import { activeSceneIndex, contentsOf, sceneItems } from './scenes';
import type { SceneItem } from './scenes';
import { useStudio } from './useStudio';

/** Approximate height of the add card, used to decide whether it fits below the name. */
const CARD_HEIGHT = 360;

/** How long the cursor must rest before the position is remembered. */
const WORKSPACE_DELAY_MS = 800;

/** How long the cursor must rest on an unknown name before the add card appears. */
const CARD_DELAY_MS = 600;

/**
 * The Write section: scene list on the left, the screenplay in the middle, who and what is in the scene on the right.
 * @param props.initial State loaded when the app started.
 */
export function WriteSection({ initial }: { initial: StudioState }) {
  const studio = useStudio(initial);
  const [cursor, setCursor] = useState(0);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [cardFor, setCardFor] = useState<{
    key: string;
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const editor = useRef<ScriptEditorHandle>(null);
  const column = useRef<HTMLElement>(null);

  const analysis = useMemo(
    () => analyze('fountain', studio.text, studio.state.entities),
    [studio.text, studio.state.entities],
  );
  const scenes = useMemo(() => sceneItems(analysis), [analysis]);
  const activeIndex = activeSceneIndex(scenes, cursor);
  const activeScene: SceneItem | undefined = scenes[activeIndex];
  const footage = useMemo(
    () => footageByScene(studio.state.scenes, studio.state.clips),
    [studio.state.scenes, studio.state.clips],
  );
  const contents = useMemo(
    () =>
      activeScene
        ? contentsOf(activeScene, analysis.mentions, studio.state.entities)
        : contentsOf({ number: 0, title: '', start: 0, end: 0, heading: '', names: [] }, [], []),
    [activeScene, analysis, studio.state.entities],
  );

  const under = mentionAt(analysis, cursor);
  const candidate = under && under.status === 'unresolved' ? under : undefined;
  const candidateKey = candidate
    ? `${candidate.kind}:${normalizeAlias(candidate.text)}`
    : undefined;
  const wanted = candidateKey && !dismissed.has(candidateKey) ? candidate : undefined;

  useEffect(() => {
    if (!wanted || !candidateKey) return undefined;
    const timer = setTimeout(() => {
      const coords = editor.current?.coordsAt(wanted.range.start);
      const box = column.current?.getBoundingClientRect();
      if (!coords || !box || !column.current) return;
      const above = window.innerHeight - coords.bottom < CARD_HEIGHT;
      const anchor = above ? coords.top - 8 : coords.bottom + 8;
      setCardFor({
        key: candidateKey,
        left: Math.max(8, Math.min(coords.left - box.left, box.width - 360)),
        top: anchor - box.top + column.current.scrollTop,
        above,
      });
    }, CARD_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setCardFor(null);
    };
  }, [wanted, candidateKey]);

  // Put the user back where they left off: the saved cursor, or the start of the saved scene.
  useEffect(() => {
    const saved = initial.workspace;
    const byId = initial.scenes.findIndex((scene) => scene.id === saved.activeSceneId);
    const offset = saved.cursor ?? (byId >= 0 ? scenes[byId]?.start : undefined);
    if (offset !== undefined) editor.current?.focusAt(offset);
    // Runs once, with the state the app started with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember the cursor and its scene a moment after they stop changing.
  const activeSceneId = studio.state.scenes[activeIndex]?.id;
  const { saveWorkspace } = studio;
  useEffect(() => {
    const timer = setTimeout(
      () => saveWorkspace({ cursor, ...(activeSceneId !== undefined && { activeSceneId }) }),
      WORKSPACE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [cursor, activeSceneId, saveWorkspace]);

  /** Adds a name to the cast and closes the card. */
  const add = (kind: EntityKind, name: string, description = '') => {
    setCardFor(null);
    void studio.addEntity({ kind, name, description });
  };

  return (
    <div className="body">
      <SceneList
        scenes={scenes}
        footage={footage}
        activeIndex={activeIndex}
        collapsedActs={studio.workspace.collapsedActs}
        onChoose={(scene) => editor.current?.focusAt(scene.start)}
        onToggleAct={(act) => {
          const folded = studio.workspace.collapsedActs;
          studio.saveWorkspace({
            collapsedActs: folded.includes(act)
              ? folded.filter((a) => a !== act)
              : [...folded, act],
          });
        }}
      />

      <main className="main writing" ref={column} style={{ position: 'relative' }}>
        <div className="row wrap">
          <h1 className="h1">Script</h1>
          <span
            className={`chip ${studio.saveStatus === 'failed' ? 'coral' : studio.saveStatus === 'saved' ? 'green' : ''}`}
          >
            {studio.saveStatus === 'saved'
              ? 'Saved'
              : studio.saveStatus === 'saving'
                ? 'Saving…'
                : 'Not saved'}
          </span>
        </div>
        {studio.error && (
          <div className="notice" role="alert">
            {studio.error}
          </div>
        )}
        <div className="paper" style={{ padding: '32px 48px' }}>
          <ScriptEditor
            ref={editor}
            initialText={initial.scriptText}
            analysis={analysis}
            onChange={studio.edit}
            onCursor={setCursor}
            onAddShortcut={() => {
              if (wanted) add(wanted.kind, displayName(wanted.text, wanted.kind === 'character'));
            }}
          />
        </div>

        {wanted && cardFor && cardFor.key === candidateKey && (
          <AddEntityCard
            key={cardFor.key}
            name={wanted.text}
            suggestedKind={wanted.kind}
            position={{ left: cardFor.left, top: cardFor.top, above: cardFor.above }}
            shortcut={`${modifierLabel(window.tapestry.platform)}+Enter`}
            onAdd={add}
            onDismiss={() => {
              setCardFor(null);
              setDismissed((current) => new Set(current).add(candidateKey));
            }}
          />
        )}
      </main>

      <InScenePanel
        scene={activeScene}
        contents={contents}
        clips={footage[activeIndex]?.clips ?? []}
        onAdd={(kind, name) => add(kind, name)}
      />
    </div>
  );
}
