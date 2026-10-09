import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { bootstrapPersistence } from './src/state/persistence';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Load the saved world synchronously before the first frame (SQLite is local and fast).
  useState(() => {
    try {
      bootstrapPersistence();
    } catch (error) {
      console.warn('[cubeit] storage unavailable, running without saving', error);
    }
    return true;
  });
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Silkscreen_400Regular,
    Silkscreen_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

/** Root views that follow the light / dark theme (background, status bar). */
function ThemedApp() {
  const { scheme, colors } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <ErrorBoundary>
            <HomeScreen />
          </ErrorBoundary>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
