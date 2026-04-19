import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { colors } from '../../constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ base, focused }: { base: string; focused: boolean }) {
  const name = (focused ? base : `${base}-outline`) as IconName;
  return <Ionicons name={name} size={24} color={focused ? colors.accent : colors.text3} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg2,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          height: Platform.OS === 'ios' ? 84 : 62,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 10,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen name="index"        options={{ title: 'Home',         tabBarIcon: ({ focused }) => <TabIcon base="home"            focused={focused} /> }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions', tabBarIcon: ({ focused }) => <TabIcon base="swap-horizontal" focused={focused} /> }} />
      <Tabs.Screen name="budgets"      options={{ title: 'Budgets',      tabBarIcon: ({ focused }) => <TabIcon base="wallet"          focused={focused} /> }} />
      <Tabs.Screen name="health"       options={{ title: 'Health',       tabBarIcon: ({ focused }) => <TabIcon base="bar-chart"       focused={focused} /> }} />
    </Tabs>
  );
}
