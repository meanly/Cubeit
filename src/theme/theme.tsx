import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useGame } from '../state/gameStore';
import { darkColors, lightColors, type Colors } from './tokens';

export type { Colors } from './tokens';
export type Scheme = 'light' | 'dark';

interface Theme {
  scheme: Scheme;
  colors: Colors;
}

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: lightColors });

/** Picks the palette from the Appearance setting (or the phone's, when set to System). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const pref = useGame((s) => s.settings.appearance);
  const system = useColorScheme();
  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const theme = useMemo<Theme>(() => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors }), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}

/**
 * Styles that follow the theme: pass a module-level factory
 * (`const makeStyles = (colors: Colors) => StyleSheet.create({...})`);
 * it re-runs only when the palette changes.
 */
export function useStyles<T>(factory: (colors: Colors) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
