import Svg, { Circle, Path } from 'react-native-svg';

export type IconId =
  | 'home'
  | 'talk'
  | 'memories'
  | 'settings'
  | 'bell'
  | 'play'
  | 'customize'
  | 'friends'
  | 'star'
  | 'heart'
  | 'moon'
  | 'gift'
  | 'sparkle'
  | 'cube'
  | 'ball'
  | 'reload';

/** A gear outline: eight squared teeth around the hub, centered in a 24-unit box. */
function gearPath(): string {
  const teeth = 8;
  const outer = 9.6;
  const inner = 7.4;
  const step = Math.PI / teeth;
  const half = step * 0.42;
  const p = (r: number, a: number) => `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    pts.push(`${i === 0 ? 'M' : 'L'}${p(inner, a - step + half)}`, `L${p(outer, a - half)}`, `L${p(outer, a + half)}`, `L${p(inner, a + step - half)}`);
  }
  return `${pts.join(' ')}Z`;
}

const PATHS: Record<Exclude<IconId, 'settings'>, string[]> = {
  home: ['M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z'],
  talk: ['M20.5 11.5a8 8 0 0 1-11.7 7.1L3.5 20l1.5-4.6a8 8 0 1 1 15.5-3.9z', 'M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01'],
  memories: ['M4.5 19V5.5a2 2 0 0 1 2-2h13v14h-13a2 2 0 0 0-2 2 2 2 0 0 0 2 2h13', 'M9 7.5h6'],
  bell: ['M6 9.5a6 6 0 0 1 12 0c0 5.5 2.5 7 2.5 7h-17S6 15 6 9.5z', 'M10 20a2.2 2.2 0 0 0 4 0'],
  play: [
    'M7.5 7h9a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-9a5 5 0 0 1-5-5v0a5 5 0 0 1 5-5z',
    'M7.5 10.5v3M6 12h3',
    'M15.5 11h.01M17.5 13h.01',
  ],
  customize: [
    'M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.5-1-2.6 0-.9.7-1.7 1.7-1.7H17a3.5 3.5 0 0 0 3.5-3.5c0-4.2-3.8-7.5-8.5-7.5z',
    'M7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
  ],
  friends: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.3a3.5 3.5 0 0 1 0 6.4', 'M18 14a6.5 6.5 0 0 1 3.5 6'],
  star: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'],
  heart: ['M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z'],
  moon: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  gift: ['M4 11h16v9.5H4z', 'M3 7.5h18V11H3z', 'M12 7.5v13', 'M12 7.5S10.5 3.5 8 4.2c-2 .6-1 3.3 4 3.3zM12 7.5s1.5-4 4-3.3c2 .6 1 3.3-4 3.3z'],
  reload: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4.2h-4.2'],
  cube: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
  ball: ['M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z', 'M3.8 9.5c3 1.2 6.4 4.4 7.4 10.9', 'M20.2 9.5c-3 1.2-6.4 4.4-7.4 10.9', 'M8 4.5c2.2 2 6 2 8 0'],
  sparkle: ['M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z', 'M18.5 16v4M16.5 18h4'],
};
const GEAR = gearPath();

/**
 * Crisp vector line icons (2-unit round strokes on a 24-unit grid) that stay
 * sharp at any size and pixel density. Used for the app chrome.
 */
export function Icon({ name, size = 22, color, strokeWidth = 2 }: { name: IconId; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'settings' ? (
        <>
          <Path d={GEAR} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} />
        </>
      ) : (
        PATHS[name].map((d) => (
          <Path key={d} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ))
      )}
    </Svg>
  );
}
