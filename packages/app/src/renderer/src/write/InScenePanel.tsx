import type { EntityKind } from '@tapestry/core';
import { KIND_LABEL, displayName } from './format';
import { ShotPanel } from './ShotPanel';
import type { ShotView } from './shots-view';
import type { PresentEntity, SceneContents, SceneItem } from './scenes';

/** Properties of {@link InScenePanel}. */
interface InScenePanelProps {
  scene: SceneItem | undefined;
  contents: SceneContents;
  /** The shots of the scene, in order (empty when the scene has no text yet). */
  shots: readonly ShotView[];
  /** The shot the cursor is in. */
  activeShot: number;
  /**
   * Makes another shot active (the editor moves its cursor to it).
   * @param index Index into `shots`.
   */
  onSelectShot(index: number): void;
  /**
   * Writes a direction note under a shot.
   * @param index Index into `shots`.
   */
  onAddDirection(index: number): void;
  /**
   * Jumps to a shot's direction in the script.
   * @param index Index into `shots`.
   */
  onEditDirection(index: number): void;
  /**
   * Adds a line after the active shot.
   * @param kind Dialogue or action.
   */
  onAddLine(kind: 'dialogue' | 'action'): void;
  /**
   * Adds a name to the cast without further questions.
   * @param kind What the name is.
   * @param name The name as written in the script.
   */
  onAdd(kind: EntityKind, name: string): void;
}

/**
 * One group of known entities.
 * @param title Group heading.
 * @param items Entities in the group.
 */
function Group({ title, items }: { title: string; items: PresentEntity[] }) {
  if (items.length === 0) return null;
  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="label">{title}</span>
      {items.map(({ entity, mentions }) => (
        <div className="entity-row" key={entity.id}>
          <span className={`monogram ${entity.kind}`} aria-hidden="true">
            {entity.name.charAt(0).toUpperCase()}
          </span>
          <div className="grow">
            <div className="bold">{entity.name}</div>
            <div className="tiny muted">
              {KIND_LABEL[entity.kind]} · no look yet · mentioned {mentions}×
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The right-hand panel: who and what is in the scene the cursor is in, and names that still need adding. */
export function InScenePanel({
  scene,
  contents,
  shots,
  activeShot,
  onSelectShot,
  onAddDirection,
  onEditDirection,
  onAddLine,
  onAdd,
}: InScenePanelProps) {
  return (
    <aside className="aside" aria-label="In this scene">
      <div className="col" style={{ gap: 4 }}>
        <span className="label">{scene ? `In scene ${scene.number}` : 'In this scene'}</span>
        <h2 className="h2">{scene ? scene.title : 'Nothing yet'}</h2>
      </div>

      {shots.length > 0 && (
        <ShotPanel
          key={scene?.number}
          shots={shots}
          activeIndex={activeShot}
          onSelect={onSelectShot}
          onAddDirection={onAddDirection}
          onEditDirection={onEditDirection}
          onAddLine={onAddLine}
        />
      )}

      <Group title="Cast" items={contents.cast} />
      <Group title="Places" items={contents.places} />
      <Group title="Things" items={contents.things} />

      {contents.missing.length > 0 && (
        <div className="col" style={{ gap: 8 }} data-testid="missing">
          <span className="label">Not added yet</span>
          {contents.missing.map((item) => (
            <div className="entity-row" key={`${item.kind}:${item.name}`}>
              <span className={`monogram ${item.kind}`} aria-hidden="true">
                ?
              </span>
              <div className="grow">
                <div className="bold">{displayName(item.name, item.kind === 'character')}</div>
                <div className="tiny muted">
                  Looks like a {KIND_LABEL[item.kind].toLowerCase()} · mentioned {item.count}×
                </div>
              </div>
              <button
                type="button"
                className="btn sm"
                aria-label={`Add ${displayName(item.name, item.kind === 'character')}`}
                onClick={() => onAdd(item.kind, displayName(item.name, item.kind === 'character'))}
              >
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {contents.cast.length +
        contents.places.length +
        contents.things.length +
        contents.missing.length ===
        0 && (
        <p className="small muted" style={{ margin: 0 }}>
          Characters, places and props you write about will show up here.
        </p>
      )}
    </aside>
  );
}
