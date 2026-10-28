import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { Analysis } from '@tapestry/script';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { buildDecorations, decorationField, setDecorations } from './editor-decorations';

/** What the Write section can ask the editor to do. */
export interface ScriptEditorHandle {
  /**
   * Moves the cursor to a position and scrolls it into view.
   * @param offset Character offset in the text.
   */
  focusAt(offset: number): void;
  /**
   * Screen position of a character, for placing cards next to it.
   * @param offset Character offset in the text.
   * @returns Viewport coordinates, or `null` when the position is not rendered.
   */
  coordsAt(offset: number): { left: number; top: number; bottom: number } | null;
}

/** Properties of {@link ScriptEditor}. */
interface ScriptEditorProps {
  /** Text shown when the editor is created; afterwards the editor owns the text. */
  initialText: string;
  /** Analysis of the current text; drives the styling and the underlines. */
  analysis: Analysis;
  /** Called with the complete text after every edit. */
  onChange(text: string): void;
  /** Called with the cursor position after every move or edit. */
  onCursor(offset: number): void;
  /** Called for the add-to-cast shortcut (Ctrl or Command with Enter). */
  onAddShortcut(): void;
}

/**
 * The screenplay editor: a CodeMirror view styled like a script, with underlines for known and unknown names.
 */
export const ScriptEditor = forwardRef<ScriptEditorHandle, ScriptEditorProps>(function ScriptEditor(
  { initialText, analysis, onChange, onCursor, onAddShortcut },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onCursor, onAddShortcut });
  callbacks.current = { onChange, onCursor, onAddShortcut };

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

  useImperativeHandle(ref, () => ({
    focusAt(offset) {
      const editor = view.current;
      if (!editor) return;
      const at = Math.min(offset, editor.state.doc.length);
      editor.dispatch({ selection: { anchor: at }, scrollIntoView: true });
      editor.focus();
    },
    coordsAt(offset) {
      const coords = view.current?.coordsAtPos(offset);
      return coords ? { left: coords.left, top: coords.top, bottom: coords.bottom } : null;
    },
  }));

  return <div className="script-editor" ref={host} />;
});
