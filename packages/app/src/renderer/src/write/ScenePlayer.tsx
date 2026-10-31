import type { SceneClip } from '@tapestry/service';
import { useRef, useState } from 'react';
import { mediaUrl } from '../../../shared/media-url';

/** Properties of {@link ScenePlayer}. */
interface ScenePlayerProps {
  /** The scene's videos in shot order; at least one. */
  clips: readonly SceneClip[];
}

/**
 * Plays the footage of a scene in context: step to the previous or next shot, jump to any shot, or play the whole scene
 * shot after shot. A clip is never shown on its own, because a take can only be judged against its neighbours.
 */
export function ScenePlayer({ clips }: ScenePlayerProps) {
  const [index, setIndex] = useState(0);
  const [continuous, setContinuous] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const clip = clips[Math.min(index, clips.length - 1)] as SceneClip;
  const position = Math.min(index, clips.length - 1);

  /** Moves to another shot; the video element restarts because its source changes. */
  const go = (next: number, play: boolean) => {
    setIndex(next);
    setContinuous(play);
    if (next === position && video.current) {
      video.current.currentTime = 0;
      if (play) void video.current.play();
    }
  };

  return (
    <div className="col player" style={{ gap: 8 }}>
      <span className="label">Footage</span>
      <div className="frame" style={{ borderRadius: 10, background: '#101420' }}>
        <video
          ref={video}
          key={clip.artifactId}
          src={mediaUrl(clip.path)}
          controls
          muted
          autoPlay={continuous}
          playsInline
          aria-label={`Shot ${clip.shotNumber}`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onEnded={() => {
            if (continuous && position + 1 < clips.length) setIndex(position + 1);
            else setContinuous(false);
          }}
        />
        {clip.sample && <span className="sample-tag">SAMPLE</span>}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          className="btn sm"
          disabled={position === 0}
          onClick={() => go(position - 1, false)}
          aria-label="Previous shot"
        >
          ‹ Previous
        </button>
        <span className="grow small" style={{ textAlign: 'center' }}>
          Shot {clip.shotNumber} of {clips.length} ·{' '}
          {clip.accepted ? 'Accepted' : 'Ready to review'}
        </span>
        <button
          type="button"
          className="btn sm"
          disabled={position + 1 >= clips.length}
          onClick={() => go(position + 1, false)}
          aria-label="Next shot"
        >
          Next ›
        </button>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {clips.map((c, i) => (
          <button
            key={c.shotId}
            type="button"
            className={`chip shot-pill${i === position ? ' teal' : ''}`}
            aria-pressed={i === position}
            onClick={() => go(i, false)}
          >
            {c.shotNumber}
            {c.accepted ? ' ✓' : ''}
          </button>
        ))}
        <span className="grow" />
        <button type="button" className="btn sm primary" onClick={() => go(0, true)}>
          Play whole scene
        </button>
      </div>
    </div>
  );
}
