import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ItemPicker, { useInventory } from '../../components/ItemPicker';
import { Card, colors, ErrorText, Loading, Row, SectionTitle } from '../../components/ui';
import { api, ProductionEntry, ProductionInput } from '../../lib/api';
import { isoDate, money, qty } from '../../lib/format';

// Numeric fields are edited as text and parsed on save.
type Form = Omit<
  ProductionInput,
  'output_qty' | 'preform_qty' | 'cap_qty' | 'wastage_qty' | 'eb_start' | 'eb_end' | 'eb_rate' | 'labour_cost'
> &
  Record<
    'output_qty' | 'preform_qty' | 'cap_qty' | 'wastage_qty' | 'eb_start' | 'eb_end' | 'eb_rate' | 'labour_cost',
    string
  >;

const blank = (): Form => ({
  prod_date: isoDate(new Date()),
  output_item: '',
  output_qty: '',
  preform_item: null,
  preform_qty: '',
  cap_item: null,
  cap_qty: '',
  wastage_qty: '',
  eb_start: '',
  eb_end: '',
  eb_rate: '',
  labour_cost: '',
  notes: null,
});

const n = (v: string) => Number(v.replace(/,/g, '')) || 0;
const str = (v: number) => (v ? String(Number(v)) : '');

const toForm = (e: ProductionEntry): Form => ({
  ...e,
  prod_date: e.prod_date.slice(0, 10),
  output_qty: str(e.output_qty),
  preform_qty: str(e.preform_qty),
  cap_qty: str(e.cap_qty),
  wastage_qty: str(e.wastage_qty),
  eb_start: str(e.eb_start),
  eb_end: str(e.eb_end),
  eb_rate: str(e.eb_rate),
  labour_cost: str(e.labour_cost),
});

export default function ProductionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useQuery({
    queryKey: ['production', 'entry', id],
    queryFn: () => api<ProductionEntry>(`/production/${id}`),
    enabled: !isNew,
  });

  if (isNew) return <ProductionForm id={id} initial={blank()} />;
  if (existing.isLoading) return <Loading />;
  if (existing.error || !existing.data) return <ErrorText error={existing.error} />;
  return <ProductionForm id={id} initial={toForm(existing.data)} saved={existing.data} />;
}

function ProductionForm({ id, initial, saved }: { id: string; initial: Form; saved?: ProductionEntry }) {
  const inventory = useInventory();
  const isNew = id === 'new';
  const router = useRouter();
  const client = useQueryClient();
  const [form, setForm] = useState<Form>(initial);
  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  const done = () => {
    client.invalidateQueries({ queryKey: ['production'] });
    router.back();
  };

  const save = useMutation({
    mutationFn: () => {
      const body: ProductionInput = {
        ...form,
        output_qty: n(form.output_qty),
        preform_qty: n(form.preform_qty),
        cap_qty: n(form.cap_qty),
        wastage_qty: n(form.wastage_qty),
        eb_start: n(form.eb_start),
        eb_end: n(form.eb_end),
        eb_rate: n(form.eb_rate),
        labour_cost: n(form.labour_cost),
        notes: form.notes?.trim() || null,
      };
      return api<ProductionEntry>(isNew ? '/production' : `/production/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(body),
      });
    },
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: () => api(`/production/${id}`, { method: 'DELETE' }),
    onSuccess: done,
  });

  const ebUnits = Math.max(n(form.eb_end) - n(form.eb_start), 0);
  const ebCost = ebUnits * n(form.eb_rate);
  // Mirror the server: an entry keeps its saved rate unless the material was changed.
  const rateOf = (kind: 'preform' | 'cap') => {
    const item = form[`${kind}_item`];
    if (!item) return 0;
    if (saved && saved[`${kind}_item`] === item) return saved[`${kind}_rate`] ?? 0;
    return inventory.data?.find((i) => i.name === item)?.rate ?? 0;
  };
  const preformRate = rateOf('preform');
  const capRate = rateOf('cap');
  const materialCost = n(form.preform_qty) * preformRate + n(form.cap_qty) * capRate;
  const total = materialCost + ebCost + n(form.labour_cost);
  const output = n(form.output_qty);

  const field = (label: string, key: keyof Form, numeric = true) => (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={(form[key] as string | null) ?? ''}
        onChangeText={set(key) as (v: string) => void}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholderTextColor={colors.muted}
        placeholder={numeric ? '0' : undefined}
      />
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: isNew ? 'New production' : 'Edit production' }} />

      <Card>
        <SectionTitle>Output</SectionTitle>
        {field('Date (YYYY-MM-DD)', 'prod_date', false)}
        <ItemPicker
          label="Produced item"
          value={form.output_item || null}
          onChange={(v) => set('output_item')(v ?? '')}
          exclude={['Preform', 'Caps']}
        />
        <View style={styles.pair}>
          {field('Quantity produced', 'output_qty')}
          {field('Wastage', 'wastage_qty')}
        </View>
      </Card>

      <Card>
        <SectionTitle>Raw materials</SectionTitle>
        <ItemPicker
          label="Preform"
          value={form.preform_item}
          onChange={set('preform_item')}
          groups={['Preform']}
          optional
        />
        {field('Preform qty', 'preform_qty')}
        <ItemPicker label="Cap" value={form.cap_item} onChange={set('cap_item')} groups={['Caps']} optional />
        {field('Cap qty', 'cap_qty')}
      </Card>

      <Card>
        <SectionTitle>Cost</SectionTitle>
        <View style={styles.pair}>
          {field('EB start reading', 'eb_start')}
          {field('EB end reading', 'eb_end')}
        </View>
        <View style={styles.pair}>
          {field('Rate / unit (₹)', 'eb_rate')}
          {field('Labour cost (₹)', 'labour_cost')}
        </View>
        <View style={{ marginTop: 10 }}>
          <Row
            left="Preform"
            sub={`${qty(n(form.preform_qty))} × ₹${qty(preformRate)}`}
            right={money(n(form.preform_qty) * preformRate)}
          />
          <Row left="Cap" sub={`${qty(n(form.cap_qty))} × ₹${qty(capRate)}`} right={money(n(form.cap_qty) * capRate)} />
          <Row left="EB units" right={qty(ebUnits)} />
          <Row left="EB cost" right={money(ebCost)} />
          <Row left="Total cost" right={money(total)} />
          <Row left="Cost per piece" right={output ? `₹${qty(total / output)}` : '—'} />
        </View>
      </Card>

      <Card>{field('Notes', 'notes', false)}</Card>

      {save.error && <ErrorText error={save.error} />}
      {remove.error && <ErrorText error={remove.error} />}

      <Pressable
        style={({ pressed }) => [styles.button, (pressed || save.isPending) && { opacity: 0.7 }]}
        disabled={save.isPending}
        onPress={() => save.mutate()}
      >
        <Text style={styles.buttonText}>{save.isPending ? 'Saving…' : 'Save'}</Text>
      </Pressable>

      {!isNew && (
        <Pressable
          style={[styles.button, styles.delete]}
          disabled={remove.isPending}
          onPress={() =>
            Alert.alert('Delete entry?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => remove.mutate(),
              },
            ])
          }
        >
          <Text style={[styles.buttonText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: 10 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  delete: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
