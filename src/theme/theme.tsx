import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Appearance, AppState } from 'react-native';

import { useGame } from '../state/gameStore';
import { darkColors, lightColors, type Colors } from './tokens';

export type { Colors } from './tokens';
export type Scheme = 'light' | 'dark';

interface Theme {
  scheme: Scheme;
  colors: Colors;
}

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: lightColors });

/**
 * The phone's light/dark setting — but only as seen while the app is in the
 * foreground. When an app is sent to the background, iOS redraws it in the
 * *other* appearance for the app switcher's snapshots, and React Native passes
 * that on as a real change; following it repaints the whole app in the wrong
 * palette for a moment (a white flash in dark mode). So a change only counts
 * once it has settled while the app is active, and the real value is re-read
 * whenever the app comes back.
 */
const systemScheme = (() => {
  const read = (): Scheme => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
  let current = read();
  let started = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const update = () => {
    const next = read();
    if (next === current) return;
    current = next;
    listeners.forEach((l) => l());
  };
  const start = () => {
    if (started) return;
    started = true;
    current = read();
    Appearance.addChangeListener(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (AppState.currentState === 'active') update();
      }, 250);
    });
    AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
  };
  return {
    get: () => current,
    subscribe: (listener: () => void) => {
      start();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();

/** Picks the palette from the Appearance setting (or the phone's, when set to System). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const pref = useGame((s) => s.settings.appearance);
  const system = useSyncExternalStore(systemScheme.subscribe, systemScheme.get);
  const scheme: Scheme = pref === 'system' ? system : pref;
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
