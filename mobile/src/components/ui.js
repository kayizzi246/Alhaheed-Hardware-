import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, ScrollView, RefreshControl,
} from 'react-native';
import { colors, radius, shadow } from '../lib/theme';

export function Screen({ children, refreshing, onRefresh, scroll = true, padded = true }) {
  if (!scroll) {
    return <View style={[s.screen, padded && s.padded]}>{children}</View>;
  }
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[padded && s.padded, { paddingBottom: 32 }]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function AppHeader({ title, subtitle, right }) {
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle}>
          AL HADEED <Text style={{ color: colors.orange }}>HARDWARE</Text>
        </Text>
        {!!subtitle && <Text style={s.headerSub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp style={[s.card, shadow, style]} onPress={onPress}>
      {children}
    </Comp>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <View style={[s.stat, shadow]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text
        style={[
          s.statValue,
          tone === 'green' && { color: colors.green },
          tone === 'red' && { color: colors.red },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

export function StatRow({ children }) {
  return <View style={s.statRow}>{children}</View>;
}

const CHIP = {
  pending: [colors.amberBg, colors.amber],
  blue: [colors.blueBg, colors.blue],
  green: [colors.greenBg, colors.green],
  red: [colors.redBg, colors.red],
  grey: ['#eef2f6', colors.muted],
};

export function Chip({ tone = 'grey', children }) {
  const [bg, fg] = CHIP[tone] || CHIP.grey;
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, busy, style, small }) {
  const palette = {
    primary: [colors.orange, '#fff'],
    navy: [colors.navy, '#fff'],
    green: [colors.green, '#fff'],
    ghost: ['#fff', colors.text],
    danger: ['#fff', colors.red],
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.button,
        small && s.buttonSmall,
        { backgroundColor: palette[0] },
        (variant === 'ghost' || variant === 'danger') && {
          borderWidth: 1,
          borderColor: variant === 'danger' ? '#e9b7b7' : colors.border,
        },
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette[1]} size="small" />
      ) : (
        <Text style={[s.buttonText, small && { fontSize: 12.5 }, { color: palette[1] }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && <Text style={s.label}>{label}</Text>}
      {children}
      {!!error && <Text style={s.fieldError}>{error}</Text>}
    </View>
  );
}

export function Input(props) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[s.input, props.multiline && { height: 80, textAlignVertical: 'top' }, props.style]}
    />
  );
}

export function Banner({ kind = 'error', children }) {
  if (!children) return null;
  const bg = kind === 'ok' ? colors.greenBg : colors.redBg;
  const fg = kind === 'ok' ? colors.green : colors.red;
  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 13 }}>{children}</Text>
    </View>
  );
}

export function Empty({ children }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText}>{children}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <View style={s.empty}>
      <ActivityIndicator color={colors.orange} />
      <Text style={[s.emptyText, { marginTop: 10 }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={s.sectionTitleRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function KeyValue({ k, v, bold }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvKey}>{k}</Text>
      <Text style={[s.kvValue, bold && { fontWeight: '700' }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: 14 },

  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  headerSub: { color: '#8fa8c2', fontSize: 11.5, marginTop: 3 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },

  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  statLabel: { fontSize: 11, color: colors.muted, marginBottom: 6 },
  statValue: { fontSize: 17, fontWeight: '700', color: colors.text },

  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  chipText: { fontSize: 11.5, fontWeight: '700' },

  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { paddingVertical: 7, paddingHorizontal: 12 },
  buttonText: { fontWeight: '700', fontSize: 14 },

  label: { fontSize: 12, color: colors.muted, marginBottom: 5, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
    fontSize: 14,
    color: colors.text,
  },
  fieldError: { color: colors.red, fontSize: 11.5, marginTop: 4 },

  banner: { padding: 11, borderRadius: radius.sm, marginBottom: 12 },

  empty: { padding: 34, alignItems: 'center' },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center' },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: colors.muted, letterSpacing: 0.7 },

  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 12 },
  kvKey: { color: colors.muted, fontSize: 13 },
  kvValue: { color: colors.text, fontSize: 13, flexShrink: 1, textAlign: 'right' },
});

export { s as uiStyles };
