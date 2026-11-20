import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/AuthContext';
import { money, shortMoney, time } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import {
  Screen, AppHeader, Card, Chip, Button, Field, Input, Banner, Empty, Loading, Stat, StatRow, SectionTitle,
} from '../../components/ui';

/** Fig 5: Cashier App - Payment Queue. */
export default function CashierQueueScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('/api/cashier/queue')); setError(''); }
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

  if (!data) return <Loading label="Loading the payment queue…" />;
  const s2 = data.summary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader subtitle={`Cashier · ${user?.fullName}`} />

      <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        <StatRow>
          <Stat label="Waiting" value={s2.waiting} />
          <Stat label="Paid today" value={s2.paid_today} />
          <Stat label="Cash in" value={shortMoney(s2.cash_today)} tone="green" />
        </StatRow>

        <Banner>{error}</Banner>
        <Banner kind="ok">{notice}</Banner>

        <SectionTitle>ORDERS WAITING FOR PAYMENT</SectionTitle>

        {data.orders.length === 0 ? (
          <Empty>Nothing is waiting for payment.</Empty>
        ) : (
          data.orders.map((o) => (
            <Card key={o.id}>
              <View style={s.head}>
                <View style={{ flex: 1 }}>
                  <Text style={s.orderNo}>#{o.order_no}</Text>
                  <Text style={s.meta}>
                    {o.company_name || o.ordered_by_name} · {o.item_count} item{o.item_count === 1 ? '' : 's'}
                  </Text>
                  {!!o.company_name && <Text style={s.meta}>Ordered by {o.ordered_by_name}</Text>}
                  <Text style={s.meta}>{time(o.created_at)} · {o.fulfilment === 'delivery' ? 'Delivery' : 'Pick-up'}</Text>
                </View>
                <Chip tone="pending">Pending</Chip>
              </View>

              <View style={s.payRow}>
                <Text style={s.amount}>{money(o.total)}</Text>
                <Button title="Receive Payment" small onPress={() => setPaying(o)} />
              </View>
            </Card>
          ))
        )}
      </Screen>

      {paying && (
        <ReceivePaymentSheet
          order={paying}
          onClose={() => setPaying(null)}
          onDone={(receiptNo) => {
            setPaying(null);
            setNotice(`Payment recorded. Receipt ${receiptNo} sent to Accounts.`);
            setTimeout(() => setNotice(''), 4000);
            load();
          }}
        />
      )}
    </View>
  );
}

function ReceivePaymentSheet({ order, onClose, onDone }) {
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState(String(order.total));
  const [ref, setRef] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const paid = Number(amount || 0);
  const change = paid - order.total;

  async function submit() {
    setError(''); setBusy(true);
    try {
      const r = await api(`/api/cashier/orders/${order.id}/payment`, {
        method: 'POST',
        body: { method, amountPaid: Math.trunc(paid), transactionRef: ref || null },
      });
      onDone(r.receipt.receipt_no);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>Receive Payment · #{order.order_no}</Text>
            <Text style={s.sheetLead}>{order.company_name || order.ordered_by_name}</Text>

            <Banner>{error}</Banner>

            <View style={s.dueBox}>
              <Text style={s.dueLabel}>Amount due</Text>
              <Text style={s.dueValue}>{money(order.total)}</Text>
            </View>

            <Field label="Payment method">
              <View style={s.methods}>
                {[['cash', 'Cash'], ['mobile_money', 'Mobile Money'], ['card', 'Card']].map(([v, l]) => (
                  <Pressable
                    key={v}
                    onPress={() => setMethod(v)}
                    style={[s.method, method === v && s.methodOn]}
                  >
                    <Text style={[s.methodText, method === v && s.methodTextOn]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label="Amount received">
              <Input value={amount} onChangeText={setAmount} keyboardType="number-pad" />
            </Field>

            {change > 0 && (
              <Text style={s.change}>Change to give: {money(change)}</Text>
            )}

            {method !== 'cash' && (
              <Field label="Transaction reference">
                <Input value={ref} onChangeText={setRef} placeholder="MP2611190934" autoCapitalize="characters" />
              </Field>
            )}

            <Button
              title="Confirm & Send to Accounts"
              variant="navy"
              onPress={submit}
              busy={busy}
              disabled={paid < order.total || (method !== 'cash' && !ref)}
            />
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 9 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  orderNo: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  payRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  amount: { fontSize: 16, fontWeight: '800', color: colors.text },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,36,57,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetLead: { fontSize: 12.5, color: colors.muted, marginTop: 3, marginBottom: 16 },

  dueBox: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: 14, marginBottom: 16 },
  dueLabel: { fontSize: 11.5, color: colors.muted },
  dueValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },

  methods: { flexDirection: 'row', gap: 8 },
  method: {
    flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', backgroundColor: '#fff',
  },
  methodOn: { borderColor: colors.orange, backgroundColor: '#fff7ed' },
  methodText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  methodTextOn: { color: colors.orangeDark },
  change: { fontSize: 12.5, color: colors.muted, marginBottom: 14 },
});
