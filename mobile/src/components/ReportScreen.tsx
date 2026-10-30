import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { api, Kind, qs, Summary, VoucherRow } from '../lib/api';
import { money, qty, ranges, showDate } from '../lib/format';
import { Card, Chips, ErrorText, Loading, makeStyles, Row, SectionTitle, Stat, useColors } from './ui';

const PAGE = 30;

export default function ReportScreen({ kind }: { kind: Kind }) {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const allRanges = useMemo(() => ranges(), []);
  const [rangeKey, setRangeKey] = useState('month');
  const [search, setSearch] = useState('');
  const range = allRanges.find((r) => r.key === rangeKey)!;
  const dates = { date_from: range.from, date_to: range.to };

  const summary = useQuery({
    queryKey: [kind, 'summary', dates],
    queryFn: () => api<Summary>(`/${kind}/summary${qs(dates)}`),
  });

  const list = useInfiniteQuery({
    queryKey: [kind, 'vouchers', dates, search],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<VoucherRow[]>(`/${kind}/vouchers${qs({ ...dates, q: search, page: pageParam, page_size: PAGE })}`),
    getNextPageParam: (last, pages) => (last.length === PAGE ? pages.length + 1 : undefined),
  });

  const rows = list.data?.pages.flat() ?? [];
  const partyLabel = kind === 'sales' ? 'Top customers' : 'Top suppliers';

  const header = (
    <View style={{ gap: 12 }}>
      <Chips options={allRanges} value={rangeKey} onChange={setRangeKey} />
      {summary.isLoading ? (
        <Loading />
      ) : summary.error ? (
        <ErrorText error={summary.error} />
      ) : summary.data ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Amount" value={money(summary.data.totals.amount)} />
            <Stat label="Bills" value={String(summary.data.totals.vouchers)} />
            <Stat label="Qty" value={qty(summary.data.totals.qty)} />
          </View>
          {summary.data.top_parties.length > 0 && (
            <Card>
              <SectionTitle>{partyLabel}</SectionTitle>
              {summary.data.top_parties.slice(0, 5).map((p) => (
                <Row key={p.name} left={p.name} right={money(p.amount)} onPress={() => setSearch(p.name)} />
              ))}
            </Card>
          )}
          {summary.data.top_items.length > 0 && (
            <Card>
              <SectionTitle>Top items</SectionTitle>
              {summary.data.top_items.slice(0, 5).map((p) => (
                <Row key={p.name} left={p.name} sub={`Qty ${qty(p.qty)}`} right={money(p.amount)} />
              ))}
            </Card>
          )}
        </>
      ) : null}
      <SectionTitle>Bills</SectionTitle>
      <TextInput
        style={styles.search}
        placeholder="Search party, bill no or item"
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
      keyExtractor={(r) => r.voucher_no}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <Row
          left={item.party}
          sub={`#${item.voucher_no} · ${showDate(item.voucher_date)} · ${item.line_count} items`}
          right={money(item.amount)}
          onPress={() =>
            router.push({ pathname: '/voucher/[kind]/[no]', params: { kind, no: item.voucher_no } })
          }
        />
      )}
      ListEmptyComponent={
        list.isLoading ? <Loading /> : list.error ? <ErrorText error={list.error} /> : <Text style={styles.empty}>No bills</Text>
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
