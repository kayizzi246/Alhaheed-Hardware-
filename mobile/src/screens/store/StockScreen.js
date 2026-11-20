import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { money, dateTime } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import {
  Screen, Card, Chip, Button, Field, Input, Banner, Empty, Loading, SectionTitle,
} from '../../components/ui';

/** Stock levels, goods received and adjustments. */
export default function StockScreen() {
  const [stock, setStock] = useState(null);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [acting, setActing] = useState(null);     // { product, mode }
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (lowOnly) params.set('low', '1');
      setStock((await api(`/api/store/stock?${params}`)).stock);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, [search, lowOnly]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (stock === null) return <Loading label="Loading stock…" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Field>
        <Input value={search} onChangeText={setSearch} placeholder="Search by name or code" />
      </Field>

      <View style={s.filterRow}>
        <Pressable
          onPress={() => setLowOnly((v) => !v)}
          style={[s.filter, lowOnly && { backgroundColor: colors.orange, borderColor: colors.orange }]}
        >
          <Text style={[s.filterText, lowOnly && { color: '#fff' }]}>Low stock only</Text>
        </Pressable>
      </View>

      <Banner>{error}</Banner>
      <Banner kind="ok">{notice}</Banner>

      <SectionTitle>STOCK · {stock.length} PRODUCT{stock.length === 1 ? '' : 'S'}</SectionTitle>

      {stock.length === 0 ? (
        <Empty>No products match.</Empty>
      ) : (
        stock.map((p) => (
          <Card key={p.id}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.meta}>{p.code} · {money(p.price)} per {p.unit}</Text>
                <Text style={s.meta}>Reorder at {p.reorder_level} · {p.supplier || 'No supplier'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={s.qty}>{p.stock_available}</Text>
                {p.stock_available <= p.reorder_level && <Chip tone="red">Low</Chip>}
              </View>
            </View>

            <View style={s.actions}>
              <Button title="Goods received" variant="ghost" small
                      onPress={() => setActing({ product: p, mode: 'receive' })} />
              <Button title="Adjust" variant="ghost" small
                      onPress={() => setActing({ product: p, mode: 'adjust' })} />
            </View>
          </Card>
        ))
      )}

      {acting && (
        <StockSheet
          {...acting}
          onClose={() => setActing(null)}
          onDone={(msg) => {
            setActing(null);
            setNotice(msg);
            setTimeout(() => setNotice(''), 4000);
            load();
          }}
        />
      )}
    </Screen>
  );
}

function StockSheet({ product, mode, onClose, onDone }) {
  const receiving = mode === 'receive';
  const [quantity, setQuantity] = useState('');
  const [supplier, setSupplier] = useState(product.supplier || '');
  const [reason, setReason] = useState('');
  const [sign, setSign] = useState(-1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(''); setBusy(true);
    try {
      const qty = Math.trunc(Number(quantity));
      if (receiving) {
        await api('/api/store/stock/receive', {
          method: 'POST',
          body: { productId: product.id, quantity: qty, supplier: supplier || null },
        });
        onDone(`${qty} ${product.unit} of ${product.name} received.`);
      } else {
        await api('/api/store/stock/adjust', {
          method: 'POST',
          body: { productId: product.id, quantity: qty * sign, reason },
        });
        onDone(`${product.name} stock adjusted.`);
      }
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>
              {receiving ? 'Goods received' : 'Stock adjustment'}
            </Text>
            <Text style={s.sheetLead}>
              {product.name} · currently {product.stock_available} {product.unit}
            </Text>

            <Banner>{error}</Banner>

            {!receiving && (
              <Field label="Direction">
                <View style={s.toggle}>
                  {[[1, 'Increase'], [-1, 'Decrease']].map(([v, l]) => (
                    <Pressable
                      key={l}
                      onPress={() => setSign(v)}
                      style={[s.toggleBtn, sign === v && s.toggleOn]}
                    >
                      <Text style={[s.toggleText, sign === v && s.toggleTextOn]}>{l}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
            )}

            <Field label={`Quantity (${product.unit})`}>
              <Input value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
            </Field>

            {receiving ? (
              <Field label="Supplier">
                <Input value={supplier} onChangeText={setSupplier} placeholder="Hima Cement Ltd" />
              </Field>
            ) : (
              <Field label="Reason">
                <Input value={reason} onChangeText={setReason} placeholder="Damaged in store / stock count" multiline />
              </Field>
            )}

            <Button
              title={receiving ? 'Record goods received' : 'Record adjustment'}
              onPress={submit}
              busy={busy}
              disabled={!Number(quantity) || (!receiving && reason.trim().length < 2)}
            />
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 9 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 3 },
  qty: { fontSize: 19, fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  filter: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
  filterText: { fontSize: 12.5, fontWeight: '600', color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,36,57,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetLead: { fontSize: 12.5, color: colors.muted, marginTop: 4, marginBottom: 16 },
  toggle: { flexDirection: 'row', backgroundColor: '#eef2f6', borderRadius: radius.sm, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center' },
  toggleOn: { backgroundColor: '#fff' },
  toggleText: { fontSize: 12.5, color: colors.muted, fontWeight: '600' },
  toggleTextOn: { color: colors.text },
});
