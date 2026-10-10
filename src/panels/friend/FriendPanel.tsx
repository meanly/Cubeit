import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FINDS } from '../../content/finds';
import type { Memory } from '../../memory/types';
import { useGame } from '../../state/gameStore';
import { useMemories } from '../../state/memoryStore';
import { useUi } from '../../state/uiStore';
import { useStyles } from '../../theme/theme';
import { IconButton } from '../../ui/primitives';
import { PanelHeader } from '../PanelHost';
import { Group, LinkRow, SectionHeader } from '../planner/ui';
import { About, FindsGrid, MemoryEditor, MemoryList } from './memoryViews';

type Route = { name: 'memories' } | { name: 'memory'; memory: Memory | null } | { name: 'finds' };

/**
 * The character's own sheet, opened from the Friendship card on Home: how
 * your friendship is going, what it remembers about you, the little
 * treasures it collects and what it got up to (the Notifications sheet).
 * Kept out of the Planner, which is for your day.
 */
export function FriendPanel() {
  const styles = useStyles(makeStyles);
  const name = useGame((s) => s.character.name);
  const found = useGame((s) => s.progress.finds.length);
  const memoryCount = useMemories((s) => s.items.length);
  const unread = useGame((s) => s.progress.activities.filter((a) => a.at > s.progress.notificationsSeenAt).length);
  const [stack, setStack] = useState<Route[]>([]);
  const open = (r: Route) => setStack((s) => [...s, r]);
  const back = () => setStack((s) => s.slice(0, -1));

  const route = stack[stack.length - 1];
  if (route?.name === 'memory') return <MemoryEditor memory={route.memory} onDone={back} />;
  if (route?.name === 'memories') {
    return (
      <View style={styles.flex}>
        <PanelHeader title="Memories" onBack={back} right={<IconButton icon="add" label="New memory" onPress={() => open({ name: 'memory', memory: null })} />} />
        <MemoryList onOpen={(m) => open({ name: 'memory', memory: m })} />
      </View>
    );
  }
  if (route?.name === 'finds') {
    return (
      <View style={styles.flex}>
        <PanelHeader title="Finds" onBack={back} />
        <FindsGrid />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <PanelHeader title={name} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
        <Group>
          <LinkRow
            icon="bookmark-outline"
            title="Memories"
            detail={memoryCount > 0 ? `${memoryCount} saved · facts you asked ${name} to remember` : `Facts you ask ${name} to remember, like a birthday`}
            onPress={() => open({ name: 'memories' })}
          />
          <LinkRow icon="gift-outline" title="Finds" detail={`${found}/${FINDS.length} · a small treasure each day you visit`} onPress={() => open({ name: 'finds' })} />
          <LinkRow
            icon="notifications-outline"
            title="Activity"
            detail={unread > 0 ? `${unread} new · what ${name} got up to` : `What ${name} got up to while you were away`}
            onPress={() => void useUi.getState().openPanel('notifications')}
          />
        </Group>
        <SectionHeader title={`About ${name}`} />
        <About />
      </ScrollView>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 8 },
  });
