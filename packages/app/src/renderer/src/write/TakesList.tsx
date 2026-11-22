import type { ShotTake } from '@tapestry/service';
import type { ShotActions } from './useStudio';

/** How each take is described to the user (doc/readme/ux.md: never the internal state names). */
function stateWords(take: ShotTake): string {
  switch (take.state) {
    case 'draft':
      return 'Needs your approval';
    case 'approved':
    case 'queued':
      return 'Waiting';
    case 'running':
      return 'Making it…';
    case 'rendered':
      return 'Ready to review';
    case 'accepted':
    case 'enhanced':
      return 'Accepted';
    case 'redone':
      return 'Replaced by another take';
    case 'cancelled':
      return 'Stopped';
    case 'failed':
      return take.error ? `Something went wrong: ${take.error}` : 'Something went wrong';
  }
}

/** Properties of {@link TakesList}. */
interface TakesListProps {
  /** Id of the saved shot, if the script has been saved far enough to have one. */
  shotId: string | undefined;
  /** Every attempt at the shot, oldest first. */
  takes: readonly ShotTake[];
  actions: ShotActions;
}

/**
 * The attempts at one shot: a draft is the cheap preview of framing and movement; the final is the render that goes
 * into the film, made from an accepted draft with the same seed. Each take says where it stands and offers what can be
 * done with it next: accept it, try again, or (for an accepted draft) make the final.
 */
export function TakesList({ shotId, takes, actions }: TakesListProps) {
  const live = takes.filter((take) => take.state !== 'redone');
  const hasAcceptedDraft = live.some((take) => take.quality === 'draft' && take.accepted);
  const finalFollowing = (draft: ShotTake) =>
    live.some((take) => take.sourceJobId === draft.jobId && take.state !== 'failed');
  return (
    <div className="col takes" style={{ gap: 6 }}>
      <span className="label">Takes</span>
      {live.length === 0 && (
        <span className="tiny muted">
          Nothing made yet. A draft is a quick, cheap preview of framing and movement.
        </span>
      )}
      {live.map((take) => (
        <div className="take" key={take.jobId} data-state={take.state}>
          <div className="row" style={{ gap: 6 }}>
            <span className={`chip ${take.quality === 'final' ? 'teal' : ''}`}>
              {take.quality === 'final' ? 'Final' : 'Draft'}
            </span>
            <span className="small grow">{stateWords(take)}</span>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {take.state === 'rendered' && (
              <>
                <button type="button" className="btn sm" onClick={() => actions.accept(take.jobId)}>
                  Accept
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => actions.another(take.jobId)}
                >
                  Try again
                </button>
              </>
            )}
            {take.accepted && take.quality === 'draft' && !finalFollowing(take) && (
              <button
                type="button"
                className="btn sm primary"
                onClick={() => actions.makeFinal(take.jobId)}
              >
                Make the final
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="row wrap" style={{ gap: 6 }}>
        <button
          type="button"
          className="btn sm"
          disabled={shotId === undefined}
          onClick={() => shotId && actions.make(shotId)}
        >
          {live.length === 0 ? 'Make a draft' : 'Make another draft'}
        </button>
        {!hasAcceptedDraft && live.length > 0 && (
          <span className="tiny muted">Accept a draft to make its final.</span>
        )}
      </div>
    </div>
  );
}
