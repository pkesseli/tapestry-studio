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
import { savedScenesFor } from './saved-scenes';
import { newActInsertion, newLineInsertion, newSceneInsertion } from './insertions';
import { activeSceneIndex, contentsOf, sceneContentEnd, sceneItems } from './scenes';
import type { SceneItem } from './scenes';
import { activeShotIndex, shotViews } from './shots-view';
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
  const [exported, setExported] = useState<string | null>(null);
  const editor = useRef<ScriptEditorHandle>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const column = useRef<HTMLElement>(null);

  const analysis = useMemo(
    () => analyze('fountain', studio.text, studio.state.entities),
    [studio.text, studio.state.entities],
  );
  const scenes = useMemo(() => sceneItems(analysis), [analysis]);
  const activeIndex = activeSceneIndex(scenes, cursor);
  const activeScene: SceneItem | undefined = scenes[activeIndex];
  const savedScenes = useMemo(
    () => savedScenesFor(scenes, studio.state.scenes),
    [scenes, studio.state.scenes],
  );
  const footage = useMemo(
    () => footageByScene(savedScenes, studio.state.clips),
    [savedScenes, studio.state.clips],
  );
  const shotsByScene = useMemo(
    () =>
      (analysis.fountain?.scenes ?? []).map((parsed, index) =>
        shotViews(parsed, savedScenes[index], studio.state.clips, studio.state.entities),
      ),
    [analysis, savedScenes, studio.state.clips, studio.state.entities],
  );
  const sceneShots = shotsByScene[activeIndex] ?? [];
  const activeShot = activeShotIndex(sceneShots, cursor);
  const marks = useMemo(
    () =>
      shotsByScene.flatMap((shots, sceneIndex) =>
        shots.map((shot, index) => ({
          start: shot.start,
          data: {
            number: shot.number,
            state: shot.state,
            active: sceneIndex === activeIndex && index === activeShot,
          },
        })),
      ),
    [shotsByScene, activeIndex, activeShot],
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
  const activeSceneId = savedScenes[activeIndex]?.id;
  const { saveWorkspace } = studio;
  useEffect(() => {
    const timer = setTimeout(
      () => saveWorkspace({ cursor, ...(activeSceneId !== undefined && { activeSceneId }) }),
      WORKSPACE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [cursor, activeSceneId, saveWorkspace]);

  /** Writes the screenplay out as a clean script, after saving what has just been typed. */
  const exportScript = async (keepDirections: boolean) => {
    if (menu.current) menu.current.open = false;
    await window.tapestry.saveScript(initial.scriptPath, studio.text);
    const result = await window.tapestry.exportScript(keepDirections);
    if (result.saved) setExported(result.path ?? '');
  };

  /** Adds a new act, with a first scene, at the end of the script. */
  const addAct = () => {
    const acts = (analysis.fountain?.elements ?? []).filter(
      (element) => element.type === 'section' && element.depth === 1,
    ).length;
    editor.current?.insertAt(newActInsertion(studio.text, acts));
  };

  /** Adds a new scene after the one being worked on (at the end when there is none). */
  const addScene = () => {
    const parsed = analysis.fountain?.scenes[activeIndex];
    const offset = parsed ? sceneContentEnd(parsed) : studio.text.length;
    editor.current?.insertAt(newSceneInsertion(studio.text, offset));
  };

  /** Adds dialogue or action after the active shot, past any direction written under it. */
  const addLine = (kind: 'dialogue' | 'action') => {
    const parsed = analysis.fountain?.scenes[activeIndex];
    const shot = sceneShots[activeShot];
    const offset = shot?.blockEnd ?? (parsed ? sceneContentEnd(parsed) : studio.text.length);
    const speakers = (parsed?.beats ?? [])
      .flatMap((beat) => beat.dialogue)
      .filter((line) => line.range.end <= offset)
      .map((line) => line.speaker);
    editor.current?.insertAt(newLineInsertion(studio.text, offset, kind, speakers));
  };

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
        onAddAct={addAct}
        onAddScene={addScene}
        onChoose={(scene) => editor.current?.focusAt(scene.start)}
        onSetCollapsed={(acts) => studio.saveWorkspace({ collapsedActs: acts })}
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
          {exported !== null && (
            <span className="chip teal" role="status">
              Exported {exported.split(/[\\/]/).pop()}
            </span>
          )}
          <div className="grow" />
          <details className="menu" ref={menu}>
            <summary className="btn sm">Export script ▾</summary>
            <div className="menu-list">
              <button type="button" onClick={() => void exportScript(false)}>
                Clean script (no notes or directions)
              </button>
              <button type="button" onClick={() => void exportScript(true)}>
                With directions, for the crew
              </button>
            </div>
          </details>
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
            shots={marks}
            onShotClick={(lineStart) => {
              const lineEnd = studio.text.indexOf('\n', lineStart);
              const hit = shotsByScene
                .flat()
                .find(
                  (shot) =>
                    shot.start >= lineStart && shot.start <= (lineEnd < 0 ? Infinity : lineEnd),
                );
              if (hit) editor.current?.focusAt(hit.start);
            }}
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
        shots={sceneShots}
        activeShot={activeShot}
        onSelectShot={(index) => {
          const shot = sceneShots[index];
          if (shot) editor.current?.focusAt(shot.start, false);
        }}
        onAddDirection={(index) => {
          const shot = sceneShots[index];
          if (shot) editor.current?.insertDirection(shot.end);
        }}
        onEditDirection={(index) => {
          const shot = sceneShots[index];
          if (shot) editor.current?.focusAt(shot.end + 1);
        }}
        onAddLine={addLine}
        onAdd={(kind, name) => add(kind, name)}
      />
    </div>
  );
}
