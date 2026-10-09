import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme/tokens';
import { useSvgId } from './useSvgId';

/** iOS 26+ draws real Liquid Glass; everything else gets a frosted blur. */
const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

const BlurTargetContext = createContext<RefObject<View | null> | null>(null);

/** Shares the blur target with every glass surface on the screen. */
export function GlassRoot({ children }: { children: ReactNode }) {
  const ref = useRef<View | null>(null);
  return <BlurTargetContext.Provider value={ref}>{children}</BlurTargetContext.Provider>;
}

/**
 * The content glass surfaces blur. Android only blurs what's inside a
 * BlurTargetView, so the backdrop and room live in one (elsewhere it's a
 * plain View). Glass must render outside it, never inside.
 */
export function GlassBackdrop({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useContext(BlurTargetContext);
  return (
    <BlurTargetView ref={ref ?? undefined} style={style}>
      {children}
    </BlurTargetView>
  );
}

type Props = ViewProps & {
  radius?: number;
  /** Thicker frosting for large surfaces (sheets, dialogs). */
  strong?: boolean;
  /** Reacts to touch on iOS 26 Liquid Glass. */
  interactive?: boolean;
  /** Tint layered over the glass. */
  tint?: string;
  /**
   * Native Liquid Glass can't be faded with opacity; pass false for surfaces
   * that animate in with a fade (toasts, dialogs) to use the blur instead.
   */
  native?: boolean;
  children?: ReactNode;
};

/**
 * A liquid-glass surface: blurred backdrop, a faint tint, a soft sheen across
 * the top and a bright specular rim. Children render above it.
 */
export function Glass({ radius = 24, strong, interactive, tint, native = true, style, children, ...rest }: Props) {
  const target = useContext(BlurTargetContext);
  const sheen = useSvgId('sheen');
  const round = { borderRadius: radius };
  const liquid = LIQUID && native;

  let base: ReactNode;
  if (liquid) {
    base = (
      <GlassView
        style={[StyleSheet.absoluteFill, round]}
        glassEffectStyle="regular"
        colorScheme="dark"
        isInteractive={interactive}
        tintColor={tint}
      />
    );
  } else if (Platform.OS === 'android' && !target) {
    base = <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFallback }]} />;
  } else {
    base = (
      <>
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={strong ? 60 : 40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={target ?? undefined}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint ?? (strong ? 'rgba(14,17,16,0.55)' : colors.glassTint) }]} />
      </>
    );
  }

  return (
    <View {...rest} style={[styles.root, round, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, round, styles.clip, styles.under]}>
        {base}
        {!liquid && (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={strong ? 0.07 : 0.1} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${sheen})`} />
          </Svg>
        )}
      </View>
      {!liquid && <View pointerEvents="none" style={[StyleSheet.absoluteFill, round, styles.rim, styles.under]} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Its own stacking context, so the layers below can sit under every child
  // (on web, absolutely positioned layers otherwise paint over static ones like inputs).
  root: { position: 'relative', zIndex: 0 },
  under: { zIndex: -1 },
  clip: { overflow: 'hidden' },
  rim: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.line,
    borderTopColor: colors.specular,
    borderLeftColor: 'rgba(255,255,255,0.14)',
  },
});
