/**
 * Cubeit design tokens. Flat: a soft gray-green screen (deep charcoal in dark
 * mode), cards and sheets on top of it, text and the floating navigation bar
 * in ink, and one brand blue for highlights: primary actions, selected
 * states, icons and progress. The room's LCD keeps its own palette in both modes.
 *
 * Components read colors through `useColors()` / `useStyles()` (theme/theme.tsx)
 * so they follow the light / dark setting; never import a palette directly in UI.
 */
export const lightColors = {
  /** Screen background, a little deeper at the center (`bgCenter`). */
  bg: '#EAEBE6',
  bgCenter: '#DDDFD5',
  /** Sheets, dialogs and cards that sit on the background. */
  paper: '#FFFFFF',
  /** Cards inside sheets. */
  surface: '#F3F1EE',
  surfaceRaised: '#ECE9E5',
  surfacePressed: '#E3DFDA',
  /** The selected segment of a segmented control. */
  segment: '#FFFFFF',
  line: '#ECE9E5',
  lineStrong: '#DDD8D2',
  /** Dark chrome: the nav bar, toasts, overlays on the room. */
  ink: '#231F1C',
  /** Text and icons drawn on ink. */
  onInk: '#FFFFFF',
  text: '#231F1C',
  textDim: '#6F6A65',
  textFaint: '#A19C96',
  /** Brand / highlight color. */
  brand: '#306085',
  brandSoft: '#E4ECF2',
  accent: '#306085',
  accentSoft: '#E4ECF2',
  onAccent: '#FFFFFF',
  /** The device around the LCD: plastic lit top-left, shaded bottom-right. */
  housingLight: '#F1F2EC',
  housingDark: '#C9CBC1',
  housingRim: 'rgba(255,255,255,0.9)',
  housingScrew: '#B7BAAE',
  housingLabel: '#8E9184',
  housingShadow: '#3F4236',
  bezel: '#2A2A27',
  /** The device's indicator light. */
  orange: '#F26A1B',
  star: '#F5A623',
  success: '#2E7A6B',
  warning: '#D9861A',
  warningSoft: '#FCEFD9',
  danger: '#E5432C',
  dangerSoft: '#FDE6E1',
  scrim: 'rgba(35, 31, 28, 0.45)',
};

export type Colors = typeof lightColors;

export const darkColors: Colors = {
  bg: '#111315',
  bgCenter: '#1C1F22',
  paper: '#1C1F22',
  surface: '#25292D',
  surfaceRaised: '#2C3035',
  surfacePressed: '#363B40',
  segment: '#3A3F45',
  line: '#2A2E33',
  lineStrong: '#3A3F45',
  ink: '#2A2E33',
  onInk: '#FFFFFF',
  text: '#EDEFF1',
  textDim: '#A6ACB2',
  textFaint: '#6E757C',
  // A lighter brand blue keeps icons and text readable on dark surfaces.
  brand: '#4F8DBE',
  brandSoft: '#1D3344',
  accent: '#4F8DBE',
  accentSoft: '#1D3344',
  onAccent: '#FFFFFF',
  // A "space gray" device.
  housingLight: '#3B3F44',
  housingDark: '#1F2225',
  housingRim: 'rgba(255,255,255,0.14)',
  housingScrew: '#55595F',
  housingLabel: '#80868D',
  housingShadow: '#000000',
  bezel: '#0B0C0D',
  orange: '#F26A1B',
  star: '#F5B83D',
  success: '#4FB79E',
  warning: '#E3A04A',
  warningSoft: '#3A2E1C',
  danger: '#FF6B5A',
  dangerSoft: '#3B2220',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

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

/** Mood colors (same in both modes). */
export const moodColors = {
  joyful: '#FBBA3A',
  happy: '#2E7A6B',
  playful: '#F2553D',
  content: '#4851A8',
  calm: '#5B9BB8',
  sleepy: '#8F8A84',
  blue: '#4851A8',
} as const;
