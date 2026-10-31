import type { SceneClip } from '@tapestry/service';
import { mediaUrl } from '../../../shared/media-url';
import { footageSummary } from './footage';
import type { SceneFootage } from './footage';
import type { SceneItem } from './scenes';

/** Properties of {@link SceneList}. */
interface SceneListProps {
  scenes: readonly SceneItem[];
  /** Footage of each scene, in the same order as `scenes` (may be shorter while the text is being edited). */
  footage: readonly SceneFootage[];
  /** Index of the scene the cursor is in. */
  activeIndex: number;
  /** Called when a scene is chosen; the editor then jumps to it. */
  onChoose(scene: SceneItem): void;
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

/** The scenes of the screenplay, one button each. They follow the text: type a new INT. or EXT. line and one appears. */
export function SceneList({ scenes, footage, activeIndex, onChoose }: SceneListProps) {
  return (
    <aside className="side" aria-label="Scenes">
      <div className="row" style={{ padding: '4px 6px 8px' }}>
        <span className="label">Scenes</span>
      </div>
      {scenes.map((scene, index) => {
        const here = footage[index];
        return (
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
            {here && here.shots > 0 && <Filmstrip footage={here} />}
            <span className="small muted">{footageSummary(here)}</span>
            {here?.clips.some((clip) => clip.sample) && (
              <span className="chip amber sample-chip">Sample footage</span>
            )}
          </button>
        );
      })}
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
