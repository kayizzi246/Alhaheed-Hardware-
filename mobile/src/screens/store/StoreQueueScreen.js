import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/AuthContext';
import { money, time } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import {
  Screen, AppHeader, Card, Chip, Button, Field, Input, Banner, Empty, Loading,
  Stat, StatRow, SectionTitle,
} from '../../components/ui';

/** Fig 6: Store Manager App - Release Goods & Stock. */
export default function StoreQueueScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [packed, setPacked] = useState({});       // local pick-and-pack ticks
  const [releasing, setReleasing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('/api/store/queue')); setError(''); }
    catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const refresh = () => load();
    s.on('order:updated', refresh);
    return () => { s.off('order:updated', refresh); };
  }, [load]);

  if (!data) return <Loading label="Loading the store queue…" />;
  const sm = data.summary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader subtitle={`Store Manager · ${user?.fullName}`} />

      <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        <StatRow>
          <Stat label="To pick" value={sm.toPick} />
          <Stat label="Released today" value={sm.releasedToday} />
          <Stat label="Low stock" value={sm.lowStock} tone={sm.lowStock > 0 ? 'red' : undefined} />
        </StatRow>

        <Banner>{error}</Banner>
        <Banner kind="ok">{notice}</Banner>

        <SectionTitle>APPROVED ORDERS TO RELEASE</SectionTitle>

        {data.orders.length === 0 ? (
          <Empty>No approved orders are waiting to be released.</Empty>
        ) : (
          data.orders.map((o) => (
            <Card key={o.id}>
              <View style={s.head}>
                <View style={{ flex: 1 }}>
                  <Text style={s.orderNo}>#{o.order_no}</Text>
                  <Text style={s.meta}>
                    {o.company_name || o.ordered_by_name} ·{' '}
                    {o.fulfilment === 'delivery' ? 'Delivery' : 'Pick-up'}
                  </Text>
                  {!!o.delivery_address && <Text style={s.meta}>{o.delivery_address}</Text>}
                  <Text style={s.meta}>{time(o.created_at)} · {money(o.total)}</Text>
                </View>
                <Chip tone="green">Approved</Chip>
              </View>

              <View style={s.items}>
                {o.items.map((i) => (
                  <Text key={i.id} style={s.item}>
                    • {i.product_name} × {i.quantity} {i.unit}
                  </Text>
                ))}
              </View>

              <View style={s.actions}>
                <Button
                  title={packed[o.id] ? '✓ Packed' : 'Mark Packed'}
                  variant={packed[o.id] ? 'green' : 'ghost'}
                  small
                  onPress={() => setPacked((p) => ({ ...p, [o.id]: !p[o.id] }))}
                />
                <Button
                  title="Release Goods"
                  small
                  disabled={!packed[o.id]}
                  onPress={() => setReleasing(o)}
                />
              </View>
              {!packed[o.id] && (
                <Text style={s.hint}>Tick &ldquo;Mark Packed&rdquo; once the items are picked and packed.</Text>
              )}
            </Card>
          ))
        )}

        {data.lowStock.length > 0 && (
          <>
            <SectionTitle>LOW STOCK ALERTS</SectionTitle>
            {data.lowStock.map((p) => (
              <Card key={p.id}>
                <View style={s.head}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName}>{p.name}</Text>
                    <Text style={s.meta}>
                      {p.stock_available} {p.unit} left · reorder at {p.reorder_level}
                    </Text>
                  </View>
                  <Chip tone="red">Low</Chip>
                </View>
              </Card>
            ))}
          </>
        )}
      </Screen>

      {releasing && (
        <ReleaseSheet
          order={releasing}
          onClose={() => setReleasing(null)}
          onDone={() => {
            setNotice(`#${releasing.order_no} released. Stock has been updated.`);
            setTimeout(() => setNotice(''), 4000);
            setReleasing(null);
            load();
          }}
        />
      )}
    </View>
  );
}

function ReleaseSheet({ order, onClose, onDone }) {
  const [collectedBy, setCollectedBy] = useState(order.ordered_by_name || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isDelivery = order.fulfilment === 'delivery';

  async function submit() {
    setError(''); setBusy(true);
    try {
      await api(`/api/store/orders/${order.id}/release`, {
        method: 'POST',
        body: {
          collectedBy,
          deliveryStatus: isDelivery ? 'Dispatched for delivery' : 'Collected at shop',
          notes: notes || null,
        },
      });
      onDone();
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>Release goods · #{order.order_no}</Text>
            <Text style={s.sheetLead}>
              Stock will be reduced for every item on this order and the customer notified.
            </Text>

            <Banner>{error}</Banner>

            <View style={s.summary}>
              {order.items.map((i) => (
                <View key={i.id} style={s.summaryRow}>
                  <Text style={s.summaryName}>{i.product_name}</Text>
                  <Text style={s.summaryQty}>{i.quantity} {i.unit}</Text>
                </View>
              ))}
            </View>

            <Field label={isDelivery ? 'Driver / delivered by' : 'Collected by'}>
              <Input value={collectedBy} onChangeText={setCollectedBy} placeholder="Name of the person" />
            </Field>

            <Field label="Notes (optional)">
              <Input value={notes} onChangeText={setNotes} placeholder="Truck UAX 123B" multiline />
            </Field>

            <Button
              title={isDelivery ? 'Dispatch & update stock' : 'Release & update stock'}
              variant="green"
              onPress={submit}
              busy={busy}
              disabled={collectedBy.trim().length < 2}
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
  orderNo: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  items: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 4,
  },
  item: { fontSize: 12.5, color: colors.text },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  hint: { fontSize: 11, color: colors.muted, marginTop: 8 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,36,57,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetLead: { fontSize: 12.5, color: colors.muted, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  summary: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: 12, marginBottom: 16, gap: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  summaryName: { fontSize: 12.5, color: colors.text, flex: 1 },
  summaryQty: { fontSize: 12.5, fontWeight: '700', color: colors.text },
});
