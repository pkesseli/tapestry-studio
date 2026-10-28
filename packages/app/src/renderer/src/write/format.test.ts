import { expect, test } from 'vitest';
import { displayName, modifierLabel, sceneTitle } from './format';

test('ALL CAPS names become readable, mixed case is kept', () => {
  expect(displayName('NORA')).toBe('Nora');
  expect(displayName('OLD MAN')).toBe('Old Man');
  expect(displayName('JEAN-LUC')).toBe('Jean-Luc');
  expect(displayName('McCLANE')).toBe('McCLANE');
  expect(displayName('Maria')).toBe('Maria');
  expect(displayName('FERRY DECK', false)).toBe('Ferry deck');
});

test('scene titles combine place and time', () => {
  expect(sceneTitle('INT. HARBOR - NIGHT', 'HARBOR', 'NIGHT')).toBe('Harbor, night');
  expect(sceneTitle('EXT. FOREST - DAY - LATER', 'FOREST', 'DAY - LATER')).toBe(
    'Forest, day, later',
  );
  expect(sceneTitle('EXT. PIER', 'PIER', undefined)).toBe('Pier');
  expect(sceneTitle('INT. #4#', '', undefined)).toBe('INT.');
});

test('shortcut modifier follows the platform', () => {
  expect(modifierLabel('darwin')).toBe('⌘');
  expect(modifierLabel('win32')).toBe('Ctrl');
});
