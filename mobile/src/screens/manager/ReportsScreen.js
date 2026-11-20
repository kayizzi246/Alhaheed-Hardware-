import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { money, shortMoney, methodLabel } from '../../lib/format';
import { colors } from '../../lib/theme';
import {
  Screen, Card, Banner, Empty, Loading, Stat, StatRow, SectionTitle, KeyValue, Chip,
} from '../../components/ui';

const PERIODS = [['daily', 'Today'], ['weekly', '7 days'], ['monthly', '30 days']];

/** Manager reports: sales, best sellers and stock movement. */
export default function ReportsScreen() {
  const [period, setPeriod] = useState('weekly');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sales, best, stock, stage] = await Promise.all([
        api(`/api/reports/sales?period=${period}`),
        api(`/api/reports/best-sellers?period=${period}`),
        api(`/api/reports/stock-movement?period=${period}`),
        api(`/api/reports/orders-by-stage?period=${period}`),
      ]);
      setData({ sales, best, stock, stage });
      setError('');
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <Loading label="Building reports…" />;

  const { sales, best, stock, stage } = data;
  const maxDay = Math.max(1, ...sales.byDay.map((d) => d.total));

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={s.periods}>
        {PERIODS.map(([v, l]) => (
          <Pressable
            key={v}
            onPress={() => setPeriod(v)}
            style={[s.period, period === v && { backgroundColor: colors.orange, borderColor: colors.orange }]}
          >
            <Text style={[s.periodText, period === v && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <Banner>{error}</Banner>

      <StatRow>
        <Stat label="Gross sales" value={shortMoney(sales.totals.gross)} tone="green" />
        <Stat label="Receipts" value={sales.totals.receipts} />
      </StatRow>
      <Text style={s.range}>{sales.from} to {sales.to}</Text>

      <SectionTitle>SALES BY DAY</SectionTitle>
      <Card>
        {sales.byDay.length === 0 ? (
          <Empty>No verified sales in this period.</Empty>
        ) : (
          sales.byDay.map((d) => (
            <View key={d.day} style={s.barRow}>
              <Text style={s.barDay}>{d.day.slice(5)}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${(d.total / maxDay) * 100}%` }]} />
              </View>
              <Text style={s.barValue}>{shortMoney(d.total)}</Text>
            </View>
          ))
        )}
      </Card>

      <SectionTitle>PAYMENTS BY METHOD</SectionTitle>
      <Card>
        {sales.byMethod.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          sales.byMethod.map((m) => (
            <KeyValue key={m.method} k={`${methodLabel(m.method)} (${m.receipts})`} v={money(m.total)} />
          ))
        )}
      </Card>

      <SectionTitle>ORDERS BY STAGE</SectionTitle>
      <Card>
        {stage.stages.length === 0 ? (
          <Empty>No orders in this period.</Empty>
        ) : (
          stage.stages.map((st) => (
            <KeyValue key={st.status} k={`${st.status.replace(/_/g, ' ')} (${st.orders})`} v={money(st.value)} />
          ))
        )}
      </Card>

      <SectionTitle>BEST SELLING ITEMS</SectionTitle>
      <Card>
        {best.products.length === 0 ? (
          <Empty>No items sold in this period.</Empty>
        ) : (
          best.products.slice(0, 10).map((p) => (
            <View key={p.product_id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.product_name}</Text>
                <Text style={s.meta}>{p.qty_sold} {p.unit} in {p.orders} order(s)</Text>
              </View>
              <Text style={s.amount}>{money(p.revenue)}</Text>
            </View>
          ))
        )}
      </Card>

      <SectionTitle>STOCK MOVEMENT</SectionTitle>
      <Card>
        {stock.movements.slice(0, 12).map((m) => (
          <View key={m.code} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{m.name}</Text>
              <Text style={s.meta}>
                +{m.received} received · −{m.released} released · {m.stock_available} {m.unit} left
              </Text>
            </View>
            {m.stock_available <= m.reorder_level && <Chip tone="red">Low</Chip>}
          </View>
        ))}
      </Card>

      <Text style={s.note}>
        Use the Accounts web panel to export these reports to Excel or save them as PDF.
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  periods: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  period: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
  periodText: { fontSize: 12.5, fontWeight: '600', color: colors.text },
  range: { fontSize: 11.5, color: colors.muted, marginBottom: 6 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  barDay: { fontSize: 11, color: colors.muted, width: 42 },
  barTrack: { flex: 1, height: 16, backgroundColor: '#eef2f6', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.orange, borderRadius: 4 },
  barValue: { fontSize: 11.5, color: colors.text, width: 74, textAlign: 'right' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  name: { fontSize: 13, fontWeight: '600', color: colors.text },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 13, fontWeight: '700', color: colors.text },
  note: { fontSize: 11.5, color: colors.muted, textAlign: 'center', marginTop: 14, lineHeight: 17 },
});
