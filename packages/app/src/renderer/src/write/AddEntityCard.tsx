import type { EntityKind } from '@tapestry/core';
import { useState } from 'react';
import { KIND_LABEL, displayName } from './format';

/** Properties of {@link AddEntityCard}. */
interface AddEntityCardProps {
  /** The name as written in the screenplay. */
  name: string;
  /** What the name probably is. */
  suggestedKind: EntityKind;
  /** Position inside the scrolling column; `above` puts the card over the anchor instead of under it. */
  position: { left: number; top: number; above: boolean };
  /** Label of the shortcut that adds without typing a description, for example "Ctrl+Enter". */
  shortcut: string;
  /**
   * Adds the entity.
   * @param kind What the user says it is.
   * @param name The cleaned-up name.
   * @param description A few words about it, possibly empty.
   */
  onAdd(kind: EntityKind, name: string, description: string): void;
  /** Hides the card for this name until the app is restarted. */
  onDismiss(): void;
}

/** The kinds a name in a screenplay can be added as. */
const FILM_KINDS: EntityKind[] = ['character', 'location', 'prop'];

/**
 * A small card next to an unknown name: add it to the cast right where you are writing. The suggested kind can be
 * changed, since a capitalised word may be a person, a place or a thing.
 */
export function AddEntityCard({
  name,
  suggestedKind,
  position,
  shortcut,
  onAdd,
  onDismiss,
}: AddEntityCardProps) {
  const [kind, setKind] = useState(suggestedKind);
  const [description, setDescription] = useState('');
  const nice = displayName(name, kind === 'character');

  return (
    <div
      className="add-card"
      style={{
        left: position.left,
        top: position.top,
        transform: position.above ? 'translateY(-100%)' : undefined,
      }}
      role="dialog"
      aria-label={`Add ${nice}`}
    >
      <span className="label">New name</span>
      <div className="h3">{nice} isn&apos;t in your project yet</div>
      <label className="small bold" htmlFor="add-kind">
        This is a
      </label>
      <select
        id="add-kind"
        className="field"
        value={kind}
        onChange={(event) => setKind(event.target.value as EntityKind)}
      >
        {FILM_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <label className="small bold" htmlFor="add-description">
        A few words about {nice} <span className="muted">(optional)</span>
      </label>
      <input
        id="add-description"
        className="field"
        value={description}
        placeholder={
          kind === 'character' ? 'Harbor master’s daughter, about twelve' : 'What it looks like'
        }
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onAdd(kind, nice, description);
          if (event.key === 'Escape') onDismiss();
        }}
      />
      <div className="row" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="btn primary sm"
          onClick={() => onAdd(kind, nice, description)}
        >
          Add {nice}
        </button>
        <button type="button" className="btn quiet sm" onClick={onDismiss}>
          Not now
        </button>
      </div>
      <div className="tiny muted">
        Or press <span className="kbd">{shortcut}</span> while writing to add without a description.
      </div>
    </div>
  );
}
