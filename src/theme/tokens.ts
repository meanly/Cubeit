/**
 * Cubeit design tokens. Flat: a soft gray-green screen, white cards and sheets,
 * warm light-gray cards inside sheets,
 * a warm near-black for text, primary actions and the floating navigation bar,
 * and four bold block colors (red, yellow, teal, blue) for icons and accents.
 * The room's LCD keeps its own palette.
 */
export const colors = {
  /** Screen background: a soft gray-green, a little deeper at the center (`bgCenter`). */
  bg: '#EAEBE6',
  bgCenter: '#DDDFD5',
  /** Sheets, dialogs and cards that sit on the background. */
  paper: '#FFFFFF',
  bgRaised: '#FFFFFF',
  /** Card fill. */
  surface: '#F3F1EE',
  surfaceRaised: '#ECE9E5',
  surfacePressed: '#E3DFDA',
  line: '#ECE9E5',
  lineStrong: '#DDD8D2',
  /** Warm near-black: text, primary buttons, the nav bar, the room's frame. */
  ink: '#231F1C',
  inkSoft: '#3A3431',
  text: '#231F1C',
  textDim: '#6F6A65',
  textFaint: '#A19C96',
  /** Text and icons drawn on ink. */
  onInk: '#FFFFFF',
  /** Primary actions are ink; the block colors are for icons and highlights. */
  accent: '#231F1C',
  accentSoft: '#F3F1EE',
  onAccent: '#FFFFFF',
  red: '#F2553D',
  redSoft: '#FDE6E1',
  yellow: '#FBBA3A',
  yellowSoft: '#FEF1D5',
  teal: '#2E7A6B',
  tealSoft: '#DDEEEA',
  blue: '#4851A8',
  blueSoft: '#E3E5F5',
  /** The device's indicator light (from the gadget reference). */
  orange: '#F26A1B',
  /** Light plastic housing around the LCD: lit top-left, shaded bottom-right. */
  housingLight: '#F1F2EC',
  housingDark: '#C9CBC1',
  bezel: '#2A2A27',
  star: '#F5A623',
  success: '#2E7A6B',
  warning: '#D9861A',
  danger: '#E5432C',
  dangerSoft: '#FDE6E1',
  scrim: 'rgba(35, 31, 28, 0.45)',
} as const;

export const radii = { sm: 10, md: 14, lg: 18, xl: 26, pill: 999 } as const;

export const fonts = {
  regular: 'PlusJakartaSans_500Medium',
  medium: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  black: 'PlusJakartaSans_800ExtraBold',
  /** Pixel fonts for text drawn on the LCD. */
  pixel: 'Silkscreen_400Regular',
  pixelBold: 'Silkscreen_700Bold',
} as const;

export const type = {
  caption: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.2 },
  label: { fontFamily: fonts.medium, fontSize: 13 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21 },
  title: { fontFamily: fonts.bold, fontSize: 18 },
  heading: { fontFamily: fonts.black, fontSize: 22 },
} as const;

/** Mood colors: the mood dot and the avatar behind the stickman. */
export const moodColors = {
  joyful: '#FBBA3A',
  happy: '#2E7A6B',
  playful: '#F2553D',
  content: '#4851A8',
  calm: '#5B9BB8',
  sleepy: '#8F8A84',
  blue: '#4851A8',
} as const;
