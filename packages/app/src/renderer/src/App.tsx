import type { StudioState } from '@tapestry/service';
import { useEffect, useState } from 'react';
import { PracticeBand, TopBar } from './TopBar';
import { WriteSection } from './write/WriteSection';

/** Root component: loads the open project, then shows the shell with the Write section. */
export function App() {
  const [state, setState] = useState<StudioState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    window.tapestry.getState().then(setState, (cause: Error) => setProblem(cause.message));
  }, []);

  return (
    <div className="app">
      <PracticeBand />
      <TopBar projectName={state?.projectName ?? ''} />
      {state ? (
        <WriteSection initial={state} />
      ) : (
        <main className="main">
          {problem ? (
            <div className="notice">Could not open the project: {problem}</div>
          ) : (
            <p className="muted">Opening your project…</p>
          )}
        </main>
      )}
    </div>
  );
}
