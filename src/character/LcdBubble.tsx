import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LCD_INK, LCD_PAPER } from '../lcd/bitmap';
import { fonts } from '../theme/tokens';

/**
 * A speech bubble on the LCD: panel-colored box, thick black border, a
 * one-dot pixel drop shadow, and a bold pixel font sized to stay readable.
 */
export const LcdBubble = memo(function LcdBubble({ text, dot }: { text: string; dot: number }) {
  const border = Math.max(2, Math.round(dot * 0.5));
  const shadow = Math.max(2, Math.round(dot * 0.7));
  const size = Math.round(Math.max(14, Math.min(17, dot * 2.6)));
  return (
    <View style={{ paddingRight: shadow, paddingBottom: shadow }}>
      <View style={[styles.shadow, { left: shadow, top: shadow, right: 0, bottom: 0 }]} />
      <View style={[styles.bubble, { borderWidth: border, paddingHorizontal: size * 0.6, paddingVertical: size * 0.4 }]}>
        <Text style={[styles.text, { fontSize: size, lineHeight: Math.round(size * 1.3) }]}>{pixelSafe(text)}</Text>
      </View>
    </View>
  );
});

/** The pixel font only has plain ASCII punctuation. */
const pixelSafe = (text: string) => text.replace(/…/g, '...').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-');

const styles = StyleSheet.create({
  shadow: { position: 'absolute', backgroundColor: LCD_INK },
  bubble: { backgroundColor: LCD_PAPER, borderColor: LCD_INK },
  text: { color: LCD_INK, fontFamily: fonts.pixelBold, letterSpacing: 0.3 },
});
