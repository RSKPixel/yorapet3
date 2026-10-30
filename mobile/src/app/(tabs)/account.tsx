import { Pressable, Text, View } from 'react-native';
import { Card, useColors } from '../../components/ui';
import { useAuth } from '../../lib/auth';

export default function Account() {
  const colors = useColors();
  const { user, logout } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 16 }}>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{user?.full_name || user?.username}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>@{user?.username}</Text>
      </Card>
      <Pressable
        onPress={logout}
        style={{ backgroundColor: colors.card, borderRadius: 10, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
      >
        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>Sign out</Text>
      </Pressable>
    </View>
  );
}
