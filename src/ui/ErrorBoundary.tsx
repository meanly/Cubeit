import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '../theme/tokens';
import { Button } from './primitives';
import { useStyles, type Colors } from '../theme/theme';

interface State {
  error: Error | null;
}

/** Last line of defense: show a friendly retry instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn('[cubeit] render error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorScreen onRetry={() => this.setState({ error: null })} />;
  }
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Oops — the cube got jostled.</Text>
      <Text style={styles.body}>Your saved data is safe on this device. Try again to reload the room.</Text>
      <Button label="Try again" icon="refresh" onPress={onRetry} />
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, backgroundColor: colors.bg },
  title: { fontFamily: fonts.black, fontSize: 20, color: colors.text, textAlign: 'center' },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.textDim, textAlign: 'center', lineHeight: 21 },
});
