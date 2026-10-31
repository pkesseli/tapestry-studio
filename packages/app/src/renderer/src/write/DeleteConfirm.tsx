import { ConfirmDialog } from '../ConfirmDialog';
import { describeImpact } from './deletions';
import type { Impact } from './deletions';

/** A deletion waiting for the user's answer. */
export interface PendingDelete {
  title: string;
  impact: Impact;
  /** Extra sentence, for example what stays. */
  extra: string;
}

/**
 * Asks before scenes or acts are removed from the script, saying what goes with them.
 * @param props.pending What is about to be deleted.
 * @param props.undoKeys Name of the undo shortcut, for example "Ctrl+Z".
 * @param props.onConfirm Called to go ahead.
 * @param props.onCancel Called to keep everything.
 */
export function DeleteConfirm({
  pending,
  undoKeys,
  onConfirm,
  onCancel,
}: {
  pending: PendingDelete;
  undoKeys: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const { impact } = pending;
  return (
    <ConfirmDialog
      title={pending.title}
      confirmLabel="Delete"
      danger
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p style={{ margin: 0 }}>
        This removes {describeImpact(impact)} from the script.
        {pending.extra && ` ${pending.extra}`}
      </p>
      {impact.clips > 0 && (
        <p style={{ margin: 0 }}>
          The video files stay in your project folder; they just won&rsquo;t belong to a shot any
          more.
        </p>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        You can undo this with {undoKeys} in the script.
      </p>
    </ConfirmDialog>
  );
}
