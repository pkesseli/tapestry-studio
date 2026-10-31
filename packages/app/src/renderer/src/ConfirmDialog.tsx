import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/** Properties of {@link ConfirmDialog}. */
interface ConfirmDialogProps {
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  confirmLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * Asks before something that removes work. Cancel has the focus when it opens, so pressing Enter by reflex never
 * deletes anything; Escape or a click outside also cancels.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="modal-backdrop" onPointerDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === 'Escape' && onCancel()}
      >
        <h2 className="h2" id="confirm-title">
          {title}
        </h2>
        <div className="col" style={{ gap: 8 }}>
          {children}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn" ref={cancel} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'danger-solid' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
