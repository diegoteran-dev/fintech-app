import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font } from '../../constants/theme';

export default function InvestmentsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <Text style={s.title}>Markets</Text>

      <View style={s.comingSoon}>
        <Ionicons name="trending-up" size={48} color={colors.accent} style={{ marginBottom: spacing.md }} />
        <Text style={s.heading}>Investments coming soon</Text>
        <Text style={s.sub}>
          Stock portfolio tracking, crypto prices, and inflation tools are on the roadmap.
          Connect your broker to get started.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  title:      { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  comingSoon: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  heading:    { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  sub:        { fontSize: font.sm, color: colors.text3, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
});
