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
import { Backdrop } from '../ui/Backdrop';
import { Toasts } from '../ui/Toasts';
import { ActionBar, ACTION_BAR_HEIGHT } from './ActionBar';
import { Header, HEADER_HEIGHT } from './Header';
import { BEZEL, CHIN, DeviceFrame, deviceSize, HOUSING } from './DeviceFrame';
import { HomeCards, HOME_CARDS_HEIGHT } from './HomeCards';
import { Onboarding } from './Onboarding';

const SIDE = 16;
/** The screen takes a little less than all the room it has, so it breathes. */
const SCREEN_SCALE = 0.86;

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
  const stageBottom = root.h - insets.bottom - ACTION_BAR_HEIGHT - HOME_CARDS_HEIGHT;
  const stageH = Math.max(0, stageBottom - stageTop);
  // A full-width ink card with the square LCD centered in it. Each dot is a
  // whole number of device pixels so the dots stay crisp.
  const px = PixelRatio.get();
  // The LCD (each dot a whole number of device pixels, so the dots stay
  // crisp) mounted in its device, centered in the space between the greeting
  // and the cards.
  const chromeW = (HOUSING + BEZEL) * 2;
  const chromeH = BEZEL * 2 + HOUSING + CHIN;
  const space = Math.max(0, Math.min(root.w - SIDE * 2 - chromeW, 560, stageH - 24 - chromeH));
  const fit = space * SCREEN_SCALE;
  const roomW = (Math.floor((fit * px) / LCD_DOTS) * LCD_DOTS) / px;
  const roomH = roomW;
  const { width: frameW, height: frameH } = deviceSize(roomW);
  // Must match the resting position computed in roomStyle below (translateY 0 when no panel is open).
  const roomTop = stageTop + (stageH - frameH) / 2;

  // The open panel's top edge; the device scales down to fit above it.
  const panelTop = useSharedValue(10_000);
  const roomStyle = useAnimatedStyle(() => {
    const bottom = Math.min(stageBottom, panelTop.value) - 10;
    const available = bottom - stageTop - 4;
    const scale = Math.max(0.3, Math.min(1, available / frameH));
    const top = stageTop + 4 + (available - frameH * scale) / 2;
    return { transform: [{ translateY: Math.min(0, top - roomTop) }, { scale }] };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== root.w || height !== root.h) setRoot({ w: width, h: height });
  };

  const ready = root.w > 0 && roomW > 100;
  const busy = activeGame !== null || visitor !== null;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <TiltSensorHost />
      <Backdrop />
      <View style={[styles.header, { top: insets.top }]} pointerEvents="box-none">
        <Header />
      </View>
      {ready && (
        <Animated.View
          style={[styles.roomWrap, { top: roomTop, left: (root.w - frameW) / 2, width: frameW, height: frameH }, roomStyle]}
        >
          <DeviceFrame>
            <Room width={roomW} height={roomH} overlay={<GameHud />}>
              {visitor && <VisitorLayer roomWidth={roomW} roomHeight={roomH} />}
              <GameHost roomWidth={roomW} roomHeight={roomH} />
            </Room>
          </DeviceFrame>
        </Animated.View>
      )}
      {ready && (
        <View style={[styles.cards, { top: stageBottom }]} pointerEvents="box-none">
          <HomeCards disabled={busy} />
        </View>
      )}
      {ready && (
        <PanelHost
          panels={PANELS}
          rootHeight={root.h}
          topReserve={stageTop + 150}
          bottomInset={insets.bottom + ACTION_BAR_HEIGHT}
          panelTop={panelTop}
        />
      )}
      {/* The nav floats above everything, open sheets included. */}
      <View style={[styles.actions, { bottom: insets.bottom }]} pointerEvents="box-none">
        <ActionBar disabled={busy} />
      </View>
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
  header: { position: 'absolute', left: 0, right: 0 },
  cards: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  actions: { position: 'absolute', left: 0, right: 0 },
});
