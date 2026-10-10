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
import { useReminderSync } from '../planner/hooks';
import { useDailyLife } from '../progression/useDailyLife';
import { Room } from '../room/Room';
import { TiltSensorHost } from '../sensors/TiltSensorHost';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';

import { Backdrop } from '../ui/Backdrop';
import { ConfirmHost } from '../ui/Confirm';
import { Toasts } from '../ui/Toasts';
import { ActionBar, ACTION_BAR_HEIGHT } from './ActionBar';
import { Header, HEADER_HEIGHT } from './Header';
import { BEZEL, CHIN, DeviceFrame, deviceSize, HOUSING } from './DeviceFrame';
import { HomeCards, HOME_CARDS_HEIGHT } from './HomeCards';
import { Onboarding } from './Onboarding';
import { useStyles, type Colors } from '../theme/theme';

const SIDE = 16;
/** The screen takes a little less than all the room it has, so it breathes. */
const SCREEN_SCALE = 0.86;
/** Space between the device and the stat cards. */
const GROUP_GAP = 40;
/** On short screens the gap shrinks down to this to keep the LCD at least MIN_ROOM wide. */
const MIN_GROUP_GAP = 12;
const MIN_ROOM = 150;
/** The stat cards and tiles need about this much width for their labels. */
const MIN_CARDS_W = 280;
/** Space kept between the device and an open sheet. */
const SHEET_GAP = 24;

export function HomeScreen() {
  return (
    <WorldProvider>
      <HomeContent />
    </WorldProvider>
  );
}

function HomeContent() {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [root, setRoot] = useState({ w: 0, h: 0 });
  const onboarded = useGame((s) => s.settings.onboarded);
  const activeGame = useUi((s) => s.activeGame);
  const visitor = useUi((s) => s.visitor);
  useCharacterBrain();
  useDailyLife(onboarded);
  useReminderSync();

  // The device and the cards below it form one group, centered between the
  // logo bar and the nav, with a fixed gap between them and room above the nav.
  const regionTop = insets.top + HEADER_HEIGHT + 8;
  const regionBottom = root.h - insets.bottom - ACTION_BAR_HEIGHT - 8;
  const regionH = Math.max(0, regionBottom - regionTop);
  // The LCD: each dot a whole number of device pixels, so the dots stay crisp.
  const px = PixelRatio.get();
  const chromeW = (HOUSING + BEZEL) * 2;
  const chromeH = BEZEL * 2 + HOUSING + CHIN;
  const fitW = (root.w - SIDE * 2 - chromeW) * SCREEN_SCALE;
  // Short screens give up some of the gap under the device before the screen gets too small.
  const roomyH = regionH - HOME_CARDS_HEIGHT - GROUP_GAP - chromeH;
  const gap = roomyH >= MIN_ROOM ? GROUP_GAP : Math.max(MIN_GROUP_GAP, GROUP_GAP - (MIN_ROOM - roomyH));
  const fitH = regionH - HOME_CARDS_HEIGHT - gap - chromeH;
  const fit = Math.max(0, Math.min(fitW, fitH, 560));
  const roomW = (Math.floor((fit * px) / LCD_DOTS) * LCD_DOTS) / px;
  const roomH = roomW;
  const { width: frameW, height: frameH } = deviceSize(roomW);
  const groupH = frameH + gap + HOME_CARDS_HEIGHT;
  const roomTop = regionTop + Math.max(0, (regionH - groupH) / 2);
  const cardsTop = roomTop + frameH + gap;
  // As wide as the device, unless a short screen shrank it too far for the cards' labels.
  const cardsW = Math.min(root.w - SIDE * 2, Math.max(frameW, MIN_CARDS_W));

  // The open panel's top edge: the device slides up, then scales down, to stay above it.
  const panelTop = useSharedValue(10_000);
  const roomStyle = useAnimatedStyle(() => {
    const limit = panelTop.value - SHEET_GAP;
    const scale = Math.max(0.3, Math.min(1, (limit - regionTop) / frameH));
    const top = Math.max(regionTop, Math.min(roomTop, limit - frameH * scale));
    return { transform: [{ translateY: top - roomTop }, { scale }] };
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
        <View style={[styles.cards, { top: cardsTop }]} pointerEvents="box-none">
          <HomeCards width={cardsW} disabled={busy} />
        </View>
      )}
      {/* Sheets don't depend on the room's size, so the nav always opens something. */}
      {root.w > 0 && (
        <PanelHost
          panels={PANELS}
          rootHeight={root.h}
          topReserve={regionTop + 150}
          bottomInset={insets.bottom + ACTION_BAR_HEIGHT}
          panelTop={panelTop}
        />
      )}
      {/* The nav floats above everything, open sheets included. */}
      <View style={[styles.actions, { bottom: insets.bottom }]} pointerEvents="box-none">
        <ActionBar disabled={busy} />
      </View>
      <Toasts top={insets.top + HEADER_HEIGHT + 6} />
      {/* Confirm dialogs asked from the room or any sheet (Settings hosts its own). */}
      <ConfirmHost scope="home" />
      <SettingsScreen />
      {!onboarded && <Onboarding />}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  // 'clip' (web) also prevents focus changes from scrolling the clipped content.
  root: { flex: 1, backgroundColor: colors.bg, overflow: Platform.OS === 'web' ? ('clip' as ViewStyle['overflow']) : 'hidden' },
  roomWrap: { position: 'absolute', transformOrigin: '50% 0%' },
  header: { position: 'absolute', left: 0, right: 0 },
  cards: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  actions: { position: 'absolute', left: 0, right: 0 },
});
