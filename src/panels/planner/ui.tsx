import { Ionicons } from '@expo/vector-icons';
import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { parseTime } from '../../assistant/dateParse';
import { addDays, addMonths, dayDate, formatDay, formatMonth, formatTime, monthGrid, WEEKDAY_SHORT, type DayKey, type TimeOfDay } from '../../planner/dates';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts, radii } from '../../theme/tokens';
import { IconButton, PressableScale, type IconName } from '../../ui/primitives';

/** Labeled text input in the planner's style. */
export function Field({ label, hint, error, ...props }: TextInputProps & { label?: string; hint?: string; error?: string | null }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, props.multiline && styles.inputMulti, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Label({ children }: { children: string }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.label}>{children}</Text>;
}

/** A round check button. */
export function Check({ checked, onPress, label, size = 26 }: { checked: boolean; onPress: () => void; label: string; size?: number }) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: checked ? colors.success : colors.lineStrong,
        backgroundColor: checked ? colors.success : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && <Ionicons name="checkmark" size={size * 0.62} color={colors.onAccent} />}
    </PressableScale>
  );
}

/** A tappable card row. `flat` drops the background, for rows inside a Group. */
export function Card({ children, onPress, style, label, flat }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string; flat?: boolean }) {
  const styles = useStyles(makeStyles);
  const look = [styles.card, flat && styles.flat, style];
  if (!onPress) return <View style={look}>{children}</View>;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={look}>
      {children}
    </PressableScale>
  );
}

/** One rounded surface holding rows separated by hairlines (instead of a bubble per row). */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  const items = Children.toArray(children).filter(isValidElement);
  if (items.length === 0) return null;
  return (
    <View style={[styles.group, style]}>
      {items.map((item, i) => (
        <Fragment key={item.key ?? i}>
          {i > 0 && <View style={styles.divider} />}
          {item}
        </Fragment>
      ))}
    </View>
  );
}

/** A row inside a Group that opens something: icon, title, optional detail, chevron. */
export function LinkRow({ icon, title, detail, onPress, tint }: { icon: IconName; title: string; detail?: string; onPress: () => void; tint?: string }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Card flat onPress={onPress} label={detail ? `${title}, ${detail}` : title}>
      <Ionicons name={icon} size={20} color={tint ?? colors.brand} />
      <View style={styles.linkText}>
        <Text style={styles.linkTitle} numberOfLines={2}>
          {title}
        </Text>
        {detail ? <Text style={styles.hint}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Card>
  );
}

/** Flat text tabs with an underline: the planner's one level of navigation. */
export function TabBar<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.tabBar} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(o.value)} style={styles.tab}>
            <Text style={[styles.tabText, selected && styles.tabTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
            <View style={[styles.tabLine, selected && styles.tabLineOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.muted}>{children}</Text>;
}

/** Month grid with dots for marked days. Used by the calendar and the date picker. */
export function MonthGridView({
  month,
  selected,
  today,
  marks,
  onSelect,
  compact,
}: {
  month: DayKey;
  selected: DayKey | null;
  today: DayKey;
  marks?: ReadonlySet<DayKey>;
  onSelect: (day: DayKey) => void;
  compact?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const weeks = monthGrid(month);
  const monthIdx = dayDate(month).getMonth();
  const cell = compact ? 34 : 40;
  return (
    <View>
      <View style={styles.weekHead}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <Text key={d} style={[styles.weekHeadText, { width: `${100 / 7}%` }]}>
            {WEEKDAY_SHORT[d].slice(0, 2)}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.weekRow}>
          {week.map((day) => {
            const d = dayDate(day);
            const inMonth = d.getMonth() === monthIdx;
            const isSel = day === selected;
            const isToday = day === today;
            return (
              <PressableScale
                key={day}
                haptic={false}
                accessibilityRole="button"
                accessibilityLabel={`${formatDay(day, today)}${marks?.has(day) ? ', has events' : ''}`}
                accessibilityState={{ selected: isSel }}
                onPress={() => onSelect(day)}
                style={[styles.dayCell, { width: `${100 / 7}%`, height: cell }]}
              >
                <View style={[styles.dayInner, { width: cell - 6, height: cell - 6, borderRadius: (cell - 6) / 2 }, isSel && { backgroundColor: colors.brand }, !isSel && isToday && styles.todayRing]}>
                  <Text style={[styles.dayText, !inMonth && { color: colors.textFaint }, isSel && { color: colors.onAccent }]}>{d.getDate()}</Text>
                </View>
                {marks?.has(day) && <View style={[styles.dot, isSel && { backgroundColor: colors.brand }]} />}
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** "Tomorrow · Tue, Oct 13", or just the date when it isn't near today. */
export function dayText(day: DayKey, today: DayKey): string {
  const rel = formatDay(day, today);
  const abs = formatDay(day, today, { relative: false });
  return rel === abs ? abs : `${rel} · ${abs}`;
}

/** Date picker: steppers plus an expandable month grid. */
export function DateField({ label, value, today, onChange, onClear }: { label: string; value: DayKey | null; today: DayKey; onChange: (d: DayKey) => void; onClear?: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value ?? today);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateRow}>
        <IconButton icon="chevron-back" label="Previous day" onPress={() => value && onChange(addDays(value, -1))} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatDay(value, today) : 'none'}. Opens a calendar`}
          onPress={() => {
            setMonth(value ?? today);
            setOpen((o) => !o);
            if (!value) onChange(today);
          }}
          style={styles.dateValue}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.brand} />
          <Text style={styles.dateText}>{value ? dayText(value, today) : 'No date'}</Text>
        </PressableScale>
        <IconButton icon="chevron-forward" label="Next day" onPress={() => onChange(addDays(value ?? today, value ? 1 : 0))} />
        {onClear && value && <IconButton icon="close" label={`Clear ${label}`} onPress={onClear} />}
      </View>
      {open && (
        <View style={styles.picker}>
          <View style={styles.monthNav}>
            <IconButton icon="chevron-back" label="Previous month" onPress={() => setMonth(addMonths(month, -1, 1))} />
            <Text style={styles.monthTitle}>{formatMonth(month)}</Text>
            <IconButton icon="chevron-forward" label="Next month" onPress={() => setMonth(addMonths(month, 1, 1))} />
          </View>
          <MonthGridView
            compact
            month={month}
            selected={value}
            today={today}
            onSelect={(d) => {
              onChange(d);
              setOpen(false);
            }}
          />
        </View>
      )}
    </View>
  );
}

/** Free-text time ("3pm", "15:30", "noon") validated as you type. */
export function TimeField({ label, value, onChange, placeholder }: { label: string; value: TimeOfDay | null; onChange: (t: TimeOfDay | null, valid: boolean) => void; placeholder?: string }) {
  const [text, setText] = useState(value ? formatTime(value) : '');
  const parsed = text.trim() ? parseTime(text) : null;
  const invalid = text.trim().length > 0 && !parsed;
  return (
    <Field
      label={label}
      value={text}
      onChangeText={(t) => {
        setText(t);
        const p = t.trim() ? parseTime(t) : null;
        onChange(p, !t.trim() || !!p);
      }}
      placeholder={placeholder ?? 'e.g. 3:30 pm'}
      autoCapitalize="none"
      autoCorrect={false}
      error={invalid ? 'Try a time like 9am, 3:30 pm or 15:00.' : null}
      hint={parsed ? formatTime(parsed) : undefined}
    />
  );
}

export const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    field: { gap: 6 },
    label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDim },
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
    inputMulti: { minHeight: 120, textAlignVertical: 'top' },
    error: { fontFamily: fonts.regular, fontSize: 12, color: colors.danger },
    hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.md, backgroundColor: colors.surface },
    flat: { backgroundColor: 'transparent', borderRadius: 0 },
    group: { borderRadius: radii.md, backgroundColor: colors.surface, overflow: 'hidden' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong, marginLeft: 12 },
    linkText: { flex: 1, gap: 2 },
    linkTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
    tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineStrong },
    tab: { flex: 1, alignItems: 'center', paddingTop: 6, minHeight: 40, justifyContent: 'space-between' },
    tabText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textFaint },
    tabTextOn: { color: colors.text, fontFamily: fonts.bold },
    tabLine: { height: 2.5, alignSelf: 'stretch', marginHorizontal: 10, borderRadius: 2, backgroundColor: 'transparent' },
    tabLineOn: { backgroundColor: colors.brand },
    section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28, marginTop: 12 },
    sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.6 },
    muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textFaint },
    weekHead: { flexDirection: 'row' },
    weekHeadText: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint, paddingVertical: 4 },
    weekRow: { flexDirection: 'row' },
    dayCell: { alignItems: 'center', justifyContent: 'center' },
    dayInner: { alignItems: 'center', justifyContent: 'center' },
    todayRing: { borderWidth: 1.5, borderColor: colors.brand },
    dayText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
    dot: { position: 'absolute', bottom: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dateValue: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: radii.md, backgroundColor: colors.surface },
    dateText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
    picker: { padding: 8, borderRadius: radii.md, backgroundColor: colors.surface },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    monthTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  });
