import { analyze } from '@tapestry/script';
import { expect, test } from 'vitest';
import { insertMenuItems } from './insert-menu';
import type { Insertion } from './insertions';
import { sceneItems } from './scenes';
import { shotViews } from './shots-view';

/** One scene with action, a spoken line and a direction under the action. */
const SCRIPT = [
  'INT. CABIN - DAY',
  '',
  'A stove ticks.',
  '[[direction: slow push in]]',
  '',
  'MARIA',
  'Is anyone there?',
  '',
].join('\n');

/** The menu for a cursor at `pos`, plus a list that collects what was inserted. */
function menuAt(pos: number) {
  const analysis = analyze('fountain', SCRIPT, []);
  const parsed = analysis.fountain?.scenes ?? [];
  const context = {
    text: SCRIPT,
    analysis,
    scenes: sceneItems(analysis),
    shotsByScene: parsed.map((scene) => shotViews(scene, undefined, [], [])),
  };
  const inserted: Insertion[] = [];
  return { items: insertMenuItems(context, pos, (i) => inserted.push(i)), inserted };
}

test('the menu offers every kind of line', () => {
  expect(menuAt(0).items.map((i) => i.label)).toEqual([
    'Scene',
    'Act, at the end',
    'Dialogue line',
    'Parenthetical (how a line is said)',
    'Action',
    'Transition (CUT TO:)',
    'Direction for this shot',
    'Private note',
  ]);
});

test('a parenthetical is only possible in a spoken line, and goes under the cue', () => {
  const action = menuAt(SCRIPT.indexOf('A stove'));
  expect(action.items.find((i) => i.label.startsWith('Parenthetical'))?.disabled).toBe(true);

  const spoken = menuAt(SCRIPT.indexOf('Is anyone'));
  const item = spoken.items.find((i) => i.label.startsWith('Parenthetical'));
  expect(item?.disabled).toBe(false);
  item?.onSelect();
  expect(spoken.inserted[0]?.offset).toBe(SCRIPT.indexOf('MARIA') + 'MARIA'.length);
});

test('a direction is offered only for a shot that has none', () => {
  const direction = (pos: number) =>
    menuAt(pos).items.find((i) => i.label.startsWith('Direction'))?.disabled;
  expect(direction(SCRIPT.indexOf('A stove'))).toBe(true);
  expect(direction(SCRIPT.indexOf('Is anyone'))).toBe(false);
});

test('new lines go after the direction written under the shot', () => {
  const { items, inserted } = menuAt(SCRIPT.indexOf('A stove'));
  items.find((i) => i.label === 'Action')?.onSelect();
  expect(inserted[0]?.offset).toBe(SCRIPT.indexOf('\n', SCRIPT.indexOf('[[direction')));
});
