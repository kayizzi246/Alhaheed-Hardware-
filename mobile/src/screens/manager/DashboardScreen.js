import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/AuthContext';
import { money, shortMoney } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import {
  Screen, AppHeader, Card, Chip, Button, Banner, Empty, Loading,
  Stat, StatRow, SectionTitle, KeyValue,
} from '../../components/ui';

/** Fig 7: Manager App - Dashboard. */
export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('/api/manager/dashboard')); setError(''); }
    catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const refresh = () => load();
    s.on('order:new', refresh);
    s.on('order:updated', refresh);
    return () => { s.off('order:new', refresh); s.off('order:updated', refresh); };
  }, [load]);

  async function decideRefund(refund, approve) {
    try {
      await api(`/api/manager/refunds/${refund.id}/decide`, {
        method: 'POST',
        body: { approve },
      });
      load();
    } catch (e) { setError(e.message); }
  }

  if (!data) return <Loading label="Loading the dashboard…" />;

  const maxDay = Math.max(1, ...data.last7Days.map((d) => d.total));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader subtitle={`Manager · ${user?.fullName}`} />

      <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        <Banner>{error}</Banner>

        <StatRow>
          <Stat label="Sales today" value={shortMoney(data.salesToday)} tone="green" />
          <Stat label="Orders today" value={data.ordersToday} />
        </StatRow>

        <StatRow>
          <Stat
            label="Cash / MoMo / Card"
            value={`${shortMoney(data.byMethod.cash)} · ${shortMoney(data.byMethod.mobile_money)}`}
          />
          <Stat
            label="Low-stock items"
            value={data.lowStock.length}
            tone={data.lowStock.length > 0 ? 'red' : undefined}
          />
        </StatRow>

        <SectionTitle>ORDERS BY STAGE (LIVE)</SectionTitle>
        <Card>
          <View style={s.stageRow}>
            {[
              ['Cashier', data.byStage.cashier],
              ['Accounts', data.byStage.accounts],
              ['Store', data.byStage.store],
              ['Done', data.byStage.done],
            ].map(([label, n]) => (
              <View key={label} style={s.stage}>
                <Text style={s.stageValue}>{n}</Text>
                <Text style={s.stageLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <SectionTitle>SALES - LAST 7 DAYS</SectionTitle>
        <Card>
          {data.last7Days.length === 0 ? (
            <Empty>No verified sales yet.</Empty>
          ) : (
            <View style={s.chart}>
              {data.last7Days.map((d) => (
                <View key={d.day} style={s.bar}>
                  <Text style={s.barValue}>{shortMoney(d.total).replace('UGX ', '')}</Text>
                  <View
                    style={[
                      s.barFill,
                      { height: Math.max(4, (d.total / maxDay) * 90) },
                    ]}
                  />
                  <Text style={s.barLabel}>{d.day.slice(8)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {data.pendingRefunds.length > 0 && (
          <>
            <SectionTitle>REFUND REQUESTS</SectionTitle>
            {data.pendingRefunds.map((r) => (
              <Card key={r.id}>
                <View style={s.head}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>#{r.order_no} · {money(r.amount)}</Text>
                    <Text style={s.meta}>{r.reason}</Text>
                    <Text style={s.meta}>Raised by {r.requested_by_name}</Text>
                  </View>
                  <Chip tone="pending">Review</Chip>
                </View>
                <View style={s.actions}>
                  <Button
                    title="Approve refund"
                    small
                    onPress={() =>
                      Alert.alert('Approve this refund?', `${money(r.amount)} will be recorded as cash out.`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Approve', onPress: () => decideRefund(r, true) },
                      ])
                    }
                  />
                  <Button title="Decline" variant="danger" small onPress={() => decideRefund(r, false)} />
                </View>
              </Card>
            ))}
          </>
        )}

        {data.lowStock.length > 0 && (
          <>
            <SectionTitle>LOW STOCK</SectionTitle>
            <Card>
              {data.lowStock.slice(0, 8).map((p) => (
                <KeyValue
                  key={p.id}
                  k={p.name}
                  v={`${p.stock_available} ${p.unit} (reorder ${p.reorder_level})`}
                />
              ))}
            </Card>
          </>
        )}

        <Button
          title="View all orders"
          variant="ghost"
          onPress={() => navigation.navigate('Orders')}
          style={{ marginTop: 6 }}
        />
      </Screen>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },

  stageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stage: { alignItems: 'center', flex: 1 },
  stageValue: { fontSize: 21, fontWeight: '800', color: colors.text },
  stageLabel: { fontSize: 11.5, color: colors.muted, marginTop: 3 },

  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, gap: 6 },
  bar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontSize: 9.5, color: colors.muted, marginBottom: 4 },
  barFill: { width: '72%', backgroundColor: colors.orange, borderRadius: 4 },
  barLabel: { fontSize: 10.5, color: colors.muted, marginTop: 6 },
});
