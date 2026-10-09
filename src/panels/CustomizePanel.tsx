import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { StickmanPreview } from '../character/StickmanPreview';
import { ACCESSORIES, DEFAULT_APPEARANCE, paletteById, type Appearance } from '../content/appearance';
import { itemsForSlot, SLOTS, type ItemId, type SlotId } from '../content/items';
import { LIGHTS, THEMES, themeById, type ThemeId } from '../content/themes';
import { isUnlocked, unlockKey, unlockLabel, type ContentKind, type Unlock } from '../content/unlocks';
import { bondLevel } from '../progression/progression';
import { buy } from '../progression/rewards';
import { Bitmap } from '../lcd/bitmap';
import { LcdTile } from '../lcd/LcdArt';
import { drawBackdrop, itemPreview } from '../room/items/pixelArt';
import { emit } from '../services/bus';
import { feedback } from '../services/feedback';
import { defaultRoom, type RoomConfig } from '../state/schema';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import { confirm } from '../ui/Confirm';
import { Button, PressableScale, Segmented, StarCount } from '../ui/primitives';
import { PanelHeader } from './PanelHost';
import { useColors, useStyles, type Colors } from '../theme/theme';

type Tab = 'room' | 'furniture' | 'look';

interface Selection {
  kind: ContentKind;
  id: string;
  name: string;
  unlock: Unlock;
}

/**
 * Edit a draft of the room and character. The room above previews the draft
 * live; nothing is saved until "Apply". Closing the panel discards the draft.
 */
export function CustomizePanel() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const savedRoom = useGame((s) => s.room);
  const savedLook = useGame((s) => s.character.appearance);
  const progress = useGame((s) => s.progress);
  const draft = useUi((s) => s.draft);
  const setDraft = useUi((s) => s.setDraft);
  const [tab, setTab] = useState<Tab>('room');
  const level = bondLevel(progress.bondXp);

  useEffect(() => {
    setDraft({ room: useGame.getState().room, appearance: useGame.getState().character.appearance });
    return () => setDraft(null);
  }, [setDraft]);

  const room = draft?.room ?? savedRoom;
  const look = draft?.appearance ?? savedLook;
  const setRoom = (patch: Partial<RoomConfig>) => setDraft({ room: { ...room, ...patch }, appearance: look });
  const setItem = (slot: SlotId, item: ItemId | null) => setRoom({ items: { ...room.items, [slot]: item } });
  const setLook = (patch: Partial<Appearance>) => setDraft({ room, appearance: { ...look, ...patch } });

  const unlocked = (sel: Pick<Selection, 'kind' | 'id' | 'unlock'>) =>
    isUnlocked(unlockKey(sel.kind, sel.id), sel.unlock, progress.unlocked, level);

  // Everything currently picked in the draft, to find what's still locked.
  const selections = useMemo<Selection[]>(() => {
    const theme = themeById(room.theme);
    const light = LIGHTS.find((l) => l.id === room.light)!;
    const color = paletteById(look.bodyColor);
    const acc = ACCESSORIES.find((a) => a.id === look.accessory)!;
    const items = SLOTS.flatMap((slot) => {
      const id = room.items[slot.id];
      const def = id ? itemsForSlot(slot.id).find((i) => i.id === id) : undefined;
      return def ? [{ kind: 'item' as const, id: def.id, name: def.name, unlock: def.unlock }] : [];
    });
    return [
      { kind: 'theme', id: theme.id, name: theme.name, unlock: theme.unlock },
      { kind: 'light', id: light.id, name: light.name, unlock: light.unlock },
      { kind: 'color', id: color.id, name: color.name, unlock: color.unlock },
      { kind: 'accessory', id: acc.id, name: acc.name, unlock: acc.unlock },
      ...items,
    ];
  }, [room, look]);
  const locked = selections.filter((s) => !unlocked(s));
  const dirty = JSON.stringify({ room, look }) !== JSON.stringify({ room: savedRoom, look: savedLook });

  const apply = () => {
    useGame.getState().applyCustomization(room, look);
    feedback('success');
    emit({ type: 'customizeApplied' });
    useUi.getState().closePanel();
  };

  const restoreDefaults = async () => {
    const ok = await confirm({
      title: 'Restore the default room?',
      message: 'This previews the original room and look. Tap Apply afterwards to keep it. Unlocked items stay unlocked.',
      confirmLabel: 'Restore',
    });
    if (ok) setDraft({ room: defaultRoom(), appearance: { ...DEFAULT_APPEARANCE } });
  };

  const option = (sel: Selection, selected: boolean, onSelect: () => void, preview: ReactNode) => (
    <OptionCard
      key={`${sel.kind}:${sel.id}`}
      name={sel.name}
      selected={selected}
      locked={!unlocked(sel)}
      lockLabel={unlockLabel(sel.unlock)}
      onPress={onSelect}
      preview={preview}
    />
  );

  return (
    <View style={styles.flex}>
      <PanelHeader title="Customize" right={<StarCount value={progress.stars} />} />
      <View style={styles.tabs}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'room', label: 'Room' },
            { value: 'furniture', label: 'Furniture' },
            { value: 'look', label: 'Look' },
          ]}
        />
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {tab === 'room' && (
          <>
            <Text style={styles.group}>Theme</Text>
            <Row>
              {THEMES.map((t) =>
                option({ kind: 'theme', id: t.id, name: t.name, unlock: t.unlock }, room.theme === t.id, () => setRoom({ theme: t.id }), (
                  <ThemeTile theme={t.id} />
                )),
              )}
            </Row>
          </>
        )}
        {tab === 'furniture' &&
          SLOTS.map((slot) => (
            <View key={slot.id}>
              <Text style={styles.group}>{slot.name}</Text>
              <Row>
                {slot.allowEmpty && (
                  <OptionCard
                    name="None"
                    selected={room.items[slot.id] === null}
                    locked={false}
                    lockLabel=""
                    onPress={() => setItem(slot.id, null)}
                    preview={<Ionicons name="remove-circle-outline" size={26} color={colors.textFaint} />}
                  />
                )}
                {itemsForSlot(slot.id).map((item) => {
                  const art = slot.id === 'toy' ? null : itemPreview(slot.id, item.id);
                  return option({ kind: 'item', id: item.id, name: item.name, unlock: item.unlock }, room.items[slot.id] === item.id, () => setItem(slot.id, item.id), (
                    art ? <LcdTile bitmap={art} size={52} /> : <LcdTile bitmap={BALL_TILE} size={52} />
                  ));
                })}
              </Row>
            </View>
          ))}
        {tab === 'look' && (
          <>
            <Text style={styles.group}>Accessory</Text>
            <Row>
              {ACCESSORIES.map((a) =>
                option({ kind: 'accessory', id: a.id, name: a.name, unlock: a.unlock }, look.accessory === a.id, () => setLook({ accessory: a.id }), (
                  <StickmanPreview accessory={a.id} size={52} />
                )),
              )}
            </Row>
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {locked.length > 0 ? (
          <UnlockBar selection={locked[0]} stars={progress.stars} />
        ) : (
          <View style={styles.footerRow}>
            <Button label="Restore defaults" tone="ghost" compact onPress={() => void restoreDefaults()} />
            <Button label="Apply" icon="checkmark" disabled={!dirty} onPress={apply} style={styles.apply} />
          </View>
        )}
      </View>
    </View>
  );
}

function UnlockBar({ selection, stars }: { selection: Selection; stars: number }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { unlock } = selection;
  if (unlock.kind === 'stars') {
    const affordable = stars >= unlock.cost;
    return (
      <View style={styles.footerRow}>
        <Text style={styles.lockText} numberOfLines={2}>
          Previewing {selection.name}.{affordable ? '' : ` You need ${unlock.cost - stars} more stars — play games to earn them.`}
        </Text>
        <Button
          compact
          icon="star"
          label={`Unlock · ${unlock.cost}`}
          disabled={!affordable}
          onPress={() => buy(unlockKey(selection.kind, selection.id), unlock.cost)}
        />
      </View>
    );
  }
  return (
    <View style={styles.footerRow}>
      <Ionicons name="heart" size={16} color={colors.danger} />
      <Text style={styles.lockText}>
        {selection.name} opens at friendship level {unlock.kind === 'bond' ? unlock.level : 1}. Spend time together to get there.
      </Text>
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}

function OptionCard({
  name,
  selected,
  locked,
  lockLabel,
  onPress,
  preview,
}: {
  name: string;
  selected: boolean;
  locked: boolean;
  lockLabel: string;
  onPress: () => void;
  preview: ReactNode;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name}${locked ? `, locked, ${lockLabel}` : ''}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <View style={[styles.preview, locked && { opacity: 0.55 }]}>{preview}</View>
      <Text style={styles.optionName} numberOfLines={1}>
        {name}
      </Text>
      {locked && (
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={10} color={colors.text} />
          <Text style={styles.lockLabel}>{lockLabel}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 16, paddingBottom: 6 },
  content: { paddingBottom: 12 },
  group: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  noGrow: { flexGrow: 0 },
  row: { paddingHorizontal: 16, gap: 10, alignItems: 'flex-start' },
  option: {
    width: 86,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 6,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  optionSelected: { borderColor: colors.brand },
  preview: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  optionName: { fontFamily: fonts.medium, fontSize: 12, color: colors.text, maxWidth: 76 },
  lock: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ink,
  },
  lockLabel: { fontFamily: fonts.bold, fontSize: 9, color: colors.onInk },
  footer: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48 },
  apply: { minWidth: 120 },
  lockText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textDim },
});

const BALL_TILE = new Bitmap(10, 10).sprite(['.####.', '#oooo#', '#o##o#', '#oooo#', '#oooo#', '.####.'], 2, 2);

function ThemeTile({ theme }: { theme: ThemeId }) {
  const bitmap = useMemo(() => drawBackdrop(theme, 16).fill(0, 13, 16, 1), [theme]);
  return <LcdTile bitmap={bitmap} size={52} />;
}
