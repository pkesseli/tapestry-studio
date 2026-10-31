import { useRef, useState } from 'react';
import { mediaUrl } from '../../../shared/media-url';
import type { ShotState, ShotView } from './shots-view';

/** Properties of {@link ShotPanel}. */
interface ShotPanelProps {
  /** The shots of the scene being edited, in order; at least one. */
  shots: readonly ShotView[];
  /** The shot the cursor is in. */
  activeIndex: number;
  /**
   * Called to make another shot the active one; the editor moves its cursor to it.
   * @param index Index into `shots`.
   */
  onSelect(index: number): void;
  /**
   * Called to write a new direction note under a shot.
   * @param index Index into `shots`.
   */
  onAddDirection(index: number): void;
  /**
   * Called to jump to a shot's direction in the script.
   * @param index Index into `shots`.
   */
  onEditDirection(index: number): void;
  /**
   * Called to add a new line after the active shot.
   * @param kind A line of dialogue or a paragraph of action.
   */
  onAddLine(kind: 'dialogue' | 'action'): void;
}

/** How each state is worded for the user (doc/readme/ux.md). */
const STATE_LABEL: Record<ShotState, string> = {
  'not-made': 'Not made yet',
  'to-review': 'Ready to review',
  accepted: 'Accepted',
};

/**
 * The shot under the cursor, in context: its footage (or a clear "not made yet"), buttons to step to the previous and
 * next shot or play the whole scene, what the shot shows and who is in it, and its direction. A clip is never shown
 * alone, because a take can only be judged against its neighbours.
 */
export function ShotPanel({
  shots,
  activeIndex,
  onSelect,
  onAddDirection,
  onEditDirection,
  onAddLine,
}: ShotPanelProps) {
  const [continuous, setContinuous] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const position = Math.max(0, Math.min(activeIndex, shots.length - 1));
  const shot = shots[position] as ShotView;
  const firstMade = shots.findIndex((s) => s.clip);

  /** Moves to the next shot that has footage, or stops when there is none. */
  const playNext = () => {
    const next = shots.findIndex((s, i) => i > position && s.clip);
    if (continuous && next >= 0) onSelect(next);
    else setContinuous(false);
  };

  /** Starts playing the scene from its first shot with footage. */
  const playScene = () => {
    setContinuous(true);
    if (firstMade === position && video.current) {
      video.current.currentTime = 0;
      void video.current.play();
    } else if (firstMade >= 0) onSelect(firstMade);
  };

  return (
    <div className="col player shot-card" style={{ gap: 8 }}>
      <span className="label">Footage</span>
      <div className="frame" style={{ borderRadius: 10, background: '#101420' }}>
        {shot.clip ? (
          <video
            ref={video}
            key={shot.clip.artifactId}
            src={mediaUrl(shot.clip.path)}
            controls
            muted
            autoPlay={continuous}
            playsInline
            aria-label={`Shot ${shot.number}`}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onEnded={playNext}
          />
        ) : (
          <div
            className="frame empty"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="small bold muted">Not made yet</span>
          </div>
        )}
        {shot.clip?.sample && <span className="sample-tag">SAMPLE</span>}
      </div>

      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          className="btn sm"
          disabled={position === 0}
          onClick={() => onSelect(position - 1)}
          aria-label="Previous shot"
        >
          ‹ Previous
        </button>
        <span className="grow small" style={{ textAlign: 'center' }}>
          Shot {shot.number} of {shots.length} · {STATE_LABEL[shot.state]}
        </span>
        <button
          type="button"
          className="btn sm"
          disabled={position + 1 >= shots.length}
          onClick={() => onSelect(position + 1)}
          aria-label="Next shot"
        >
          Next ›
        </button>
      </div>

      <div className="row wrap" style={{ gap: 6 }}>
        {shots.map((s, i) => (
          <button
            key={s.number}
            type="button"
            className={`chip shot-pill${i === position ? ' teal' : ''}`}
            aria-pressed={i === position}
            onClick={() => onSelect(i)}
          >
            {s.number}
            {s.state === 'accepted' ? ' ✓' : ''}
          </button>
        ))}
        <span className="grow" />
        <button
          type="button"
          className="btn sm primary"
          disabled={firstMade < 0}
          onClick={playScene}
        >
          Play whole scene
        </button>
      </div>

      <blockquote className="shot-quote">{shot.action}</blockquote>
      {shot.people.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="tiny muted">In this shot</span>
          {shot.people.map((name) => (
            <span className="chip" key={name}>
              {name}
            </span>
          ))}
        </div>
      )}

      {shot.direction ? (
        <div className="direction-box">
          <span className="label" style={{ color: 'inherit' }}>
            Direction
          </span>
          <div>{shot.direction}</div>
          <button
            type="button"
            className="btn quiet sm"
            style={{ minHeight: 28, padding: 0 }}
            onClick={() => onEditDirection(position)}
          >
            Edit in the script
          </button>
        </div>
      ) : (
        <div className="col" style={{ gap: 4 }}>
          <button
            type="button"
            className="btn sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => onAddDirection(position)}
          >
            Add direction
          </button>
          <span className="tiny muted">
            Camera, mood, light. Sent along with the shot, left out when you export the script.
          </span>
        </div>
      )}

      <div className="col" style={{ gap: 4 }}>
        <button
          type="button"
          className="btn sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => onAddLine('dialogue')}
        >
          Add line
        </button>
        <span className="tiny muted">
          A line someone speaks. Other things (action, transition, note): right-click the script.
        </span>
      </div>

      {shot.state === 'not-made' && (
        <div className="tiny muted">
          Free in practice mode · about {Math.max(1, Math.round(shot.durationSeconds / 5))} minute
        </div>
      )}
    </div>
  );
}
