import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { money, dateTime, time, statusLabel, statusTone, methodLabel } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import { Screen, Card, Chip, Button, Loading, Banner, KeyValue, SectionTitle } from '../../components/ui';

/** Fig 3: Customer App - Live Order Tracking. */
export default function OrderTrackScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api(`/api/orders/${orderId}/track`)); }
    catch (e) { setError(e.message); }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onUpdate = (o) => { if (!o || o.id === orderId) load(); };
    s.on('order:updated', onUpdate);
    s.on('notification', () => load());
    return () => { s.off('order:updated', onUpdate); };
  }, [load, orderId]);

  async function cancel() {
    Alert.alert('Cancel this order?', 'This cannot be undone.', [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try { await api(`/api/orders/${orderId}/cancel`, { method: 'POST', body: { reason: 'Cancelled by customer' } }); load(); }
          catch (e) { setError(e.message); }
          finally { setBusy(false); }
        },
      },
    ]);
  }

  if (!data) return <Loading label="Loading order…" />;

  const { order, progress } = data;

  return (
    <Screen>
      <Card>
        <View style={s.head}>
          <View>
            <Text style={s.orderNo}>Order #{order.order_no}</Text>
            <Text style={s.meta}>
              {order.items.length} item{order.items.length === 1 ? '' : 's'} · {money(order.total)}
            </Text>
          </View>
          <Chip tone={statusTone(order.status)}>{statusLabel(order.status)}</Chip>
        </View>
      </Card>

      <SectionTitle>ORDER PROGRESS</SectionTitle>
      <Card>
        {progress.map((step, i) => {
          const current = !step.done && progress.findIndex((p) => !p.done) === i;
          return (
            <View key={step.key} style={s.stepRow}>
              <View style={s.railCol}>
                <View
                  style={[
                    s.dot,
                    step.done && { backgroundColor: colors.green, borderColor: colors.green },
                    current && { backgroundColor: colors.orange, borderColor: colors.orange },
                  ]}
                />
                {i < progress.length - 1 && (
                  <View style={[s.rail, step.done && { backgroundColor: colors.green }]} />
                )}
              </View>

              <View style={{ flex: 1, paddingBottom: 18 }}>
                <Text style={[s.stepLabel, (step.done || current) && { color: colors.text }]}>
                  {step.label}
                </Text>
                <Text style={s.stepMeta}>
                  {step.at ? dateTime(step.at) : current ? 'In progress' : 'Waiting'}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>

      <SectionTitle>ITEMS</SectionTitle>
      <Card>
        {order.items.map((i) => (
          <View key={i.id} style={s.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{i.product_name}</Text>
              <Text style={s.meta}>{i.quantity} {i.unit} × {money(i.unit_price)}</Text>
            </View>
            <Text style={s.itemTotal}>{money(i.line_total)}</Text>
          </View>
        ))}
        <View style={s.divider} />
        <KeyValue k="Subtotal" v={money(order.subtotal)} />
        {order.delivery_fee > 0 && <KeyValue k="Delivery" v={money(order.delivery_fee)} />}
        <KeyValue k="Total" v={money(order.total)} bold />
      </Card>

      {order.payment && (
        <>
          <SectionTitle>RECEIPT</SectionTitle>
          <Card>
            <KeyValue k="Receipt No." v={order.payment.receipt_no} />
            <KeyValue k="Method" v={methodLabel(order.payment.method)} />
            {!!order.payment.transaction_ref && <KeyValue k="Reference" v={order.payment.transaction_ref} />}
            <KeyValue k="Amount paid" v={money(order.payment.amount_paid)} bold />
            <KeyValue k="Received by" v={order.payment.cashier_name} />
            <KeyValue k="Date" v={dateTime(order.payment.created_at)} />
          </Card>
        </>
      )}

      <SectionTitle>DELIVERY</SectionTitle>
      <Card>
        <KeyValue k="Method" v={order.fulfilment === 'delivery' ? 'Delivery to site' : 'Pick-up at shop'} />
        {!!order.delivery_address && <KeyValue k="Address" v={order.delivery_address} />}
        {!!order.notes && <KeyValue k="Notes" v={order.notes} />}
      </Card>

      <SectionTitle>HISTORY</SectionTitle>
      <Card>
        {order.events.map((e) => (
          <View key={e.id} style={s.eventRow}>
            <Text style={s.eventTime}>{time(e.created_at)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.eventAction}>{e.action.replace(/_/g, ' ')}</Text>
              <Text style={s.meta}>{e.handler_name}{e.notes ? ` · ${e.notes}` : ''}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Banner>{error}</Banner>

      {order.status === 'pending_payment' && (
        <Button title="Cancel order" variant="danger" onPress={cancel} busy={busy} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNo: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },

  stepRow: { flexDirection: 'row', gap: 12 },
  railCol: { alignItems: 'center', width: 18 },
  dot: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2,
    borderColor: colors.border, backgroundColor: '#fff', marginTop: 2,
  },
  rail: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  stepLabel: { fontSize: 13.5, fontWeight: '600', color: colors.muted },
  stepMeta: { fontSize: 11.5, color: colors.muted, marginTop: 2 },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 12 },
  itemName: { fontSize: 13.5, color: colors.text, fontWeight: '600' },
  itemTotal: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

  eventRow: { flexDirection: 'row', gap: 12, paddingVertical: 5 },
  eventTime: { fontSize: 11.5, color: colors.muted, width: 46 },
  eventAction: { fontSize: 13, color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
});
