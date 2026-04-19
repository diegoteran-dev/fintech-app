import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS = [
  { name: 'index',        label: 'Home',    base: 'home'           },
  { name: 'transactions', label: 'Txns',    base: 'swap-horizontal'},
  { name: 'budgets',      label: 'Budgets', base: 'wallet'         },
  { name: 'health',       label: 'Health',  base: 'bar-chart'      },
  { name: 'investments',  label: 'Markets', base: 'trending-up'    },
] as const;

function GlassTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.shadow, { bottom: insets.bottom + 10 }]}>
      <View style={s.pill}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={s.row}>
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index;
            const tab = TABS.find(t => t.name === route.name);
            if (!tab) return null;
            const iconName = (focused ? tab.base : `${tab.base}-outline`) as IconName;
            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                style={s.tab}
                activeOpacity={0.65}
              >
                <View style={[s.iconBg, focused && s.iconBgActive]}>
                  <Ionicons name={iconName} size={22} color={focused ? colors.accent : colors.text3} />
                </View>
                <Text style={[s.label, { color: focused ? colors.accent : colors.text3 }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"        options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="budgets"      options={{ title: 'Budgets' }} />
      <Tabs.Screen name="health"       options={{ title: 'Health' }} />
      <Tabs.Screen name="investments"  options={{ title: 'Markets' }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  shadow: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 28,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    // Android elevation
    elevation: 20,
  },
  pill: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(13,17,23,0.93)' : 'transparent',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  iconBg: {
    width: 42,
    height: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBgActive: {
    backgroundColor: 'rgba(124,58,237,0.20)',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
