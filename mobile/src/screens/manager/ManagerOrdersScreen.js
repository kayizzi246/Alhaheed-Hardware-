import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { money, dateTime, statusLabel, statusTone } from '../../lib/format';
import { colors } from '../../lib/theme';
import {
  Screen, Card, Chip, Button, Input, Field, Banner, Empty, Loading, SectionTitle,
} from '../../components/ui';

const FILTERS = [
  ['', 'All'],
  ['pending_payment', 'At Cashier'],
  ['paid', 'At Accounts'],
  ['payment_verified', 'At Store'],
  ['released', 'Completed'],
];

/** The manager's view of the whole order register, at every stage. */
export default function ManagerOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      setOrders((await api(`/api/orders?${params}`)).orders);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, [status, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function cancel(order) {
    Alert.alert(`Cancel #${order.order_no}?`, 'The customer will be notified.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/orders/${order.id}/cancel`, {
              method: 'POST',
              body: { reason: 'Cancelled by the manager' },
            });
            load();
          } catch (e) { setError(e.message); }
        },
      },
    ]);
  }

  if (orders === null) return <Loading label="Loading orders…" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Field>
        <Input value={q} onChangeText={setQ} placeholder="Search order no, customer or company" />
      </Field>

      <View style={s.filters}>
        {FILTERS.map(([v, l]) => (
          <Pressable
            key={l}
            onPress={() => setStatus(v)}
            style={[s.filter, status === v && { backgroundColor: colors.orange, borderColor: colors.orange }]}
          >
            <Text style={[s.filterText, status === v && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <Banner>{error}</Banner>
      <SectionTitle>{orders.length} ORDER{orders.length === 1 ? '' : 'S'}</SectionTitle>

      {orders.length === 0 ? (
        <Empty>No orders match.</Empty>
      ) : (
        orders.map((o) => (
          <Card key={o.id} onPress={() => navigation.navigate('ManagerOrderDetail', { orderId: o.id })}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.orderNo}>#{o.order_no}</Text>
                <Text style={s.meta}>{o.company_name || o.ordered_by_name}</Text>
                <Text style={s.meta}>
                  {o.item_count} item{o.item_count === 1 ? '' : 's'} · {money(o.total)} · {dateTime(o.created_at)}
                </Text>
              </View>
              <Chip tone={statusTone(o.status)}>{statusLabel(o.status)}</Chip>
            </View>

            {!['released', 'cancelled', 'refunded'].includes(o.status) && (
              <View style={{ marginTop: 10 }}>
                <Button title="Cancel order" variant="danger" small onPress={() => cancel(o)} />
              </View>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  orderNo: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  filter: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.text },
});
