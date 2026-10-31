import { expect, test } from 'vitest';
import { directionNote, extractNotes } from './notes';

test('finds notes, telling directions from private notes', () => {
  const text = 'A [[direction: slow push-in]] b [[remember this]]\n[[dir: low angle]]';
  expect(extractNotes(text).map((n) => [n.text, n.direction])).toEqual([
    ['slow push-in', true],
    ['remember this', false],
    ['low angle', true],
  ]);
});

test('ranges cover the whole note including brackets', () => {
  const text = 'x [[direction: a]] y';
  const [note] = extractNotes(text);
  expect(text.slice(note!.range.start, note!.range.end)).toBe('[[direction: a]]');
});

test('notes spanning lines are found, and notes inside boneyard are ignored', () => {
  expect(extractNotes('[[direction: one\ntwo]]')[0]?.text).toBe('one\ntwo');
  expect(extractNotes('/* [[direction: hidden]] */ [[ok]]').map((n) => n.text)).toEqual(['ok']);
});

test('the helper writes a note that reads back as a direction', () => {
  const [note] = extractNotes(directionNote('thick fog'));
  expect(note).toMatchObject({ text: 'thick fog', direction: true });
});
