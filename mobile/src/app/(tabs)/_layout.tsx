import { Tabs } from 'expo-router';
import { ColorValue, Text } from 'react-native';
import { colors } from '../../components/ui';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
  <Text style={{ color, fontSize: 20 }}>{glyph}</Text>
);

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Sales', tabBarIcon: icon('₹') }} />
      <Tabs.Screen name="purchases" options={{ title: 'Purchases', tabBarIcon: icon('⇩') }} />
      <Tabs.Screen name="production" options={{ title: 'Production', tabBarIcon: icon('⚙') }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('☺') }} />
    </Tabs>
  );
}
