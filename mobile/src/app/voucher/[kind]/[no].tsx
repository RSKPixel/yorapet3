import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Card, colors, ErrorText, Loading, Row, SectionTitle } from '../../../components/ui';
import { api, VoucherDetail } from '../../../lib/api';
import { money, qty, showDate } from '../../../lib/format';

export default function Voucher() {
  const { kind, no } = useLocalSearchParams<{ kind: string; no: string }>();
  const { data, error, isLoading } = useQuery({
    queryKey: [kind, 'voucher', no],
    queryFn: () => api<VoucherDetail>(`/${kind}/vouchers/${encodeURIComponent(no)}`),
  });

  const title = `${kind === 'sales' ? 'Sales' : 'Purchase'} #${no}`;
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorText error={error} />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title }} />
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{data.party}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          {showDate(data.voucher_date)}
          {data.broker ? ` · Broker: ${data.broker}` : ''}
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primary, marginTop: 10 }}>{money(data.total)}</Text>
      </Card>
      <Card>
        <SectionTitle>Items ({data.lines.length})</SectionTitle>
        {data.lines.map((l, i) => (
          <Row
            key={i}
            left={l.stock_item}
            sub={`${qty(l.qty)} × ₹${qty(l.rate)}${l.brand ? ` · ${l.brand}` : ''}`}
            right={money(l.amount)}
          />
        ))}
        <View style={{ height: 4 }} />
      </Card>
    </ScrollView>
  );
}
