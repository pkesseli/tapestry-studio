import type { SceneClip } from '@tapestry/service';
import { useMemo, useState } from 'react';
import { mediaUrl } from '../../../shared/media-url';
import { footageSummary } from './footage';
import type { SceneFootage } from './footage';
import { filterGroups, groupScenes } from './scene-groups';
import type { IndexedScene } from './scene-groups';
import type { SceneItem } from './scenes';

/** Properties of {@link SceneList}. */
interface SceneListProps {
  scenes: readonly SceneItem[];
  /** Footage of each scene, in the same order as `scenes` (may be shorter while the text is being edited). */
  footage: readonly SceneFootage[];
  /** Index of the scene the cursor is in. */
  activeIndex: number;
  /** Acts that are folded away. */
  collapsedActs: readonly string[];
  /** Called when a scene is chosen; the editor then jumps to it. */
  onChoose(scene: SceneItem): void;
  /**
   * Called when an act heading is clicked to fold or unfold it.
   * @param act Name of the act.
   */
  onToggleAct(act: string): void;
}

/**
 * The small row of frames under a scene's title: one per planned shot, showing the video's first frame when it exists
 * and a dashed empty frame when it does not. Accepted shots carry a check; sample footage has an amber edge.
 * @param props.footage Footage of the scene.
 */
function Filmstrip({ footage }: { footage: SceneFootage }) {
  const frames = Array.from({ length: footage.shots }, (_, i) =>
    footage.clips.find((c) => c.shotNumber === i + 1),
  );
  return (
    <span className="strip" aria-hidden="true">
      {frames.map((clip: SceneClip | undefined, index) =>
        clip ? (
          <span className={`frame${clip.sample ? ' sample-edge' : ''}`} key={clip.shotId}>
            <video src={mediaUrl(clip.path, 2)} muted preload="metadata" tabIndex={-1} />
            {clip.accepted && (
              <span className="lock">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
            )}
          </span>
        ) : (
          <span className="frame empty" key={`empty-${index}`} />
        ),
      )}
    </span>
  );
}

/**
 * One scene as a button.
 * @param props.entry The scene and its position in the full list.
 */
function SceneButton({
  entry,
  footage,
  active,
  onChoose,
}: {
  entry: IndexedScene;
  footage: SceneFootage | undefined;
  active: boolean;
  onChoose(scene: SceneItem): void;
}) {
  const { item } = entry;
  return (
    <button
      type="button"
      className={`scene${active ? ' on' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={() => onChoose(item)}
    >
      <span className="row">
        <span className="num">{item.number}</span>
        <span className="bold">{item.title}</span>
      </span>
      {footage && footage.shots > 0 && <Filmstrip footage={footage} />}
      <span className="small muted">{footageSummary(footage)}</span>
      {footage?.clips.some((clip) => clip.sample) && (
        <span className="chip amber sample-chip">Sample footage</span>
      )}
    </button>
  );
}

/**
 * The scenes of the screenplay, grouped under their acts, searchable, one button each. They follow the text: type a new
 * INT. or EXT. line and a scene appears; type a `# Act One` line and an act heading does.
 */
export function SceneList({
  scenes,
  footage,
  activeIndex,
  collapsedActs,
  onChoose,
  onToggleAct,
}: SceneListProps) {
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const groups = useMemo(() => filterGroups(groupScenes(scenes), query), [scenes, query]);
  return (
    <aside className="side" aria-label="Scenes">
      <div className="row" style={{ padding: '4px 6px 0' }}>
        <span className="label grow">Scenes</span>
        <span className="tiny muted">{scenes.length}</span>
      </div>
      <input
        type="search"
        className="field scene-search"
        placeholder="Search scenes or names"
        aria-label="Search scenes"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && setQuery('')}
      />
      {groups.map((group) => {
        const folded = group.act !== undefined && !searching && collapsedActs.includes(group.act);
        const holdsActive = group.scenes.some((s) => s.index === activeIndex);
        return (
          <div className="act" key={`${group.act ?? ''}-${group.scenes[0]?.index}`}>
            {group.act !== undefined && (
              <button
                type="button"
                className="act-head"
                aria-expanded={!folded}
                onClick={() => onToggleAct(group.act as string)}
              >
                <span className={`chevron${folded ? '' : ' open'}`} aria-hidden="true">
                  ›
                </span>
                <span className="grow">{group.act}</span>
                {folded && holdsActive && (
                  <span className="dot teal" title="You are working here" />
                )}
                <span className="tiny muted">{group.scenes.length}</span>
              </button>
            )}
            {!folded &&
              group.scenes.map((entry) => (
                <SceneButton
                  key={entry.item.number}
                  entry={entry}
                  footage={footage[entry.index]}
                  active={entry.index === activeIndex}
                  onChoose={onChoose}
                />
              ))}
          </div>
        );
      })}
      {scenes.length === 0 && (
        <p className="small muted" style={{ margin: '6px' }}>
          Start your first scene with a line like <span className="bold">INT. KITCHEN - DAY</span>.
        </p>
      )}
      {scenes.length > 0 && groups.length === 0 && (
        <p className="small muted" style={{ margin: '6px' }}>
          No scenes match &ldquo;{query.trim()}&rdquo;.
        </p>
      )}
      <p className="tiny muted" style={{ margin: '10px 6px 0' }}>
        Scenes follow your script. Type a new INT. or EXT. line and a scene appears here. Start a
        line with <span className="bold"># </span>
        (for example <span className="bold"># Act One</span>) to group scenes.
      </p>
    </aside>
  );
}
