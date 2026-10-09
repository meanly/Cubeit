import Svg, { Circle, Path } from 'react-native-svg';

export type NavIconName = 'home' | 'talk' | 'memories' | 'settings';

/** A gear outline: eight rounded-off teeth around the hub, centered in a 24-unit box. */
function gearPath(): string {
  const teeth = 8;
  const outer = 9.6;
  const inner = 7.4;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const half = (Math.PI / teeth) * 0.42;
    const step = Math.PI / teeth;
    const p = (r: number, ang: number) => `${(12 + r * Math.cos(ang)).toFixed(2)} ${(12 + r * Math.sin(ang)).toFixed(2)}`;
    pts.push(`${i === 0 ? 'M' : 'L'}${p(inner, a - step + half)}`);
    pts.push(`L${p(outer, a - half)}`);
    pts.push(`L${p(outer, a + half)}`);
    pts.push(`L${p(inner, a + step - half)}`);
  }
  return `${pts.join(' ')}Z`;
}
const GEAR = gearPath();

const PATHS: Record<Exclude<NavIconName, 'settings'>, string[]> = {
  home: ['M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z'],
  talk: ['M20.5 11.5a8 8 0 0 1-11.7 7.1L3.5 20l1.5-4.6a8 8 0 1 1 15.5-3.9z', 'M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01'],
  memories: ['M4.5 19V5.5a2 2 0 0 1 2-2h13v14h-13a2 2 0 0 0-2 2 2 2 0 0 0 2 2h13', 'M9 7.5h6'],
};

/**
 * Crisp vector line icons for the navigation bar (2-unit round strokes on a
 * 24-unit grid), so they stay sharp at any size and pixel density.
 */
export function NavIcon({ name, size = 22, color }: { name: NavIconName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'settings' ? (
        <>
          <Path d={GEAR} stroke={color} strokeWidth={2} strokeLinejoin="round" />
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
        </>
      ) : (
        PATHS[name].map((d) => (
          <Path key={d} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))
      )}
    </Svg>
  );
}
