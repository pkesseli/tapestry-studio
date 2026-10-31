import type { NewEntityInput } from '@tapestry/core';
import type { StudioState } from '@tapestry/service';
import { useCallback, useEffect, useRef, useState } from 'react';

/** How long typing must pause before the screenplay is saved. */
const SAVE_DELAY_MS = 500;

/** Whether the latest text has reached the disk. */
export type SaveStatus = 'saved' | 'saving' | 'failed';

/** What the Write section works with. */
export interface Studio {
  /** Cast and derived scenes, as last confirmed by the project. */
  state: StudioState;
  /** The screenplay text, always current (it leads the saved copy by at most a moment). */
  text: string;
  saveStatus: SaveStatus;
  /** A problem to show the user, if the last action failed. */
  error: string | null;
  /**
   * Records an edit and schedules saving it.
   * @param next Complete new text.
   */
  edit(next: string): void;
  /**
   * Adds a character, place or prop; resolves when the cast has been updated.
   * @param input Kind, name and optional description.
   */
  addEntity(input: NewEntityInput): Promise<void>;
}

/**
 * Keeps the screenplay and the project state in step: edits show at once and are saved shortly after typing stops.
 * @param initial State loaded when the app started.
 */
export function useStudio(initial: StudioState): Studio {
  const [state, setState] = useState(initial);
  const [text, setText] = useState(initial.scriptText);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(initial.scriptText);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Takes the cast and scenes from a confirmed state; the text stays whatever the user has typed. */
  const adopt = useCallback((next: StudioState) => {
    setState((current) => ({
      ...current,
      entities: next.entities,
      scenes: next.scenes,
      clips: next.clips,
    }));
  }, []);

  const save = useCallback(async () => {
    timer.current = undefined;
    const sent = latest.current;
    try {
      adopt(await window.tapestry.saveScript(initial.scriptPath, sent));
      setSaveStatus(latest.current === sent ? 'saved' : 'saving');
    } catch (cause) {
      setSaveStatus('failed');
      setError(`Your changes could not be saved: ${(cause as Error).message}`);
    }
  }, [adopt, initial.scriptPath]);

  const edit = useCallback(
    (next: string) => {
      latest.current = next;
      setText(next);
      setSaveStatus('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    [save],
  );

  const addEntity = useCallback(
    async (input: NewEntityInput) => {
      try {
        setError(null);
        adopt(await window.tapestry.createEntity(input));
      } catch (cause) {
        setError((cause as Error).message);
      }
    },
    [adopt],
  );

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void window.tapestry.saveScript(initial.scriptPath, latest.current);
      }
    },
    [initial.scriptPath],
  );

  return { state, text, saveStatus, error, edit, addEntity };
}
