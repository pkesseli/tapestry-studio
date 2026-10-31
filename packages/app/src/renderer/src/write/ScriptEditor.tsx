import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { Analysis } from '@tapestry/script';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { buildDecorations, decorationField, setDecorations } from './editor-decorations';
import type { Insertion } from './insertions';
import { buildShotMarkers, setShotMarkers, shotGutter } from './shot-gutter';
import type { ShotMarkerData } from './shot-gutter';

/** What the Write section can ask the editor to do. */
export interface ScriptEditorHandle {
  /**
   * Moves the cursor to a position and scrolls it into view.
   * @param offset Character offset in the text.
   * @param focus Whether the editor should also take the keyboard focus (default true).
   */
  focusAt(offset: number, focus?: boolean): void;
  /**
   * Screen position of a character, for placing cards next to it.
   * @param offset Character offset in the text.
   * @returns Viewport coordinates, or `null` when the position is not rendered.
   */
  coordsAt(offset: number): { left: number; top: number; bottom: number } | null;
  /**
   * The text position under a point on screen.
   * @param x Viewport x.
   * @param y Viewport y.
   * @returns A character offset, or `null` when the point is not over the text.
   */
  posAtCoords(x: number, y: number): number | null;
  /**
   * Deletes a stretch of text. This is a normal edit, so it can be undone with Ctrl or Command and Z.
   * @param from Start offset.
   * @param to End offset.
   */
  deleteRange(from: number, to: number): void;
  /**
   * Inserts text and selects a part of it, so the user can type over a placeholder.
   * @param insertion What to insert and where.
   */
  insertAt(insertion: Insertion): void;
}

/** A margin marker to show next to a shot. */
export interface ShotMarkInput {
  /** Offset where the shot's text starts; the marker goes on that line. */
  start: number;
  data: ShotMarkerData;
}

/** Properties of {@link ScriptEditor}. */
interface ScriptEditorProps {
  /** Text shown when the editor is created; afterwards the editor owns the text. */
  initialText: string;
  /** Analysis of the current text; drives the styling and the underlines. */
  analysis: Analysis;
  /** Margin markers, one per shot. */
  shots: readonly ShotMarkInput[];
  /** Called with the complete text after every edit. */
  onChange(text: string): void;
  /** Called with the cursor position after every move or edit. */
  onCursor(offset: number): void;
  /** Called for the add-to-cast shortcut (Ctrl or Command with Enter). */
  onAddShortcut(): void;
  /**
   * Called when a margin marker is clicked.
   * @param lineStart Document offset of the start of the clicked line.
   */
  onShotClick(lineStart: number): void;
}

/**
 * The screenplay editor: a CodeMirror view styled like a script, with underlines for known and unknown names, styled
 * notes, and a margin with one numbered tab per shot.
 */
export const ScriptEditor = forwardRef<ScriptEditorHandle, ScriptEditorProps>(function ScriptEditor(
  { initialText, analysis, shots, onChange, onCursor, onAddShortcut, onShotClick },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onCursor, onAddShortcut, onShotClick });
  callbacks.current = { onChange, onCursor, onAddShortcut, onShotClick };

  useEffect(() => {
    if (!host.current) return undefined;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          history(),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                callbacks.current.onAddShortcut();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Screenplay', spellcheck: 'true' }),
          decorationField,
          shotGutter((lineStart) => callbacks.current.onShotClick(lineStart)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
            if (update.docChanged || update.selectionSet) {
              callbacks.current.onCursor(update.state.selection.main.head);
            }
          }),
        ],
      }),
    });
    view.current = editor;
    callbacks.current.onCursor(0);
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once; later text changes come from the user typing in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor)
      editor.dispatch({ effects: setDecorations.of(buildDecorations(analysis, editor.state.doc)) });
  }, [analysis]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const doc = editor.state.doc;
    const marks = shots
      .filter((shot) => shot.start <= doc.length)
      .map((shot) => ({ from: doc.lineAt(shot.start).from, data: shot.data }));
    editor.dispatch({ effects: setShotMarkers.of(buildShotMarkers(marks)) });
  }, [shots]);

  useImperativeHandle(ref, () => ({
    focusAt(offset, focus = true) {
      const editor = view.current;
      if (!editor) return;
      const at = Math.min(offset, editor.state.doc.length);
      editor.dispatch({ selection: { anchor: at }, scrollIntoView: true });
      if (focus) editor.focus();
    },
    coordsAt(offset) {
      const coords = view.current?.coordsAtPos(offset);
      return coords ? { left: coords.left, top: coords.top, bottom: coords.bottom } : null;
    },
    insertAt(insertion) {
      const editor = view.current;
      if (!editor) return;
      const at = Math.min(insertion.offset, editor.state.doc.length);
      editor.dispatch({
        changes: { from: at, insert: insertion.text },
        selection: { anchor: at + insertion.select.from, head: at + insertion.select.to },
        scrollIntoView: true,
      });
      editor.focus();
    },
    posAtCoords(x, y) {
      return view.current?.posAtCoords({ x, y }) ?? null;
    },
    deleteRange(from, to) {
      const editor = view.current;
      if (!editor) return;
      const end = Math.min(to, editor.state.doc.length);
      editor.dispatch({
        changes: { from, to: end },
        selection: { anchor: from },
        scrollIntoView: true,
      });
      editor.focus();
    },
  }));

  return <div className="script-editor" ref={host} />;
});
