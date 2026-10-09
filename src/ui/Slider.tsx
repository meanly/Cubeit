import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useStyles, type Colors } from '../theme/theme';


interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
}

const THUMB = 26;

/** Small dependency-free slider (drag or tap the track). Also adjustable with accessibility actions. */
export function Slider({ value, min, max, step = 0.1, onChange, label }: Props) {
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const pos = useSharedValue(0);
  const range = max - min;

  useEffect(() => {
    pos.set(((value - min) / range) * Math.max(0, width - THUMB));
  }, [value, min, range, width, pos]);

  const commit = (px: number) => {
    const raw = min + (px / Math.max(1, width - THUMB)) * range;
    const snapped = Math.round(raw / step) * step;
    onChange(Math.min(max, Math.max(min, Number(snapped.toFixed(2)))));
  };

  const track = Math.max(0, width - THUMB);
  const move = (x: number) => {
    'worklet';
    pos.set(Math.min(track, Math.max(0, x - THUMB / 2)));
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => move(e.x))
    .onUpdate((e) => move(e.x))
    .onFinalize(() => scheduleOnRN(commit, pos.value));

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value }] }));
  const fill = useAnimatedStyle(() => ({ width: pos.value }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.wrap}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: Number(value.toFixed(1)) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const delta = e.nativeEvent.actionName === 'increment' ? step : -step;
          onChange(Math.min(max, Math.max(min, Number((value + delta).toFixed(2)))));
        }}
      >
        <View style={styles.track} />
        <Animated.View style={[styles.fill, fill]} />
        <Animated.View style={[styles.thumb, thumb]} />
      </View>
    </GestureDetector>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  wrap: { height: 40, justifyContent: 'center' },
  track: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 6, borderRadius: 3, backgroundColor: colors.surfacePressed },
  fill: { position: 'absolute', left: THUMB / 2, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
