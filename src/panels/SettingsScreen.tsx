import Constants from 'expo-constants';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearChat } from '../conversation/chatSession';
import { describeEngines } from '../conversation/engine';
import { useWorld } from '../physics/World';
import { useSensorStatus } from '../sensors/sensorStatus';
import { feedback } from '../services/feedback';
import { kv } from '../storage/kv';
import { pickSave, useGame } from '../state/gameStore';
import { useMemories } from '../state/memoryStore';
import type { ActivityLevel, AppearancePref, ReduceMotionPref } from '../state/schema';
import { useUi } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import { confirm, ConfirmHost } from '../ui/Confirm';
import { Button, IconButton, Segmented, Toggle } from '../ui/primitives';
import { Slider } from '../ui/Slider';
import { Backdrop } from '../ui/Backdrop';
import { Toasts } from '../ui/Toasts';
import { useColors, useStyles, type Colors } from '../theme/theme';

export function SettingsScreen() {
  const styles = useStyles(makeStyles);
  const open = useUi((s) => s.settingsOpen);
  const close = () => useUi.getState().setSettingsOpen(false);
  return (
    <Modal visible={open} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={styles.flex}>
        {open && <SettingsContent onClose={close} />}
        <ConfirmHost scope="settings" />
      </GestureHandlerRootView>
    </Modal>
  );
}

function SettingsContent({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const settings = useGame((s) => s.settings);
  const name = useGame((s) => s.character.name);
  const set = useGame((s) => s.setSettings);
  const [draftName, setDraftName] = useState(name);
  const [engines, setEngines] = useState<{ label: string; available: boolean; detail: string }[]>([]);

  useEffect(() => {
    void describeEngines().then(setEngines);
  }, []);

  const toggle = (patch: Parameters<typeof set>[0]) => {
    set(patch);
    feedback('select');
  };

  return (
    <View style={[styles.flex, styles.screen, { paddingTop: insets.top }]}>
      <Backdrop />
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
        <IconButton icon="close" label="Close settings" onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Section title="Appearance">
          <Segmented<AppearancePref>
            value={settings.appearance}
            onChange={(v) => toggle({ appearance: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <Text style={styles.hint}>System follows your phone’s light or dark mode. The room’s screen looks the same either way.</Text>
        </Section>

        <Section title="Motion">
          <Row label="Tilt controls" hint="Tilt your phone to move them around the room.">
            <Toggle label="Tilt controls" value={settings.motionEnabled} onChange={(v) => toggle({ motionEnabled: v })} />
          </Row>
          {settings.motionEnabled && <MotionSettings />}
        </Section>

        <Section title="Sound & touch">
          <Row label="Sound effects" hint="Follows your phone's silent switch.">
            <Toggle label="Sound effects" value={settings.soundEnabled} onChange={(v) => toggle({ soundEnabled: v })} />
          </Row>
          <Row label="Haptics">
            <Toggle label="Haptics" value={settings.hapticsEnabled} onChange={(v) => toggle({ hapticsEnabled: v })} />
          </Row>
          <Text style={styles.label}>Reduce motion</Text>
          <Segmented<ReduceMotionPref>
            value={settings.reduceMotion}
            onChange={(v) => toggle({ reduceMotion: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Section>

        <Section title="Character">
          <Text style={styles.label}>Name</Text>
          <View style={styles.nameRow}>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              maxLength={24}
              style={styles.input}
              accessibilityLabel="Character name"
              placeholderTextColor={colors.textFaint}
            />
            <Button
              compact
              label="Save"
              disabled={!draftName.trim() || draftName.trim() === name}
              onPress={() => {
                useGame.getState().renameCharacter(draftName);
                feedback('success');
              }}
            />
          </View>
          <Text style={styles.label}>Activity</Text>
          <Segmented<ActivityLevel>
            value={settings.activityLevel}
            onChange={(v) => toggle({ activityLevel: v })}
            options={[
              { value: 'calm', label: 'Calm' },
              { value: 'normal', label: 'Normal' },
              { value: 'lively', label: 'Lively' },
            ]}
          />
          <Row label="Sleep at night" hint="Naps on its cushion late at night. Tap to wake it anytime.">
            <Toggle label="Sleep at night" value={settings.nightSleep} onChange={(v) => toggle({ nightSleep: v })} />
          </Row>
        </Section>

        <Section title="Talking">
          {engines.map((e) => (
            <View key={e.label} style={styles.engine}>
              <View style={[styles.dot, { backgroundColor: e.available ? colors.success : colors.textFaint }]} />
              <View style={styles.flex}>
                <Text style={styles.rowLabel}>
                  {e.label} {e.available ? '· in use' : '· not available'}
                </Text>
                <Text style={styles.hint}>{e.detail}</Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title="Memories & data">
          <Row label="Record milestones" hint="Adds moments like new friendship levels to Memories. You can delete them anytime.">
            <Toggle label="Record milestones" value={settings.recordMilestones} onChange={(v) => toggle({ recordMilestones: v })} />
          </Row>
          <DataActions />
        </Section>

        <Section title="Privacy">
          <Text style={styles.body}>
            Cubeit works fully offline. {name}, your memories and your settings are stored only on this device ({kv.backend === 'sqlite' ? 'in a local SQLite database' : 'in local browser storage'}). There’s no account,
            no analytics and no servers. Chat messages are never saved — only memories you choose to keep. Motion sensor data is used live to move{' '}
            {name} and is never recorded.
          </Text>
        </Section>

        <Text style={styles.version}>
          cubeit {Constants.expoConfig?.version ?? ''} · {Platform.OS}
        </Text>
      </ScrollView>
      <Toasts top={insets.top + 60} />
    </View>
  );
}

function MotionSettings() {
  const styles = useStyles(makeStyles);
  const world = useWorld();
  const settings = useGame((s) => s.settings);
  const set = useGame((s) => s.setSettings);
  const sensor = useSensorStatus();
  const [note, setNote] = useState<string | null>(null);

  const dot = useAnimatedStyle(() => {
    const t = world.tilt.value;
    return { transform: [{ translateX: Math.max(-1, Math.min(1, t.x)) * 34 }, { translateY: Math.max(-1, Math.min(1, -t.z)) * 34 }] };
  });

  const calibrate = () => {
    const t = world.tilt.value;
    if (t.hasRaw !== 1) {
      setNote('No motion data yet. Make sure tilt is on and try again.');
      return;
    }
    set({ calibration: { x: t.rawX, y: t.rawY, z: t.rawZ } });
    setNote('Neutral position saved. Hold your phone like this to keep them still.');
    feedback('success');
  };

  return (
    <>
      {sensor.available === false && (
        <Text style={styles.warning}>This device doesn’t report a motion sensor, so tilt can’t work here. Everything else does — drag to move them instead.</Text>
      )}
      {sensor.source === 'keyboard-sim' && (
        <Text style={styles.hint}>Web preview: arrow keys / WASD simulate tilting (hold Shift to tilt hard). Real tilt needs the app on a phone.</Text>
      )}
      <Text style={styles.label}>Sensitivity</Text>
      <Slider label="Tilt sensitivity" value={settings.tiltSensitivity} min={0.4} max={2} step={0.1} onChange={(v) => set({ tiltSensitivity: v })} />
      <View style={styles.calRow}>
        <View style={styles.level} accessibilityLabel="Live tilt indicator">
          <View style={styles.levelRing} />
          <Animated.View style={[styles.levelDot, dot]} />
        </View>
        <View style={[styles.flex, { gap: 8 }]}>
          <Text style={styles.hint}>
            {settings.calibration
              ? 'Using your saved neutral position.'
              : 'Neutral is set automatically when the app opens. Hold your phone comfortably and save it to keep it.'}
          </Text>
          <Button compact icon="locate-outline" label="Set neutral position" onPress={calibrate} />
          {settings.calibration && (
            <Button compact tone="ghost" label="Use automatic" onPress={() => set({ calibration: null })} />
          )}
        </View>
      </View>
      {note && <Text style={styles.hint}>{note}</Text>}
    </>
  );
}

function DataActions() {
  const styles = useStyles(makeStyles);
  const world = useWorld();
  const count = useMemories((s) => s.items.length);

  const exportData = async () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), save: pickSave(useGame.getState()), memories: useMemories.getState().items }, null, 2);
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
        useUi.getState().toast({ text: 'Your data was copied to the clipboard.', tone: 'info' });
      } else {
        await Share.share({ message: payload, title: 'Cubeit data' });
      }
    } catch {
      useUi.getState().toast({ text: 'Sharing isn’t available here.', tone: 'warning' });
    }
  };

  const deleteMemories = async () => {
    if (
      await confirm({
        title: 'Delete all memories?',
        message: `This removes all ${count} memories from this device. It can’t be undone.`,
        confirmLabel: 'Delete all',
        destructive: true,
      })
    ) {
      useMemories.getState().clear();
      feedback('warn');
    }
  };

  const resetRoom = async () => {
    if (await confirm({ title: 'Reset the room?', message: 'Furniture, theme and lighting go back to the defaults. Unlocked items stay unlocked.', confirmLabel: 'Reset room' })) {
      useGame.getState().resetRoom();
    }
  };

  const startOver = async () => {
    if (
      await confirm({
        title: 'Start over?',
        message: 'This erases your character, friendship, stars, unlocks and all memories from this device. It can’t be undone.',
        confirmLabel: 'Erase everything',
        destructive: true,
      })
    ) {
      useMemories.getState().clear();
      clearChat();
      useGame.getState().resetAll();
      world.commands.teleport(0.5, 0.3);
      useUi.getState().setSettingsOpen(false);
    }
  };

  return (
    <View style={styles.actions}>
      <Button tone="secondary" icon="share-outline" label="Export my data" onPress={() => void exportData()} />
      <Button tone="secondary" icon="home-outline" label="Reset room to default" onPress={() => void resetRoom()} />
      <Button tone="danger" icon="trash-outline" label={`Delete all memories (${count})`} disabled={count === 0} onPress={() => void deleteMemories()} />
      <Button tone="danger" icon="refresh-circle-outline" label="Start over" onPress={() => void startOver()} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: colors.bg },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 16 },
  title: { fontFamily: fonts.bold, fontSize: 26, color: colors.text, letterSpacing: -0.5 },
  content: { paddingHorizontal: 16, gap: 18 },
  section: { gap: 8 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginLeft: 2 },
  card: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: 16, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDim },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textDim, marginTop: 2 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textDim },
  warning: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.warning },
  nameRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  calRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  level: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  levelRing: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, borderColor: colors.lineStrong },
  levelDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent },
  engine: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  actions: { gap: 8 },
  version: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint, textAlign: 'center' },
});
