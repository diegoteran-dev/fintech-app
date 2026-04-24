import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../constants/theme';

function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ymLabel(ym: string) {
  return new Date(ym + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

interface Props {
  value: string | null;              // YYYY-MM or null for "All time"
  onChange: (ym: string | null) => void;
  allowAllTime?: boolean;             // adds a toggle button for "All time" (null)
}

/**
 * Chevron-arrow month picker. Disables forward arrow past the current month.
 * If `allowAllTime` is true, rendering a null value shows "All time" and
 * surfaces a button that toggles back to the current month.
 */
export function MonthPicker({ value, onChange, allowAllTime }: Props) {
  const current = ymOf(new Date());
  const isCurrent = value === current;

  function shift(delta: number) {
    const base = value ?? current;
    const d = new Date(base + '-02');
    d.setMonth(d.getMonth() + delta);
    onChange(ymOf(d));
  }

  return (
    <View style={s.row}>
      <TouchableOpacity onPress={() => shift(-1)} style={s.btn}>
        <Ionicons name="chevron-back" size={18} color={colors.text2} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => allowAllTime && onChange(value === null ? current : null)}
        disabled={!allowAllTime}
        style={{ flex: 1, alignItems: 'center' }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={s.label}>{value === null ? 'All time' : ymLabel(value)}</Text>
        {allowAllTime && value !== null && (
          <Text style={s.subLabel}>tap for all time</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => shift(1)}
        style={s.btn}
        disabled={value !== null && isCurrent}
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={value !== null && isCurrent ? colors.text3 : colors.text2}
        />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: 4 },
  btn:      { padding: 6 },
  label:    { fontSize: 14, fontWeight: '700', color: colors.text },
  subLabel: { fontSize: 9, color: colors.text3, marginTop: 1 },
});
