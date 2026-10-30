import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { Card, Chips, ErrorText, Loading, makeStyles, Row, SectionTitle, Stat, useColors } from '../../components/ui';
import { api, ProductionEntry, ProductionSummary, qs } from '../../lib/api';
import { money, qty, ranges, showDate } from '../../lib/format';

const PAGE = 30;

export default function Production() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const allRanges = useMemo(() => ranges(), []);
  const [rangeKey, setRangeKey] = useState('month');
  const [search, setSearch] = useState('');
  const range = allRanges.find((r) => r.key === rangeKey)!;
  const dates = { date_from: range.from, date_to: range.to };

  const summary = useQuery({
    queryKey: ['production', 'summary', dates],
    queryFn: () => api<ProductionSummary>(`/production/summary${qs(dates)}`),
  });

  const list = useInfiniteQuery({
    queryKey: ['production', 'list', dates, search],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<ProductionEntry[]>(`/production${qs({ ...dates, q: search, page: pageParam, page_size: PAGE })}`),
    getNextPageParam: (last, pages) => (last.length === PAGE ? pages.length + 1 : undefined),
  });

  const rows = list.data?.pages.flat() ?? [];
  const t = summary.data?.totals;

  const header = (
    <View style={{ gap: 12 }}>
      <Pressable
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]}
        onPress={() => router.push({ pathname: '/production/[id]', params: { id: 'new' } })}
      >
        <Text style={styles.addText}>+ New production entry</Text>
      </Pressable>
      <Chips options={allRanges} value={rangeKey} onChange={setRangeKey} />
      {summary.isLoading ? (
        <Loading />
      ) : summary.error ? (
        <ErrorText error={summary.error} />
      ) : t ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Produced" value={qty(t.output_qty)} />
            <Stat label="Wastage" value={qty(t.wastage_qty)} />
            <Stat label="Entries" value={String(t.entries)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Material" value={money(t.material_cost)} />
            <Stat label={`EB (${qty(t.eb_units)} units)`} value={money(t.eb_cost)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Labour" value={money(t.labour_cost)} />
            <Stat label="Total cost" value={money(t.total_cost)} />
            <Stat label="Per piece" value={`₹${qty(t.output_qty ? t.total_cost / t.output_qty : 0)}`} />
          </View>
          {summary.data!.by_item.length > 0 && (
            <Card>
              <SectionTitle>Produced items</SectionTitle>
              {summary.data!.by_item.slice(0, 5).map((p) => (
                <Row
                  key={p.name}
                  left={p.name}
                  sub={`Cost ${money(p.cost)} · ₹${qty(p.qty ? p.cost / p.qty : 0)}/pc`}
                  right={qty(p.qty)}
                  onPress={() => setSearch(p.name)}
                />
              ))}
            </Card>
          )}
          {summary.data!.materials.length > 0 && (
            <Card>
              <SectionTitle>Materials used</SectionTitle>
              {summary.data!.materials.map((m) => (
                <Row key={m.name} left={m.name} right={qty(m.qty)} />
              ))}
            </Card>
          )}
        </>
      ) : null}
      <SectionTitle>Entries</SectionTitle>
      <TextInput
        style={styles.search}
        placeholder="Search item, preform or cap"
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={rows}
      keyExtractor={(r) => String(r.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <Row
          left={item.output_item}
          sub={`${showDate(item.prod_date)} · Qty ${qty(item.output_qty)} · EB ${qty(item.eb_units)} units`}
          right={money(item.total_cost)}
          onPress={() => router.push({ pathname: '/production/[id]', params: { id: String(item.id) } })}
        />
      )}
      ListEmptyComponent={
        list.isLoading ? <Loading /> : list.error ? <ErrorText error={list.error} /> : <Text style={styles.empty}>No entries</Text>
      }
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={list.isFetchingNextPage ? <Loading /> : undefined}
      refreshControl={
        <RefreshControl
          refreshing={summary.isRefetching || (list.isRefetching && !list.isFetchingNextPage)}
          onRefresh={() => {
            summary.refetch();
            list.refetch();
          }}
        />
      }
    />
  );
}

const useStyles = makeStyles((colors) => ({
  add: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
}));
