import { memo, useMemo } from 'react';

import { Bitmap } from '../lcd/bitmap';
import { LcdArt } from '../lcd/LcdArt';
import type { EmoteId } from './states';

/** Emotes are 9×9 dot icons with a one-dot panel-colored border: 11×11 dots in all. */
export const EMOTE_DOTS = 11;

const GLYPHS: Record<EmoteId, readonly string[]> = {
  heart: ['.###.###.', '#########', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  star: ['....#....', '...###...', '#########', '.#######.', '..#####..', '.###.###.', '.##...##.'],
  sparkle: ['....#....', '....#....', '...###...', '.#######.', '...###...', '....#....', '....#....'],
  note: ['....##...', '....#.#..', '....#..#.', '....#....', '....#....', '.####....', '#####....', '.###.....'],
  swirl: ['.######.', '#......#', '#.####.#', '#.#..#.#', '#.#.##.#', '#.#....#', '#.######'],
  book: ['.###.###.', '#...#...#', '#.#.#.#.#', '#...#...#', '#.#.#.#.#', '#...#...#', '.###.###.'],
  question: ['.###.', '#...#', '....#', '...#.', '..#..', '..#..', '.....', '..#..'],
  exclaim: ['##', '##', '##', '##', '##', '..', '##'],
  dots: ['.........', '.........', '.........', '##.##.##.', '##.##.##.'],
  zzz: ['.....###.', '.......#.', '......#..', '.....###.', '###......', '..#......', '.#.......', '###......'],
};

export const EmoteGlyph = memo(function EmoteGlyph({ id, dot }: { id: EmoteId; dot: number }) {
  const bitmap = useMemo(() => {
    const rows = GLYPHS[id];
    const b = new Bitmap(EMOTE_DOTS, EMOTE_DOTS);
    const w = Math.max(...rows.map((r) => r.length));
    b.sprite(rows, 1 + Math.floor((9 - w) / 2), 1 + Math.floor((9 - rows.length) / 2));
    return b.outline();
  }, [id]);
  return <LcdArt bitmap={bitmap} dot={dot} />;
});
