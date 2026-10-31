import { StateEffect, StateField } from '@codemirror/state';
import type { Text } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import type { Analysis } from '@tapestry/script';

/** Style class of a whole line, by screenplay element type. Plain action lines need none. */
const LINE_CLASS: Partial<Record<string, string>> = {
  'scene-heading': 'sp-heading',
  character: 'sp-cue',
  dialogue: 'sp-dialogue',
  parenthetical: 'sp-paren',
  transition: 'sp-transition',
  'title-page': 'sp-title',
  section: 'sp-section',
  synopsis: 'sp-synopsis',
};

/** Mark class by how well a name is known. */
const MENTION_CLASS = { resolved: 'm-ok', unresolved: 'm-new', ambiguous: 'm-amb' } as const;

/** Replaces all decorations with the ones computed from a fresh analysis. */
export const setDecorations = StateEffect.define<DecorationSet>();

/**
 * Holds the decorations. Between analyses they are moved along with edits, so marks follow the text while typing.
 */
export const decorationField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) if (effect.is(setDecorations)) next = effect.value;
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * Computes line styles for screenplay elements and underlines for names.
 * @param analysis Result of analysing the current text.
 * @param doc The editor document the offsets refer to; offsets beyond it are ignored.
 */
export function buildDecorations(analysis: Analysis, doc: Text): DecorationSet {
  const ranges = [];
  for (const element of analysis.fountain?.elements ?? []) {
    const cls = LINE_CLASS[element.type];
    if (!cls || element.range.start > doc.length) continue;
    const first = doc.lineAt(element.range.start).number;
    const last = doc.lineAt(Math.min(element.range.end, doc.length)).number;
    for (let n = first; n <= last; n++) {
      ranges.push(Decoration.line({ class: cls }).range(doc.line(n).from));
    }
  }
  for (const mention of analysis.mentions) {
    if (mention.range.end > doc.length || mention.range.start >= mention.range.end) continue;
    ranges.push(
      Decoration.mark({
        class: MENTION_CLASS[mention.status],
        attributes: { 'data-kind': mention.kind, 'data-status': mention.status },
      }).range(mention.range.start, mention.range.end),
    );
  }
  return Decoration.set(ranges, true);
}
