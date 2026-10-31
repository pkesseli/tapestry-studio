/** Text to insert into the script, where, and which part of it to select afterwards so the user can type over it. */
export interface Insertion {
  /** Document offset to insert at. */
  offset: number;
  text: string;
  /** Part of `text` to select afterwards (offsets inside `text`). */
  select: { from: number; to: number };
}

/** Words for the first acts, so the new act is called "Act Three" like a person would write it. */
const NUMBER_WORDS = [
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];

/**
 * The name of the next act, for example "Act Three".
 * @param existing How many acts the script has.
 */
export function nextActName(existing: number): string {
  const n = existing + 1;
  return `Act ${NUMBER_WORDS[n - 1] ?? n}`;
}

/**
 * The blank line needed in front of text added after existing text, so it starts its own paragraph.
 * @param before Text that ends where the insertion goes.
 */
function paragraphBreak(before: string): string {
  if (before === '' || before.endsWith('\n\n')) return '';
  return before.endsWith('\n') ? '\n' : '\n\n';
}

/**
 * A new act with a first scene, added at the end of the script (an act with no scene would not show in the scene list).
 * The act's name is selected so it can be typed over.
 * @param text The whole screenplay.
 * @param actCount How many acts it already has.
 */
export function newActInsertion(text: string, actCount: number): Insertion {
  const name = nextActName(actCount);
  const lead = paragraphBreak(text);
  const start = lead.length + 2;
  return {
    offset: text.length,
    text: `${lead}# ${name}\n\nINT. LOCATION - DAY\n`,
    select: { from: start, to: start + name.length },
  };
}

/**
 * A new scene heading after the scene being worked on, inside the same act. "LOCATION" is selected so the place can be
 * typed over.
 * @param text The whole screenplay.
 * @param offset Where the active scene's text ends (before any act line that follows it).
 */
export function newSceneInsertion(text: string, offset: number): Insertion {
  const lead = paragraphBreak(text.slice(0, offset));
  const heading = 'INT. LOCATION - DAY';
  const start = lead.length + heading.indexOf('LOCATION');
  return {
    offset,
    text: `${lead}${heading}\n`,
    select: { from: start, to: start + 'LOCATION'.length },
  };
}

/**
 * A new line after a shot: either a line of dialogue or a paragraph of action.
 * For dialogue the speaker is guessed to be the other person in the conversation (the most recent speaker who is not the
 * latest one); the guess is selected so it can be typed over, and the words follow on the next line.
 * @param text The whole screenplay.
 * @param offset Where new text after the shot goes (past its direction notes).
 * @param kind What to add.
 * @param speakers Speakers of the scene so far, oldest first.
 */
export function newLineInsertion(
  text: string,
  offset: number,
  kind: 'dialogue' | 'action',
  speakers: readonly string[] = [],
): Insertion {
  const lead = paragraphBreak(text.slice(0, offset));
  if (kind === 'action') {
    const body = 'Describe what happens.';
    return {
      offset,
      text: `${lead}${body}\n`,
      select: { from: lead.length, to: lead.length + body.length },
    };
  }
  const latest = speakers[speakers.length - 1];
  const other = [...speakers].reverse().find((name) => name !== latest);
  const speaker = (other ?? latest ?? 'CHARACTER').toUpperCase();
  return {
    offset,
    text: `${lead}${speaker}\nWhat they say.\n`,
    select: { from: lead.length, to: lead.length + speaker.length },
  };
}

/**
 * A parenthetical under a character cue ("how they say it"), with its words selected.
 * @param cueLineEnd Offset of the end of the cue line.
 */
export function newParentheticalInsertion(cueLineEnd: number): Insertion {
  const body = 'how they say it';
  return { offset: cueLineEnd, text: `\n(${body})`, select: { from: 2, to: 2 + body.length } };
}

/**
 * A transition line such as CUT TO:, in its own paragraph, with its words selected.
 * @param text The whole screenplay.
 * @param offset Where the scene's text ends.
 */
export function newTransitionInsertion(text: string, offset: number): Insertion {
  const lead = paragraphBreak(text.slice(0, offset));
  const body = 'CUT TO:';
  return {
    offset,
    text: `${lead}${body}\n`,
    select: { from: lead.length, to: lead.length + body.length },
  };
}

/**
 * An empty private note `[[ ]]` with the cursor inside.
 * @param offset Where the note goes (after a shot and its direction).
 */
export function newNoteInsertion(offset: number): Insertion {
  return { offset, text: '\n[[]]', select: { from: 3, to: 3 } };
}

/**
 * An empty `[[direction: ]]` note with the cursor inside.
 * @param offset Where the note goes (right after the shot's text).
 */
export function newDirectionInsertion(offset: number): Insertion {
  const text = '\n[[direction: ]]';
  return { offset, text, select: { from: text.length - 2, to: text.length - 2 } };
}

/**
 * A new act heading in front of an existing scene, so that scene (and those after it) start the act.
 * @param sceneStart Where the scene begins.
 * @param actsBefore How many acts come before it.
 */
export function newActAtSceneInsertion(sceneStart: number, actsBefore: number): Insertion {
  const name = nextActName(actsBefore);
  return { offset: sceneStart, text: `# ${name}\n\n`, select: { from: 2, to: 2 + name.length } };
}

/**
 * The range to delete when removing a line (or a block) of the script: the text itself, its line break, and one blank
 * line after it, so no gap is left behind.
 * @param text The whole screenplay.
 * @param start Start of the text to remove.
 * @param end End of the text to remove.
 */
export function removalRange(
  text: string,
  start: number,
  end: number,
): { from: number; to: number } {
  let to = end;
  if (text.startsWith('\r\n', to)) to += 2;
  else if (text.startsWith('\n', to)) to += 1;
  const blank = /^[ \t]*\r?\n/.exec(text.slice(to));
  if (blank) to += blank[0].length;
  return { from: start, to };
}
