import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Alert } from 'react-native';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/AuthContext';
import { money, shortMoney, time, methodLabel } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import {
  Screen, AppHeader, Card, Chip, Button, Field, Input, Banner, Empty, Loading,
  Stat, StatRow, SectionTitle,
} from '../../components/ui';

/** Accounts side on mobile: verify payments against the till / statement. */
export default function AccountsVerifyScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('/api/accounts/queue')); setError(''); }
    catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const refresh = () => load();
    s.on('order:updated', refresh);
    s.on('order:new', refresh);
    return () => { s.off('order:updated', refresh); s.off('order:new', refresh); };
  }, [load]);

  async function verify(order, approve, remarks) {
    setBusyId(order.id);
    try {
      await api(`/api/accounts/orders/${order.id}/verify`, {
        method: 'POST',
        body: { approve, remarks: remarks || null },
      });
      setNotice(approve
        ? `#${order.order_no} verified and sent to the Store.`
        : `#${order.order_no} sent back to the Cashier.`);
      setTimeout(() => setNotice(''), 4000);
      load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); setRejecting(null); }
  }

  if (!data) return <Loading label="Loading payments…" />;
  const sm = data.summary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader subtitle={`Accounts · ${user?.fullName}`} />

      <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        <StatRow>
          <Stat label="Awaiting" value={sm.awaiting} />
          <Stat label="Verified today" value={sm.verified_today} />
          <Stat label="Cash in" value={shortMoney(sm.cash_in)} tone="green" />
        </StatRow>

        <Banner>{error}</Banner>
        <Banner kind="ok">{notice}</Banner>

        <SectionTitle>AWAITING VERIFICATION</SectionTitle>

        {data.orders.length === 0 ? (
          <Empty>Every payment has been verified.</Empty>
        ) : (
          data.orders.map((o) => (
            <Card key={o.id}>
              <View style={s.head}>
                <View style={{ flex: 1 }}>
                  <Text style={s.orderNo}>#{o.order_no}</Text>
                  <Text style={s.meta}>{o.company_name || o.ordered_by_name}</Text>
                  <Text style={s.meta}>
                    {o.receipt_no} · {methodLabel(o.method)}
                    {o.transaction_ref ? ` · ${o.transaction_ref}` : ''}
                  </Text>
                  <Text style={s.meta}>By {o.cashier_name} at {time(o.created_at)}</Text>
                </View>
                <Chip tone="blue">Paid</Chip>
              </View>

              <View style={s.actions}>
                <Text style={s.amount}>{money(o.amount_paid)}</Text>
                <View style={{ flex: 1 }} />
                <Button
                  title="Verify"
                  small
                  busy={busyId === o.id}
                  onPress={() =>
                    Alert.alert(
                      `Verify #${o.order_no}?`,
                      `Confirm ${money(o.amount_paid)} by ${methodLabel(o.method)} is in the till or on the statement.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Verify', onPress: () => verify(o, true) },
                      ]
                    )
                  }
                />
                <Button
                  title="Reject"
                  variant="danger"
                  small
                  disabled={busyId === o.id}
                  onPress={() => setRejecting(o)}
                />
              </View>
            </Card>
          ))
        )}
      </Screen>

      {rejecting && (
        <RejectSheet
          order={rejecting}
          busy={busyId === rejecting.id}
          onClose={() => setRejecting(null)}
          onConfirm={(remarks) => verify(rejecting, false, remarks)}
        />
      )}
    </View>
  );
}

function RejectSheet({ order, onClose, onConfirm, busy }) {
  const [remarks, setRemarks] = useState('');

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.sheetTitle}>Reject payment · #{order.order_no}</Text>
          <Text style={s.sheetLead}>
            The order goes back to the Cashier and the customer is notified.
          </Text>

          <Field label="Reason">
            <Input
              value={remarks}
              onChangeText={setRemarks}
              placeholder="No matching entry on the mobile money statement"
              multiline
            />
          </Field>

          <Button
            title="Reject & send back"
            variant="danger"
            busy={busy}
            disabled={remarks.trim().length < 3}
            onPress={() => onConfirm(remarks)}
          />
          <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 9 }} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  orderNo: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  amount: { fontSize: 15, fontWeight: '800', color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,36,57,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetLead: { fontSize: 12.5, color: colors.muted, marginTop: 4, marginBottom: 16, lineHeight: 18 },
});
