import { useState } from 'react';
import { PixelRatio, Platform, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCharacterBrain } from '../character/useCharacterBrain';
import { GameHost } from '../games/GameHost';
import { GameHud } from '../games/GameHud';
import { VisitorLayer } from '../nearby/VisitorLayer';
import { PANELS } from '../panels';
import { PanelHost } from '../panels/PanelHost';
import { SettingsScreen } from '../panels/SettingsScreen';
import { LCD_DOTS } from '../lcd/bitmap';
import { WorldProvider } from '../physics/World';
import { useDailyLife } from '../progression/useDailyLife';
import { Room } from '../room/Room';
import { TiltSensorHost } from '../sensors/TiltSensorHost';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { colors } from '../theme/tokens';
import { Toasts } from '../ui/Toasts';
import { ActionBar, ACTION_BAR_HEIGHT } from './ActionBar';
import { Header, HEADER_HEIGHT } from './Header';
import { Onboarding } from './Onboarding';

const SIDE = 16;
/** Width of the frame around the LCD, as a share of the space available. */
const FRAME_RATIO = 0.065;

export function HomeScreen() {
  return (
    <WorldProvider>
      <HomeContent />
    </WorldProvider>
  );
}

function HomeContent() {
  const insets = useSafeAreaInsets();
  const [root, setRoot] = useState({ w: 0, h: 0 });
  const onboarded = useGame((s) => s.settings.onboarded);
  const activeGame = useUi((s) => s.activeGame);
  const visitor = useUi((s) => s.visitor);
  useCharacterBrain();
  useDailyLife(onboarded);

  const stageTop = insets.top + HEADER_HEIGHT;
  const stageBottom = root.h - insets.bottom - ACTION_BAR_HEIGHT;
  const stageH = Math.max(0, stageBottom - stageTop);
  // A square frame, with the square LCD inside it. Each dot is a whole number
  // of device pixels so the dots stay crisp.
  const px = PixelRatio.get();
  const fit = Math.max(0, Math.min(root.w - SIDE * 2, 560, stageH - 12));
  const border = Math.round(fit * FRAME_RATIO);
  const roomW = (Math.floor(((fit - border * 2) * px) / LCD_DOTS) * LCD_DOTS) / px;
  const roomH = roomW;
  const frameW = roomW + border * 2;
  const frameH = frameW;
  // Must match the resting position computed in roomStyle below (translateY 0 when no panel is open).
  const roomTop = stageTop + 4 + (stageH - 12 - frameH) / 2;

  // The open panel's top edge; the room scales down to fit above it.
  const panelTop = useSharedValue(10_000);
  const roomStyle = useAnimatedStyle(() => {
    const bottom = Math.min(stageBottom, panelTop.value) - 8;
    const available = bottom - stageTop - 4;
    const scale = Math.max(0.3, Math.min(1, available / frameH));
    const top = stageTop + 4 + (available - frameH * scale) / 2;
    return { transform: [{ translateY: top - roomTop }, { scale }] };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== root.w || height !== root.h) setRoot({ w: width, h: height });
  };

  const ready = root.w > 0 && roomW > 100;
  const busy = activeGame !== null || visitor !== null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} onLayout={onLayout}>
      <TiltSensorHost />
      <Header />
      {ready && (
        <Animated.View
          style={[styles.roomWrap, { top: roomTop, left: (root.w - frameW) / 2, width: frameW, height: frameH }, roomStyle]}
        >
          <View style={[styles.frame, { padding: border - 1, borderRadius: border * 1.3 }]}>
            <Room width={roomW} height={roomH} overlay={<GameHud />}>
              {visitor && <VisitorLayer roomWidth={roomW} roomHeight={roomH} />}
              <GameHost roomWidth={roomW} roomHeight={roomH} />
            </Room>
          </View>
        </Animated.View>
      )}
      <View style={[styles.actions, { bottom: insets.bottom }]}>
        <ActionBar disabled={busy} />
      </View>
      {ready && (
        <PanelHost
          panels={PANELS}
          rootHeight={root.h}
          topReserve={stageTop + 150}
          bottomInset={insets.bottom}
          panelTop={panelTop}
        />
      )}
      <Toasts top={insets.top + HEADER_HEIGHT + 6} />
      <SettingsScreen />
      {!onboarded && <Onboarding />}
    </View>
  );
}

const styles = StyleSheet.create({
  // 'clip' (web) also prevents focus changes from scrolling the clipped content.
  root: { flex: 1, backgroundColor: colors.bg, overflow: Platform.OS === 'web' ? ('clip' as ViewStyle['overflow']) : 'hidden' },
  roomWrap: { position: 'absolute', transformOrigin: '50% 0%' },
  // Placeholder border around the LCD (plain dark plastic); restyle freely.
  frame: {
    flex: 1,
    backgroundColor: '#1A1C21',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderLeftColor: 'rgba(255,255,255,0.06)',
    borderRightColor: 'rgba(0,0,0,0.35)',
    borderBottomColor: 'rgba(0,0,0,0.45)',
  },
  actions: { position: 'absolute', left: 0, right: 0 },
});
