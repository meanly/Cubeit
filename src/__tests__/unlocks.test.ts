import { ACCESSORIES } from '../content/appearance';
import { THEMES } from '../content/themes';
import { isUnlocked, unlockKey } from '../content/unlocks';

describe('unlocks', () => {
  it('every theme is available right now, with no stars spent and friendship level 1', () => {
    for (const t of THEMES) expect(isUnlocked(unlockKey('theme', t.id), t.unlock, [], 1)).toBe(true);
  });

  it('other content keeps its normal unlock rules', () => {
    const paid = ACCESSORIES.find((a) => a.unlock.kind !== 'default');
    if (paid) expect(isUnlocked(unlockKey('accessory', paid.id), paid.unlock, [], 1)).toBe(false);
  });
});
