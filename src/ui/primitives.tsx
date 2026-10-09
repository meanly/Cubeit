import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { feedback } from '../services/feedback';
import { colors, fonts, radii, type } from '../theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a gentle press-in scale. */
export function PressableScale({
  style,
  children,
  haptic = true,
  onPress,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; children?: ReactNode; haptic?: boolean }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withTiming(0.96, { duration: 90 }));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) feedback('select');
        onPress?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  tone = 'primary',
  icon,
  disabled,
  compact,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  icon?: IconName;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const bg =
    tone === 'primary' ? colors.accent : tone === 'danger' ? colors.dangerSoft : tone === 'secondary' ? colors.surfaceRaised : 'transparent';
  const fg = tone === 'primary' ? colors.onAccent : tone === 'danger' ? colors.danger : tone === 'ghost' ? colors.textDim : colors.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
        (tone === 'secondary' || tone === 'danger') && styles.buttonBorder,
        tone === 'primary' && styles.buttonPrimary,
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={compact ? 16 : 18} color={fg} />}
      <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: fg }]}>{label}</Text>
    </PressableScale>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 22,
  color = colors.text,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={[styles.iconButton, style]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </PressableScale>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? colors.onAccent : colors.textDim} />}
      <Text style={[styles.chipLabel, selected && { color: colors.onAccent }]}>{label}</Text>
    </PressableScale>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(value ? 1 : 0, { duration: 160 }));
  }, [value, progress]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * 20 }] }));
  const track = useAnimatedStyle(() => ({ opacity: 0.55 + progress.value * 0.45 }));
  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={styles.toggle}
    >
      <Animated.View style={[styles.toggleTrack, { backgroundColor: value ? colors.accent : colors.surfacePressed }, track]} />
      <Animated.View style={[styles.toggleKnob, knob]} />
    </PressableScale>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentLabel, selected && { color: colors.text }]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionText}>{children}</Text>
      {right}
    </View>
  );
}

export function StarCount({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={styles.starCount} accessibilityLabel={`${value} stars`}>
      <Ionicons name="star" size={size} color={colors.star} />
      <Text style={[styles.starText, { fontSize: size }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radii.pill,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonCompact: { minHeight: 38, paddingHorizontal: 16 },
  // Glass rim: a brighter top edge.
  buttonBorder: { borderWidth: 1, borderColor: colors.line, borderTopColor: colors.lineStrong },
  buttonPrimary: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderTopColor: 'rgba(255,255,255,0.55)',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonLabel: { fontFamily: fonts.bold, fontSize: 15 },
  buttonLabelCompact: { fontSize: 14 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopColor: colors.lineStrong,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopColor: colors.lineStrong,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent, borderTopColor: 'rgba(255,255,255,0.55)' },
  chipLabel: { ...type.label, color: colors.textDim },
  toggle: { width: 48, height: 28, justifyContent: 'center' },
  toggleTrack: { ...StyleSheet.absoluteFill, borderRadius: 14 },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginLeft: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radii.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segment: { flex: 1, minHeight: 34, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: {
    backgroundColor: colors.surfacePressed,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.line,
    borderTopColor: colors.specular,
  },
  segmentLabel: { ...type.label, color: colors.textDim },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  sectionText: { ...type.caption, color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  starCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starText: { fontFamily: fonts.bold, color: colors.star },
});
