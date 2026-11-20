import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { money, dateTime, statusLabel, statusTone } from '../../lib/format';
import { colors } from '../../lib/theme';
import { Screen, Card, Chip, Empty, Loading, Banner, SectionTitle } from '../../components/ui';

/** Fig 3 (list): Customer App - My Orders. */
export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api('/api/orders/mine');
      setOrders(r.orders);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Status changes pushed from the desks land here immediately.
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onUpdate = () => load();
    s.on('order:updated', onUpdate);
    s.on('notification', onUpdate);
    return () => { s.off('order:updated', onUpdate); s.off('notification', onUpdate); };
  }, [load]);

  if (orders === null) return <Loading label="Loading your orders…" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <SectionTitle>MY ORDERS</SectionTitle>
      <Banner>{error}</Banner>

      {orders.length === 0 ? (
        <Empty>You have not placed any orders yet.</Empty>
      ) : (
        orders.map((o) => (
          <Card key={o.id} onPress={() => navigation.navigate('OrderTrack', { orderId: o.id })}>
            <View style={s.head}>
              <Text style={s.orderNo}>#{o.order_no}</Text>
              <Chip tone={statusTone(o.status)}>{statusLabel(o.status)}</Chip>
            </View>
            <Text style={s.meta}>
              {o.item_count} item{o.item_count === 1 ? '' : 's'} · {money(o.total)}
            </Text>
            <Text style={s.meta}>{dateTime(o.created_at)}</Text>
            {!!o.company_name && (
              <Text style={s.company}>{o.company_name} · by {o.ordered_by_name}</Text>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNo: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  company: { fontSize: 11.5, color: colors.blue, marginTop: 6, fontWeight: '600' },
});
