import { extractNotes } from './notes';
import type { Range } from './types';

/** Options for {@link exportScreenplay}. */
export interface ExportOptions {
  /** Keep `[[direction: ...]]` notes (for a copy to share with the film crew). Default: leave them out. */
  keepDirections?: boolean;
}

/**
 * The screenplay as a clean script for printing or sharing: private notes, direction notes and boneyard are removed,
 * and the gaps they leave are closed. The result is still valid Fountain.
 * @param source The screenplay text as written in the editor.
 * @param options Whether to keep direction notes.
 */
export function exportScreenplay(source: string, options: ExportOptions = {}): string {
  const removals: Range[] = [...source.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
  for (const note of extractNotes(source)) {
    if (!(options.keepDirections && note.direction)) removals.push(note.range);
  }
  let text = source;
  for (const { start, end } of removals.sort((a, b) => b.start - a.start)) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const newline = text.indexOf('\n', end);
    const lineEnd = newline < 0 ? text.length : newline;
    const alone =
      text.slice(lineStart, start).trim() === '' && text.slice(end, lineEnd).trim() === '';
    if (alone) {
      text = text.slice(0, lineStart) + text.slice(newline < 0 ? lineEnd : lineEnd + 1);
    } else {
      const before = text.slice(0, start);
      const after = text.slice(end);
      text = before + (before.endsWith(' ') && after.startsWith(' ') ? after.slice(1) : after);
    }
  }
  return text.replace(/(\r?\n){3,}/g, '\n\n').replace(/^\s+/, '');
}
