import { expect, test } from 'vitest';
import {
  newActAtSceneInsertion,
  newActInsertion,
  newDirectionInsertion,
  newLineInsertion,
  newNoteInsertion,
  newParentheticalInsertion,
  newSceneInsertion,
  newTransitionInsertion,
  nextActName,
  removalRange,
} from './insertions';

/** Applies an insertion and returns the text and the selected part. */
function apply(
  text: string,
  insertion: { offset: number; text: string; select: { from: number; to: number } },
) {
  const result = text.slice(0, insertion.offset) + insertion.text + text.slice(insertion.offset);
  return {
    result,
    selected: result.slice(
      insertion.offset + insertion.select.from,
      insertion.offset + insertion.select.to,
    ),
  };
}

test('act names read like a person would write them', () => {
  expect([0, 1, 2, 11, 12].map(nextActName)).toEqual([
    'Act One',
    'Act Two',
    'Act Three',
    'Act Twelve',
    'Act 13',
  ]);
});

test('a new act goes at the end with a first scene, after a blank line, with its name selected', () => {
  const text = 'INT. A - DAY\n\nHello.\n';
  const { result, selected } = apply(text, newActInsertion(text, 1));
  expect(result).toBe('INT. A - DAY\n\nHello.\n\n# Act Two\n\nINT. LOCATION - DAY\n');
  expect(selected).toBe('Act Two');
  const bare = apply('Hello.', newActInsertion('Hello.', 0));
  expect(bare.result).toBe('Hello.\n\n# Act One\n\nINT. LOCATION - DAY\n');
  expect(apply('', newActInsertion('', 0)).result).toBe('# Act One\n\nINT. LOCATION - DAY\n');
});

test('a new scene goes after the given offset in its own paragraph with LOCATION selected', () => {
  const text = 'INT. A - DAY\n\nHello.\n\n# Act Two\n\nINT. B - DAY\n';
  const offset = text.indexOf('\n\n# Act Two');
  const { result, selected } = apply(text, newSceneInsertion(text, offset));
  expect(result).toContain('Hello.\n\nINT. LOCATION - DAY\n\n\n# Act Two');
  expect(selected).toBe('LOCATION');
});

test('a new action line starts its own paragraph and selects its placeholder', () => {
  const text = 'INT. A - DAY\n\nHe waits.\n';
  const { result, selected } = apply(text, newLineInsertion(text, text.length, 'action'));
  expect(result).toBe('INT. A - DAY\n\nHe waits.\n\nDescribe what happens.\n');
  expect(selected).toBe('Describe what happens.');
});

test('a new dialogue line is for the other person in the conversation', () => {
  const text = 'MARIA\nHi.\n\nNORA\nHello.\n';
  const added = apply(text, newLineInsertion(text, text.length, 'dialogue', ['MARIA', 'NORA']));
  expect(added.selected).toBe('MARIA');
  expect(added.result.endsWith('\n\nMARIA\nWhat they say.\n')).toBe(true);
  expect(apply('', newLineInsertion('', 0, 'dialogue', ['tom'])).selected).toBe('TOM');
  expect(apply('', newLineInsertion('', 0, 'dialogue')).selected).toBe('CHARACTER');
});

test('a parenthetical goes right under the cue with its words selected', () => {
  const text = 'MARIA\nHello.\n';
  const { result, selected } = apply(text, newParentheticalInsertion(5));
  expect(result).toBe('MARIA\n(how they say it)\nHello.\n');
  expect(selected).toBe('how they say it');
});

test('a transition gets its own paragraph, and notes and directions put the cursor inside the brackets', () => {
  const text = 'INT. A - DAY\n\nHello.\n';
  expect(apply(text, newTransitionInsertion(text, text.length)).result).toBe(
    'INT. A - DAY\n\nHello.\n\nCUT TO:\n',
  );
  const note = apply('Hello.', newNoteInsertion(6));
  expect(note.result).toBe('Hello.\n[[]]');
  const direction = newDirectionInsertion(6);
  expect(direction.text.slice(0, direction.select.from)).toBe('\n[[direction: ');
});

test('a new act at a scene is written in front of it with its name selected', () => {
  const text = 'INT. A - DAY\n\nOne.\n\nINT. B - DAY\n';
  const offset = text.indexOf('INT. B');
  const { result, selected } = apply(text, newActAtSceneInsertion(offset, 1));
  expect(result).toContain('One.\n\n# Act Two\n\nINT. B - DAY');
  expect(selected).toBe('Act Two');
});

test('removing a line takes its line break and one blank line with it', () => {
  const text = 'A\n\n# Act Two\n\nINT. B - DAY\n';
  const start = text.indexOf('# Act Two');
  const { from, to } = removalRange(text, start, start + '# Act Two'.length);
  expect(text.slice(0, from) + text.slice(to)).toBe('A\n\nINT. B - DAY\n');
  expect(removalRange('X', 0, 1)).toEqual({ from: 0, to: 1 });
});
