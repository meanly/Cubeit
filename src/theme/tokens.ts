/**
 * Cubeit design tokens. The UI is deliberately quiet: a deep navy base, purple
 * and blue accents, soft glows. The room is where the color lives.
 */
export const colors = {
  bg: '#090B18',
  bgRaised: '#0E1126',
  surface: '#141933',
  surfaceRaised: '#1B2144',
  surfacePressed: '#252C58',
  line: 'rgba(170, 178, 255, 0.10)',
  lineStrong: 'rgba(170, 178, 255, 0.22)',
  text: '#ECEEFF',
  textDim: '#AEB3DA',
  textFaint: '#7C83AE',
  accent: '#8C7BFF',
  accentStrong: '#A08FFF',
  accentSoft: 'rgba(140, 123, 255, 0.18)',
  blue: '#5B9DFF',
  blueSoft: 'rgba(91, 157, 255, 0.16)',
  glow: '#B6A6FF',
  star: '#FFD36E',
  success: '#6BE0B0',
  warning: '#FFC46B',
  danger: '#FF6F8E',
  dangerSoft: 'rgba(255, 111, 142, 0.14)',
  scrim: 'rgba(5, 6, 16, 0.72)',
} as const;

export const radii = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

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

/** Mood colors drive the glow behind the character and a faint tint in the room's light. */
export const moodColors = {
  joyful: '#FFD36E',
  happy: '#9DF0C4',
  playful: '#7FD8FF',
  content: '#B6A6FF',
  calm: '#8FB4FF',
  sleepy: '#7E86C9',
  blue: '#8C9BD6',
} as const;
