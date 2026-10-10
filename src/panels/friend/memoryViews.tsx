import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import { MOOD_TEXT, moodLabel } from '../../character/mood';
import { FINDS } from '../../content/finds';
import { parseTags } from '../../memory/memoryDoc';
import { checkSensitive } from '../../memory/sensitive';
import { MEMORY_TYPE_LABELS, USER_MEMORY_TYPES, type Memory, type MemoryType } from '../../memory/types';
import { bondProgress, IDLE_UNLOCKS } from '../../progression/progression';
import { grantXp } from '../../progression/rewards';
import { useGame } from '../../state/gameStore';
import { useMemories } from '../../state/memoryStore';
import { fonts, radii } from '../../theme/tokens';
import { confirm } from '../../ui/Confirm';
import { Button, Chip, PressableScale, type IconName } from '../../ui/primitives';
import { EmptyState, PanelHeader } from '../PanelHost';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { Group, Muted } from '../planner/ui';

type Filter = 'all' | 'mine' | 'favorite' | 'moments';

const TYPE_ICON: Record<MemoryType, IconName> = {
  note: 'document-text-outline',
  fact: 'bookmark-outline',
  favorite: 'heart-outline',
  event: 'calendar-outline',
  milestone: 'trophy-outline',
  experience: 'sparkles-outline',
  encounter: 'people-outline',
};

const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** Saved long-term memories (only ever ones the user approved or wrote). */
export function MemoryList({ onOpen }: { onOpen: (m: Memory) => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const items = useMemories((s) => s.items);
  const name = useGame((s) => s.character.name);
  const [filter, setFilter] = useState<Filter>('all');
  const shown = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
    switch (filter) {
      case 'mine':
        return sorted.filter((m) => m.type === 'note' || m.type === 'fact' || m.type === 'event');
      case 'favorite':
        return sorted.filter((m) => m.type === 'favorite');
      case 'moments':
        return sorted.filter((m) => m.type === 'milestone' || m.type === 'experience' || m.type === 'encounter');
      default:
        return sorted;
    }
  }, [items, filter]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
      {items.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.filters}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Notes & facts" selected={filter === 'mine'} onPress={() => setFilter('mine')} />
          <Chip label="Favorites" selected={filter === 'favorite'} onPress={() => setFilter('favorite')} />
          <Chip label="Moments" selected={filter === 'moments'} onPress={() => setFilter('moments')} />
        </ScrollView>
      )}
      {shown.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title={items.length === 0 ? 'No memories yet' : 'Nothing here'}
          body={
            items.length === 0
              ? `Tap + to write one, or tell ${name} “remember that…” in Talk. Memories stay on this device.`
              : 'Try another filter.'
          }
        />
      ) : (
        <Group>
          {shown.map((m) => (
            <PressableScale key={m.id} accessibilityRole="button" accessibilityHint="Opens the memory to edit or delete" onPress={() => onOpen(m)} style={styles.memory}>
              <View style={styles.memoryIcon}>
                <Ionicons name={TYPE_ICON[m.type]} size={18} color={colors.accent} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.memoryText} numberOfLines={3}>
                  {m.content}
                </Text>
                <Text style={styles.memoryMeta}>
                  {MEMORY_TYPE_LABELS[m.type]} · {formatDate(m.createdAt)}
                  {m.importance >= 3 ? ' · ★ important' : ''}
                  {m.tags.length > 0 ? ` · ${m.tags.map((t) => `#${t}`).join(' ')}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </PressableScale>
          ))}
        </Group>
      )}
      <Muted>{name} only recalls memories you chose to keep. Chats are never saved automatically.</Muted>
    </ScrollView>
  );
}

export function MemoryEditor({ memory, onDone }: { memory: Memory | null; onDone: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [type, setType] = useState<MemoryType>(memory?.type ?? 'note');
  const [content, setContent] = useState(memory?.content ?? '');
  const [tags, setTags] = useState(memory?.tags.join(', ') ?? '');
  const [importance, setImportance] = useState<1 | 2 | 3>(memory?.importance ?? 2);
  const sensitive = checkSensitive(content);
  const canSave = content.trim().length > 0;
  // App-made memories (milestones, visits) keep their type; only their text and tags can change.
  const typeOptions = memory && !USER_MEMORY_TYPES.includes(memory.type) ? [memory.type] : USER_MEMORY_TYPES;

  const save = () => {
    if (!canSave) return;
    const store = useMemories.getState();
    if (memory) {
      store.update(memory.id, { type, content, tags: parseTags(tags), importance });
    } else {
      store.add({ type, content, tags: parseTags(tags), importance, source: 'user' });
      grantXp('memory');
    }
    onDone();
  };

  const remove = async () => {
    if (!memory) return;
    const ok = await confirm({
      title: 'Delete this memory?',
      message: 'It will be removed from this device for good.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) {
      useMemories.getState().remove(memory.id);
      onDone();
    }
  };

  return (
    <View style={styles.flex}>
      <PanelHeader title={memory ? 'Edit memory' : 'New memory'} onBack={onDone} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.editor} keyboardShouldPersistTaps="handled">
        <View style={styles.typeRow}>
          {typeOptions.map((t) => (
            <Chip key={t} label={MEMORY_TYPE_LABELS[t]} icon={TYPE_ICON[t]} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Something worth remembering…"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={400}
          style={[styles.input, styles.inputMulti]}
          accessibilityLabel="Memory text"
        />
        {sensitive.sensitive && (
          <Text style={styles.warning}>
            Heads up: this may include {sensitive.reasons.join(', ')}. It only stays on this device, but you might not want to keep it here.
          </Text>
        )}
        <TextInput
          value={tags}
          onChangeText={setTags}
          placeholder="Tags, separated by commas (optional)"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoCapitalize="none"
          accessibilityLabel="Tags"
        />
        <View style={styles.importance}>
          <Text style={styles.importanceLabel}>Importance</Text>
          {[1, 2, 3].map((n) => (
            <PressableScale
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`Importance ${n}`}
              accessibilityState={{ selected: importance === n }}
              onPress={() => setImportance(n as 1 | 2 | 3)}
              hitSlop={6}
            >
              <Ionicons name={n <= importance ? 'star' : 'star-outline'} size={22} color={colors.star} />
            </PressableScale>
          ))}
        </View>
        <View style={styles.editorActions}>
          {memory && <Button label="Delete" tone="danger" icon="trash-outline" onPress={() => void remove()} />}
          <Button label="Save" icon="checkmark" disabled={!canSave} onPress={save} style={styles.flex} />
        </View>
      </ScrollView>
    </View>
  );
}

export function FindsGrid() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const owned = useGame((s) => s.progress.finds);
  const name = useGame((s) => s.character.name);
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
      <Text style={styles.note}>
        {name} finds one small treasure on each day you visit — no rush, nothing is lost by skipping days. {owned.length}/{FINDS.length} found.
      </Text>
      <View style={styles.grid}>
        {FINDS.map((f) => {
          const has = owned.includes(f.id);
          return (
            <View key={f.id} style={styles.find} accessibilityLabel={has ? `${f.name}: ${f.blurb}` : 'Not found yet'}>
              <Svg width={40} height={40} viewBox="0 0 40 40">
                <Ellipse cx={20} cy={22} rx={14} ry={13} fill={has ? f.color : colors.surfacePressed} />
                {has && <Ellipse cx={15} cy={16} rx={5} ry={3.5} fill={f.accent} opacity={0.9} />}
              </Svg>
              <Text style={styles.findName} numberOfLines={2}>
                {has ? f.name : '???'}
              </Text>
              {has && (
                <Text style={styles.findBlurb} numberOfLines={2}>
                  {f.blurb}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function About() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { character, progress, mood } = useGame();
  const bond = bondProgress(progress.bondXp);
  const [now] = useState(() => Date.now());
  const days = Math.floor((now - character.bornAt) / 86_400_000);
  const p = character.personality;
  const favorite =
    (progress.gamesPlayed.starCatch ?? 0) + (progress.gamesPlayed.peekaboo ?? 0) === 0
      ? 'Still deciding'
      : (progress.gamesPlayed.starCatch ?? 0) >= (progress.gamesPlayed.peekaboo ?? 0)
        ? 'Star Catch'
        : 'Peekaboo';
  return (
    <View style={styles.aboutWrap}>
      <View style={styles.aboutCard}>
        <Text style={styles.aboutName}>{character.name}</Text>
        <Text style={styles.aboutMeta}>
          Woke up {formatDate(character.bornAt)} · {days < 1 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`} · feeling{' '}
          {MOOD_TEXT[moodLabel(mood)].toLowerCase()}
        </Text>
        <Text style={styles.aboutLabel}>Friendship level {bond.level}</Text>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.round(bond.fraction * 100)}%` }]} />
        </View>
        <Text style={styles.aboutHint}>{bond.toNext === null ? 'Best friends, all the way.' : 'Grows as you talk, play and spend time together.'}</Text>
      </View>
      <View style={styles.aboutCard}>
        <Text style={styles.aboutLabel}>Personality</Text>
        <Trait label="Curious" value={p.curiosity} />
        <Trait label="Playful" value={p.playfulness} />
        <Trait label="Calm" value={p.calm} />
        <Text style={styles.aboutHint}>Shifts a little with what you do together. Favorite game: {favorite}.</Text>
      </View>
      <View style={styles.aboutCard}>
        <Text style={styles.aboutLabel}>Little habits</Text>
        {IDLE_UNLOCKS.map((u) => (
          <View key={u.id} style={styles.habit}>
            <Ionicons name={bond.level >= u.level ? 'checkmark-circle' : 'lock-closed-outline'} size={16} color={bond.level >= u.level ? colors.success : colors.textFaint} />
            <Text style={[styles.habitText, bond.level < u.level && { color: colors.textFaint }]}>
              {u.name}
              {bond.level < u.level ? ` · friendship ${u.level}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Trait({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.trait}>
      <Text style={styles.traitLabel}>{label}</Text>
      <View style={[styles.bar, styles.flex]}>
        <View style={[styles.barFill, { width: `${Math.round(value * 100)}%`, backgroundColor: colors.brand }]} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 16, paddingBottom: 6 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20, gap: 10 },
  noGrow: { flexGrow: 0 },
  filters: { gap: 8, paddingVertical: 4, alignItems: 'center' },
  memory: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  memoryIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  memoryText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.text },
  memoryMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint, marginTop: 3 },
  editor: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  warning: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.warning },
  importance: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  importanceLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textDim, marginRight: 6 },
  editorActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textDim, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  find: {
    width: '30.5%',
    alignItems: 'center',
    padding: 10,
    gap: 4,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  findName: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, textAlign: 'center' },
  findBlurb: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, color: colors.textFaint, textAlign: 'center' },
  aboutWrap: { gap: 10 },
  aboutCard: { padding: 14, borderRadius: radii.lg, backgroundColor: colors.surface, gap: 8 },
  aboutName: { fontFamily: fonts.black, fontSize: 22, color: colors.text },
  aboutMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDim },
  aboutLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, marginTop: 4 },
  aboutHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surfacePressed, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.brand },
  trait: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  traitLabel: { width: 64, fontFamily: fonts.medium, fontSize: 13, color: colors.textDim },
  habit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  habitText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
});
