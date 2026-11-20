import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { api } from '../../lib/api';
import { money, dateTime, time, statusLabel, statusTone, methodLabel } from '../../lib/format';
import { colors } from '../../lib/theme';
import {
  Screen, Card, Chip, Button, Banner, Loading, KeyValue, SectionTitle, Field, Input,
} from '../../components/ui';

/** Full order record with the audit trail, for oversight and refunds. */
export default function ManagerOrderDetailScreen({ route }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setOrder((await api(`/api/orders/${orderId}`)).order); setError(''); }
    catch (e) { setError(e.message); }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  async function requestRefund() {
    setBusy(true);
    try {
      await api('/api/manager/refunds', {
        method: 'POST',
        body: { orderId: order.id, amount: order.total, reason: refundReason },
      });
      setNotice('Refund request raised. Approve it from the dashboard.');
      setRefundReason('');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!order) return <Loading label="Loading order…" />;

  return (
    <Screen>
      <Card>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.orderNo}>#{order.order_no}</Text>
            <Text style={s.meta}>{order.company_name || order.ordered_by_name}</Text>
            <Text style={s.meta}>{order.ordered_by_phone}</Text>
          </View>
          <Chip tone={statusTone(order.status)}>{statusLabel(order.status)}</Chip>
        </View>
      </Card>

      <Banner>{error}</Banner>
      <Banner kind="ok">{notice}</Banner>

      <SectionTitle>ITEMS</SectionTitle>
      <Card>
        {order.items.map((i) => (
          <View key={i.id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{i.product_name}</Text>
              <Text style={s.meta}>{i.quantity} {i.unit} × {money(i.unit_price)}</Text>
            </View>
            <Text style={s.amount}>{money(i.line_total)}</Text>
          </View>
        ))}
        <View style={s.divider} />
        <KeyValue k="Total" v={money(order.total)} bold />
      </Card>

      {order.payment && (
        <>
          <SectionTitle>PAYMENT</SectionTitle>
          <Card>
            <KeyValue k="Receipt" v={order.payment.receipt_no} />
            <KeyValue k="Method" v={methodLabel(order.payment.method)} />
            <KeyValue k="Amount" v={money(order.payment.amount_paid)} bold />
            <KeyValue k="Cashier" v={order.payment.cashier_name} />
            <KeyValue
              k="Verified"
              v={order.payment.verified === 1
                ? `Yes, by ${order.payment.verifier_name}`
                : order.payment.verified === -1 ? 'Rejected' : 'Not yet'}
            />
            {!!order.payment.verify_remarks && <KeyValue k="Remarks" v={order.payment.verify_remarks} />}
          </Card>
        </>
      )}

      <SectionTitle>AUDIT TRAIL</SectionTitle>
      <Card>
        {order.events.map((e) => (
          <View key={e.id} style={s.eventRow}>
            <Text style={s.eventTime}>{dateTime(e.created_at)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.eventAction}>{e.stage} · {e.action.replace(/_/g, ' ')}</Text>
              <Text style={s.meta}>{e.handler_name}{e.notes ? ` · ${e.notes}` : ''}</Text>
            </View>
          </View>
        ))}
      </Card>

      {order.status === 'released' && (
        <>
          <SectionTitle>REFUND</SectionTitle>
          <Card>
            <Field label="Reason for refund">
              <Input
                value={refundReason}
                onChangeText={setRefundReason}
                placeholder="Iron sheet damaged on delivery"
                multiline
              />
            </Field>
            <Button
              title="Raise refund request"
              variant="danger"
              busy={busy}
              disabled={refundReason.trim().length < 3}
              onPress={() =>
                Alert.alert('Raise a refund request?', `For ${money(order.total)} on #${order.order_no}.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Raise request', onPress: requestRefund },
                ])
              }
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  orderNo: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  name: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  amount: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  eventRow: { flexDirection: 'row', gap: 10, paddingVertical: 5 },
  eventTime: { fontSize: 11, color: colors.muted, width: 86 },
  eventAction: { fontSize: 12.5, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
});
