import type { SceneItem } from './scenes';

/** Properties of {@link SceneList}. */
interface SceneListProps {
  scenes: readonly SceneItem[];
  /** Index of the scene the cursor is in. */
  activeIndex: number;
  /** Called when a scene is chosen; the editor then jumps to it. */
  onChoose(scene: SceneItem): void;
}

/** The scenes of the screenplay, one button each. They follow the text: type a new INT. or EXT. line and one appears. */
export function SceneList({ scenes, activeIndex, onChoose }: SceneListProps) {
  return (
    <aside className="side" aria-label="Scenes">
      <div className="row" style={{ padding: '4px 6px 8px' }}>
        <span className="label">Scenes</span>
      </div>
      {scenes.map((scene, index) => (
        <button
          key={scene.number}
          type="button"
          className={`scene${index === activeIndex ? ' on' : ''}`}
          aria-current={index === activeIndex ? 'true' : undefined}
          onClick={() => onChoose(scene)}
        >
          <span className="row">
            <span className="num">{scene.number}</span>
            <span className="bold">{scene.title}</span>
          </span>
          <span className="small muted">No shots yet</span>
        </button>
      ))}
      {scenes.length === 0 && (
        <p className="small muted" style={{ margin: '6px' }}>
          Start your first scene with a line like <span className="bold">INT. KITCHEN - DAY</span>.
        </p>
      )}
      <p className="tiny muted" style={{ margin: '10px 6px 0' }}>
        Scenes follow your script. Type a new INT. or EXT. line and a scene appears here.
      </p>
    </aside>
  );
}
