import { RangeSet, StateEffect, StateField } from '@codemirror/state';
import { GutterMarker, gutter } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { ShotState } from './shots-view';

/** What a margin marker shows. */
export interface ShotMarkerData {
  /** Position of the shot in its scene, starting at 1. */
  number: number;
  state: ShotState;
  /** True for the shot the cursor is in. */
  active: boolean;
}

/** A small numbered tab in the margin, next to the first line of a shot. */
class ShotMarker extends GutterMarker {
  /** @param data What to show. */
  constructor(readonly data: ShotMarkerData) {
    super();
  }

  /** @inheritdoc */
  override eq(other: GutterMarker): boolean {
    return (
      other instanceof ShotMarker &&
      other.data.number === this.data.number &&
      other.data.state === this.data.state &&
      other.data.active === this.data.active
    );
  }

  /** @inheritdoc */
  override toDOM(): HTMLElement {
    const { number, state, active } = this.data;
    const mark = document.createElement('span');
    mark.className = `shot-mark ${state}${active ? ' active' : ''}`;
    mark.textContent = state === 'accepted' ? `${number} ✓` : String(number);
    mark.title = `Shot ${number}`;
    return mark;
  }
}

/** Replaces all margin markers. */
export const setShotMarkers = StateEffect.define<RangeSet<GutterMarker>>();

/**
 * Builds markers for shots.
 * @param shots Where each shot's first line starts (document offset of the line) and what to show.
 */
export function buildShotMarkers(
  shots: readonly { from: number; data: ShotMarkerData }[],
): RangeSet<GutterMarker> {
  return RangeSet.of(
    shots.map(({ from, data }) => new ShotMarker(data).range(from)),
    true,
  );
}

/** Holds the markers; between updates they move along with edits. */
const markerField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) if (effect.is(setShotMarkers)) next = effect.value;
    return next;
  },
});

/**
 * The margin that shows one numbered tab per shot. Clicking a tab reports the line it sits on.
 * @param onClick Called with the document offset of the clicked line's start.
 */
export function shotGutter(onClick: (lineStart: number) => void): Extension {
  return [
    markerField,
    gutter({
      class: 'cm-shot-gutter',
      markers: (view) => view.state.field(markerField),
      domEventHandlers: {
        mousedown(_view, line) {
          onClick(line.from);
          return true;
        },
      },
    }),
  ];
}
