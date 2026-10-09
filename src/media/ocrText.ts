import { parseWhen, stripSpans } from '../assistant/dateParse';
import type { DayKey, TimeOfDay } from '../planner/dates';

/**
 * Turning OCR'd text into planner drafts. OCR only reads text — it doesn't
 * "understand" the picture — so these are simple, reviewable heuristics, and
 * the user edits the result before anything is saved.
 */

/** Join recognized lines, dropping empties and obvious noise. */
export function cleanOcrLines(lines: readonly string[]): string[] {
  return lines
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && /[\p{L}\p{N}]/u.test(l));
}

/** Checklist items from a photographed list: bullets, numbers and checkboxes are stripped. */
export function linesToChecklist(text: string): string[] {
  return text
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*(?:[-*•·○●□■☐☑✓✔]|\[\s?[xX✓]?\s?\]|\(?\d{1,2}[.)]|[a-z][.)])\s*/u, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((l) => l.length > 1)
    .slice(0, 30);
}

export interface EventGuess {
  title: string;
  day?: DayKey;
  start?: TimeOfDay;
  end?: TimeOfDay;
}

/**
 * Best guess at an event from a poster/flyer: the first line that isn't just
 * a date or time becomes the title; dates and times anywhere in the text are
 * parsed against today.
 */
export function guessEventFromText(text: string, now: number): EventGuess {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const flat = lines.join(' ');
  const when = parseWhen(flat, now, 'future');
  const titleLine =
    lines.find((l) => {
      const p = parseWhen(l, now);
      const rest = stripSpans(l, p.spans);
      return rest.replace(/[^\p{L}]/gu, '').length >= 3;
    }) ?? '';
  const title = stripSpans(titleLine, parseWhen(titleLine, now).spans).slice(0, 120);
  return {
    title,
    ...(when.day ? { day: when.day } : {}),
    ...(when.start && !when.approximate ? { start: when.start } : {}),
    ...(when.end ? { end: when.end } : {}),
  };
}
