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
