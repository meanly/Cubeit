import { MaterialSymbols_500Medium } from '@expo-google-fonts/material-symbols/500Medium';
import { MaterialSymbols_500Medium_Filled } from '@expo-google-fonts/material-symbols/500Medium_Filled';
import { SymbolView, type AndroidSymbol, type SFSymbol, type SymbolWeight } from 'expo-symbols';

import { Icon, type IconId } from './Icons';

/** Material Symbols fonts for Android and web (filled for the `.fill` look, outlined otherwise). */
const MATERIAL_FILLED = { name: 'MaterialSymbols_500Medium_Filled', font: MaterialSymbols_500Medium_Filled };
const MATERIAL_OUTLINE = { name: 'MaterialSymbols_500Medium', font: MaterialSymbols_500Medium };

/** Each icon as an SF Symbol (outline and filled) and its Material Symbols counterpart. */
const NAMES: Record<IconId, { sf: SFSymbol; sfFill: SFSymbol; material: AndroidSymbol }> = {
  home: { sf: 'house', sfFill: 'house.fill', material: 'home' },
  talk: { sf: 'bubble.left', sfFill: 'bubble.left.fill', material: 'chat_bubble' },
  planner: { sf: 'calendar', sfFill: 'calendar', material: 'calendar_month' },
  settings: { sf: 'gearshape', sfFill: 'gearshape.fill', material: 'settings' },
  bell: { sf: 'bell', sfFill: 'bell.fill', material: 'notifications' },
  play: { sf: 'gamecontroller', sfFill: 'gamecontroller.fill', material: 'sports_esports' },
  customize: { sf: 'paintpalette', sfFill: 'paintpalette.fill', material: 'palette' },
  friends: { sf: 'person.2', sfFill: 'person.2.fill', material: 'group' },
  star: { sf: 'star', sfFill: 'star.fill', material: 'star' },
  heart: { sf: 'heart', sfFill: 'heart.fill', material: 'favorite' },
  moon: { sf: 'moon', sfFill: 'moon.fill', material: 'bedtime' },
  gift: { sf: 'gift', sfFill: 'gift.fill', material: 'redeem' },
  sparkle: { sf: 'sparkles', sfFill: 'sparkles', material: 'auto_awesome' },
  cube: { sf: 'cube', sfFill: 'cube.fill', material: 'view_in_ar' },
  ball: { sf: 'baseball', sfFill: 'baseball.fill', material: 'sports_baseball' },
  reload: { sf: 'arrow.clockwise', sfFill: 'arrow.clockwise', material: 'refresh' },
};

/**
 * Platform-standard icons: SF Symbols on iOS, Material Symbols on Android and
 * web (the matching system set there). Falls back to our vector icons.
 */
export function AppSymbol({
  name,
  size = 22,
  color,
  filled = true,
  weight = 'semibold',
}: {
  name: IconId;
  size?: number;
  color: string;
  filled?: boolean;
  weight?: SymbolWeight;
}) {
  const n = NAMES[name];
  return (
    <SymbolView
      name={{ ios: filled ? n.sfFill : n.sf, android: n.material, web: n.material }}
      weight={{ ios: weight, android: filled ? MATERIAL_FILLED : MATERIAL_OUTLINE }}
      tintColor={color}
      size={size}
      fallback={<Icon name={name} size={size} color={color} />}
    />
  );
}
