import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { money, dateTime, methodLabel } from '../../lib/format';
import { colors } from '../../lib/theme';
import { Screen, Card, Chip, Empty, Loading, Banner, SectionTitle, Stat, StatRow } from '../../components/ui';

/** Receipts this cashier issued today. */
export default function CashierReceiptsScreen() {
  const [receipts, setReceipts] = useState(null);
  const [eod, setEod] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        api('/api/cashier/receipts?mine=1'),
        api('/api/cashier/end-of-day'),
      ]);
      setReceipts(r.receipts);
      setEod(e);
      setError('');
    } catch (err) { setError(err.message); }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (receipts === null) return <Loading label="Loading receipts…" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {eod && (
        <StatRow>
          <Stat label="Receipts" value={eod.receipts} />
          <Stat label="Cash" value={money(eod.cash)} tone="green" />
          <Stat label="Mobile Money" value={money(eod.mobile_money)} />
        </StatRow>
      )}

      <Banner>{error}</Banner>
      <SectionTitle>TODAY&apos;S RECEIPTS</SectionTitle>

      {receipts.length === 0 ? (
        <Empty>You have not issued any receipts today.</Empty>
      ) : (
        receipts.map((r) => (
          <Card key={r.id}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.receiptNo}>{r.receipt_no}</Text>
                <Text style={s.meta}>Order #{r.order_no} · {r.company_name || r.customer_name}</Text>
                <Text style={s.meta}>{methodLabel(r.method)} · {dateTime(r.created_at)}</Text>
                {!!r.transaction_ref && <Text style={s.meta}>Ref {r.transaction_ref}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={s.amount}>{money(r.amount_paid)}</Text>
                <Chip tone={r.verified === 1 ? 'green' : r.verified === -1 ? 'red' : 'blue'}>
                  {r.verified === 1 ? 'Verified' : r.verified === -1 ? 'Rejected' : 'With Accounts'}
                </Chip>
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  receiptNo: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  amount: { fontSize: 15, fontWeight: '800', color: colors.text },
});
