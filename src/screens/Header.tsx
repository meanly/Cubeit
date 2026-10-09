import { StyleSheet, View } from 'react-native';

import { Logo } from '../ui/Logo';

export const HEADER_HEIGHT = 60;

/** Just the logo, centered at the top. */
export function Header() {
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Logo size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: HEADER_HEIGHT, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
