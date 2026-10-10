import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ActivityKind } from '../state/schema';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import type { IconId } from '../ui/Icons';
import { IconBadge } from '../ui/primitives';
import { EmptyState, PanelHeader } from './PanelHost';
import { useStyles, type Colors } from '../theme/theme';

const KIND_ICON: Record<ActivityKind, IconId> = {
  nap: 'moon',
  play: 'ball',
  game: 'play',
  item: 'sparkle',
  visit: 'friends',
  find: 'gift',
  dance: 'heart',
  greet: 'heart',
};

function ago(at: number, now: number): string {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

/** What the character got up to (the real activity log), newest first. Opening it marks everything read. */
export function NotificationsPanel() {
  const styles = useStyles(makeStyles);
  const name = useGame((s) => s.character.name);
  const activities = useGame((s) => s.progress.activities);
  // What was unread when the sheet opened stays highlighted while it's open.
  const [seenAt] = useState(() => useGame.getState().progress.notificationsSeenAt);
  const [now] = useState(() => Date.now());
  // Opened from the Friend sheet's Activity row: Back returns there.
  const [cameFrom] = useState(() => {
    const prev = useUi.getState().previousPanel;
    return prev === 'notifications' ? 'none' : prev;
  });
  useEffect(() => {
    useGame.getState().markNotificationsSeen();
  }, [activities.length]);

  const items = [...activities].reverse();
  return (
    <View style={styles.flex}>
      <PanelHeader title="Activity" onBack={cameFrom !== 'none' ? () => void useUi.getState().openPanel(cameFrom) : undefined} />
      {items.length === 0 ? (
        <EmptyState icon="notifications-outline" title="All quiet" body={`When ${name} naps, plays or finds something, you'll see it here.`} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((a) => {
            const fresh = a.at > seenAt;
            return (
              <View key={`${a.at}-${a.text}`} style={styles.row}>
                <IconBadge icon={KIND_ICON[a.kind]} size={38} />
                <View style={styles.body}>
                  <Text style={styles.text}>
                    {name} {a.text.replace(/\bmy\b/g, 'their')}
                  </Text>
                  <Text style={styles.time}>{ago(a.at, now)}</Text>
                </View>
                {fresh && <View style={styles.dot} accessibilityLabel="New" />}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.lg, backgroundColor: colors.surface },
  body: { flex: 1, gap: 2 },
  text: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.text },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
});
