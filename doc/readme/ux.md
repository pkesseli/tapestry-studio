# UX principles and vocabulary

Decided in the round-1 concept review (2026-10) and the feedback on it. The running app is the reference from now on:
review sections in the app, not in mockups. Design tokens live in `packages/app/src/renderer/src/styles.css`.

## Navigation

Top tabs, in plain words: **Write, Library, Queue, Music**. There is no Shots tab: shots belong to the script they come
from (see below). Write has a scene (or song section) list on the
left, the text in the middle, and an "In this scene" panel on the right. Other sections follow the same
three-column rhythm: a list, the work, the details.

- **Scene list** is grouped under acts (`# Act One` lines in the script), can be folded and searched (by title, heading,
  act or any name in the scene), and the app reopens on the scene and place you left. Items show a small filmstrip of that scene's shots. Shots that do not exist yet are dashed empty frames,
  so the list is useful before any footage exists and fills in as the film does.
- - **Shots live in Write.** Every action paragraph and every spoken line is a shot, planned automatically, with a small
  numbered tab in the margin (dashed: not made, teal: ready to review, green with a check: accepted). The right panel
  shows the shot under the cursor: footage in context (previous, next, play the whole scene), what it shows, who is in it,
  and its direction. A storyboard overview across the whole film may come later; editing stays in Write.
- **Direction** is optional writing for how a shot looks: a note `[[direction: slow push-in, thick fog]]` under the shot
  it directs. The app writes the note for you ("Add direction"), shows it in violet, sends it to the video model, and
  leaves it out when you export the script. Plain notes `[[like this]]` are private reminders and go nowhere.
- Names in the text are marked: known ones with a teal underline, unknown ones with a dashed amber underline. A small
  card offers to add an unknown one on the spot; nothing else interrupts writing.

## Words the user sees (never internal state names)

| Internal state | Shown as |
|---|---|
| draft | Not made yet |
| approved, queued | Waiting (Needs your approval before that) |
| running | Making it |
| rendered | Ready to review |
| accepted | Accepted (a lock icon) |
| failed | Something went wrong (with a plain reason and what to do) |

## Principles

1. **Costs and time are written as sentences**, before approval: "This will cost nothing", "About $1.20 for both". Paid
   services show a hard limit and never exceed it.
2. **Accept means keep exactly as is.** It is drawn as a lock and explained once in words: other takes are never
   deleted, and it can be unlocked later.
3. **Review always happens in context.** A clip is never shown alone: the player can step to the previous and next shot
   of the scene (including accepted ones) and play the clip right after its predecessor, because a take can only be
   judged against what surrounds it.
4. **Practice mode is marked clearly and separately.** Practice clips are placeholders, not the user's film. Every
   practice clip carries a visible "Sample" tag in lists and in the player, the mode is shown in the top bar, and the
   app offers "replace samples with real shots" once a real engine is set up. Users can learn the whole interface in it,
   but nothing made in it can be mistaken for a result.
5. **Simple by default.** Provider names, seeds and raw prompts live in an Advanced view; plain wording is edited
   instead ("say what to change").
6. **Keyboard first, screen-reader friendly:** real buttons and labels, visible focus, text 4.5:1 contrast, states never
   conveyed by colour alone (each has a word or icon), everything reachable without a mouse.

## Look

Calm light surfaces (warm grey page, white cards), teal as the single primary colour, amber for "needs your
attention", violet for "being made", green for accepted, coral for problems. UI font Figtree; screenplays and lyrics in
Courier Prime to feel like a script. Dark mode and the Advanced view are still to be designed.

## Process

UI is built **one section at a time as a runnable prototype**, reviewed by the human (and the target user) in the real
app before the next section starts. Feedback is applied in the same plan file before it is deleted.
