/**
 * Cubeit design tokens. Liquid-glass look: a near-black graphite base with
 * soft ambient light behind it, frosted translucent surfaces with a bright
 * specular edge, and one fresh lime accent that echoes the LCD's green glass.
 * The room is where the color lives; the chrome stays neutral.
 */
export const colors = {
  bg: '#070908',
  bgRaised: '#101312',
  /** Translucent fills: layered over glass or the backdrop. */
  surface: 'rgba(255, 255, 255, 0.07)',
  surfaceRaised: 'rgba(255, 255, 255, 0.11)',
  surfacePressed: 'rgba(255, 255, 255, 0.18)',
  /** Opaque fallback for glass where blur isn't available. */
  glassFallback: 'rgba(22, 26, 24, 0.86)',
  glassTint: 'rgba(18, 22, 20, 0.38)',
  line: 'rgba(255, 255, 255, 0.08)',
  lineStrong: 'rgba(255, 255, 255, 0.16)',
  /** The bright rim along a glass surface's top edge. */
  specular: 'rgba(255, 255, 255, 0.30)',
  text: '#F3F6F1',
  textDim: '#AEB5AB',
  textFaint: '#7A8178',
  accent: '#C8F169',
  accentStrong: '#DBFF8C',
  accentSoft: 'rgba(200, 241, 105, 0.16)',
  /** Text and icons drawn on the accent. */
  onAccent: '#12170B',
  blue: '#7CC8FF',
  blueSoft: 'rgba(124, 200, 255, 0.16)',
  glow: '#DBFF8C',
  star: '#FFD36E',
  success: '#7BE3B0',
  warning: '#FFC46B',
  danger: '#FF7A85',
  dangerSoft: 'rgba(255, 122, 133, 0.14)',
  scrim: 'rgba(0, 0, 0, 0.55)',
} as const;

export const radii = { sm: 12, md: 16, lg: 22, xl: 30, pill: 999 } as const;

export const fonts = {
  regular: 'Nunito_600SemiBold',
  medium: 'Nunito_700Bold',
  bold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
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

/** Mood colors drive the ambient light behind the room and the mood dot. */
export const moodColors = {
  joyful: '#FFD36E',
  happy: '#9DF0C4',
  playful: '#7FD8FF',
  content: '#C8F169',
  calm: '#8FD0E8',
  sleepy: '#8E9AAE',
  blue: '#7E9CC4',
} as const;
