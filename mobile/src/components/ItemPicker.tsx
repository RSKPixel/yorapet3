import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { api, InventoryItem } from '../lib/api';
import { qty } from '../lib/format';
import { makeStyles, Row, useColors } from './ui';

export function useInventory() {
  return useQuery({
    queryKey: ['production', 'items'],
    queryFn: () => api<InventoryItem[]>('/production/items'),
    staleTime: 10 * 60_000,
  });
}

// Tap-to-open list of Tally stock items, optionally narrowed to some stock groups.
export default function ItemPicker({
  label,
  value,
  onChange,
  groups,
  exclude,
  optional,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  groups?: string[];
  exclude?: string[];
  optional?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data } = useInventory();

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (i) =>
        (!groups || groups.includes(i.group)) &&
        (!exclude || !exclude.includes(i.group)) &&
        (!q || i.name.toLowerCase().includes(q)),
    );
  }, [data, groups, exclude, search]);

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={{ color: value ? colors.text : colors.muted, fontSize: 15 }} numberOfLines={1}>
          {value ?? 'Select item'}
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Close</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.field}
            placeholder="Search item"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          <FlatList
            data={items}
            keyExtractor={(i) => i.name}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={optional ? <Row left="None" right="" onPress={() => pick(null)} /> : undefined}
            renderItem={({ item }) => (
              <Row left={item.name} sub={item.rate != null ? `${item.group} · ₹${qty(item.rate)}` : item.group} right={item.name === value ? '✓' : ''} onPress={() => pick(item.name)} />
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  label: { color: colors.muted, fontSize: 12, marginBottom: 4, marginTop: 10 },
  field: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
}));
