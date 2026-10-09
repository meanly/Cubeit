/** Small collectibles the character "discovers" — one per day you visit, never required. */
export type FindId =
  | 'pebble'
  | 'feather'
  | 'button'
  | 'acorn'
  | 'shell'
  | 'marble'
  | 'key'
  | 'leaf'
  | 'starShard'
  | 'bottleCap';

export interface FindDef {
  id: FindId;
  name: string;
  blurb: string;
  color: string;
  accent: string;
}

export const FINDS: readonly FindDef[] = [
  { id: 'pebble', name: 'Smooth pebble', blurb: 'Perfectly round. Probably lucky.', color: '#9AA3B8', accent: '#C7CEDD' },
  { id: 'feather', name: 'Blue feather', blurb: 'Floated in from somewhere.', color: '#6FA8FF', accent: '#BFD8FF' },
  { id: 'button', name: 'Lost button', blurb: 'Four holes. A whole mystery.', color: '#FF8FA8', accent: '#FFD0DB' },
  { id: 'acorn', name: 'Tiny acorn', blurb: 'Will it grow? Someday.', color: '#B07A4A', accent: '#7A5232' },
  { id: 'shell', name: 'Spiral shell', blurb: 'You can almost hear waves.', color: '#FFCFA8', accent: '#F09B73' },
  { id: 'marble', name: 'Galaxy marble', blurb: 'There are stars inside!', color: '#7B6CFF', accent: '#7FE0FF' },
  { id: 'key', name: 'Little key', blurb: 'Opens nothing. Or everything.', color: '#F2C65B', accent: '#FFE7A3' },
  { id: 'leaf', name: 'Red leaf', blurb: 'Pressed flat and kept safe.', color: '#E8644F', accent: '#FFA38F' },
  { id: 'starShard', name: 'Star shard', blurb: 'Still a little warm.', color: '#FFD36E', accent: '#FFF3C7' },
  { id: 'bottleCap', name: 'Bottle cap', blurb: 'Crinkly edges. Very shiny.', color: '#5FD3B0', accent: '#B8F5E2' },
];

export const findById = (id: string): FindDef | undefined => FINDS.find((f) => f.id === id);
