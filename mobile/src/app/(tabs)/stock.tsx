import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { Chips, colors, ErrorText, Loading, Row, Stat } from '../../components/ui';
import { api, Stock as StockData } from '../../lib/api';
import { money, qty, showDate } from '../../lib/format';

export default function Stock() {
  const [group, setGroup] = useState('all');
  const [search, setSearch] = useState('');
  const { data, error, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['stock'],
    queryFn: () => api<StockData>('/stock'),
  });

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (i) => (group === 'all' || i.stock_group === group) && (!q || i.stock_item.toLowerCase().includes(q)),
    );
  }, [data, group, search]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorText error={error} />;

  const groups = [{ key: 'all', label: 'All' }, ...(data?.groups ?? []).map((g) => ({ key: g.name, label: g.name }))];
  const total = items.reduce((sum, i) => sum + (i.closing_value ?? 0), 0);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(i) => i.stock_group + i.stock_item}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 6 }}>
          {data?.period && (
            <Text style={{ color: colors.muted }}>
              As on {showDate(data.period.period_to)}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Items" value={String(items.length)} />
            <Stat label="Closing value" value={money(total)} />
          </View>
          <Chips options={groups} value={group} onChange={setGroup} />
          <TextInput
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 15,
              color: colors.text,
            }}
            placeholder="Search item"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      }
      renderItem={({ item }) => (
        <Row
          left={item.stock_item}
          sub={`${item.stock_group} · Rate ₹${qty(item.closing_rate)}`}
          right={item.closing || '0'}
        />
      )}
      ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'center', marginTop: 24 }}>No items</Text>}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />}
    />
  );
}
