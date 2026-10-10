import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { StickmanPreview } from '../character/StickmanPreview';
import { createSimulatedNearby } from '../nearby/simulatedNearby';
import type { NearbyPeer } from '../nearby/types';
import { feedback } from '../services/feedback';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import { Button } from '../ui/primitives';
import { PanelHeader } from './PanelHost';
import { useColors, useStyles, type Colors } from '../theme/theme';

type Phase = 'intro' | 'searching' | 'found' | 'inviting' | 'declined';

export function NearbyPanel() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const service = useMemo(() => createSimulatedNearby(), []);
  const name = useGame((s) => s.character.name);
  const [phase, setPhase] = useState<Phase>('intro');
  const [peer, setPeer] = useState<NearbyPeer | null>(null);
  const stop = useRef<(() => void) | null>(null);
  // Where this sheet was opened from, fixed at open (Home's Friends tile has nothing to go back to).
  const [cameFrom] = useState(() => {
    const prev = useUi.getState().previousPanel;
    return prev === 'nearby' ? 'none' : prev;
  });

  useEffect(() => () => stop.current?.(), []);

  const search = async () => {
    if (!(await service.requestPermissions())) return;
    setPhase('searching');
    stop.current = service.startDiscovery((p) => {
      setPeer(p);
      setPhase('found');
      feedback('select');
    });
  };

  const invite = async () => {
    if (!peer) return;
    setPhase('inviting');
    const result = await service.invite(peer);
    if (result !== 'accepted') {
      setPhase('declined');
      return;
    }
    feedback('success');
    const ui = useUi.getState();
    ui.closePanel();
    ui.setVisitor({ name: peer.name, appearance: peer.appearance, simulated: true });
  };

  return (
    <View style={styles.flex}>
      {/* Back only when there's somewhere to go back to (it can be opened from Play or from Home). */}
      <PanelHeader title="Nearby friends" onBack={cameFrom !== 'none' ? () => void useUi.getState().openPanel(cameFrom) : undefined} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <Ionicons name="flask-outline" size={13} color={colors.warning} />
          <Text style={styles.badgeText}>Simulation · no real devices</Text>
        </View>

        {phase === 'intro' && (
          <>
            <Text style={styles.title}>Let {name} meet other cubelings</Text>
            <Text style={styles.body}>
              In a future version, two phones close together will be able to find each other over Bluetooth so your characters can visit. This preview
              runs a local simulation of that flow — it doesn’t search for or connect to anything.
            </Text>
            <Bullet icon="hand-left-outline" text="Both people will have to approve every visit." />
            <Bullet icon="eye-off-outline" text="Only a character’s name and look will be shared — nothing about you." />
            <Bullet icon="bluetooth-outline" text="Bluetooth permission will be asked for only when you open this." />
            <Button label="Start a simulated visit" icon="sparkles" onPress={() => void search()} style={styles.cta} />
          </>
        )}

        {phase === 'searching' && (
          <Animated.View entering={FadeIn} style={styles.center}>
            <Ionicons name="radio-outline" size={34} color={colors.accent} />
            <Text style={styles.body}>Looking for cubelings… (simulated)</Text>
            <Button
              label="Cancel"
              tone="ghost"
              onPress={() => {
                stop.current?.();
                setPhase('intro');
              }}
            />
          </Animated.View>
        )}

        {(phase === 'found' || phase === 'inviting' || phase === 'declined') && peer && (
          <Animated.View entering={FadeIn} style={styles.peer}>
            <View style={styles.avatar}>
              <StickmanPreview accessory={peer.appearance.accessory} size={64} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.peerName}>{peer.name}</Text>
              <Text style={styles.peerMeta}>Simulated friend</Text>
            </View>
            {phase === 'found' && <Button compact label="Invite" icon="paper-plane-outline" onPress={() => void invite()} />}
          </Animated.View>
        )}
        {phase === 'inviting' && <Text style={styles.body}>Waiting for them to accept… (simulated)</Text>}
        {phase === 'declined' && <Text style={styles.body}>They couldn’t visit right now. Maybe later!</Text>}
      </ScrollView>
    </View>
  );
}

function Bullet({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.bullet}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 20, gap: 12 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.warningSoft,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.warning },
  title: { fontFamily: fonts.black, fontSize: 18, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textDim },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  cta: { marginTop: 6 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  peer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  avatar: { width: 64, height: 64 },
  peerName: { fontFamily: fonts.black, fontSize: 17, color: colors.text },
  peerMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.warning },
});
