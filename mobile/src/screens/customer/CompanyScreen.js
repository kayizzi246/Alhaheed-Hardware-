import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert, Modal, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { money, dateTime, statusLabel, statusTone } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import {
  Screen, Card, Chip, Button, Field, Input, Banner, Empty, Loading, SectionTitle, Stat, StatRow,
} from '../../components/ui';

/** Fig 4: Customer App - Company Owner: Staff & All Orders. */
export default function CompanyScreen({ navigation }) {
  const { user } = useAuth();
  const [staff, setStaff] = useState(null);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isOwner = user?.accountType === 'company_owner';

  const load = useCallback(async () => {
    if (!isOwner) { setStaff([]); return; }
    try {
      const [st, or] = await Promise.all([
        api('/api/company/staff'),
        api('/api/company/orders'),
      ]);
      setStaff(st.staff);
      setOrders(or.orders);
      setSummary(or.summary);
      setError('');
    } catch (e) { setError(e.message); setStaff([]); }
    finally { setRefreshing(false); }
  }, [isOwner]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleStatus(member) {
    const suspending = member.status === 'active';
    Alert.alert(
      suspending ? `Suspend ${member.fullName}?` : `Reactivate ${member.fullName}?`,
      suspending
        ? 'They will no longer be able to place orders for the company.'
        : 'They will be able to order for the company again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: suspending ? 'Suspend' : 'Reactivate',
          style: suspending ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await api(`/api/company/staff/${member.id}`, {
                method: 'PATCH',
                body: { status: suspending ? 'suspended' : 'active' },
              });
              load();
            } catch (e) { setError(e.message); }
          },
        },
      ]
    );
  }

  if (!isOwner) {
    return (
      <Screen>
        <Empty>
          {user?.accountType === 'company_staff'
            ? 'You order on behalf of your company. Only the company owner can manage staff and see all company orders.'
            : 'This section is for company accounts. Your account is registered as an individual.'}
        </Empty>
      </Screen>
    );
  }

  if (staff === null) return <Loading label="Loading your company…" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Banner>{error}</Banner>

      {summary && (
        <StatRow>
          <Stat label="Orders" value={summary.total_orders} />
          <Stat label="Total spent" value={money(summary.total_spent)} tone="green" />
          <Stat label="In progress" value={money(summary.in_progress)} />
        </StatRow>
      )}

      <SectionTitle
        right={<Button title="+ Add staff" small variant="ghost" onPress={() => setAdding(true)} />}
      >
        COMPANY STAFF
      </SectionTitle>

      {staff.length === 0 ? (
        <Empty>No staff added yet. Add the people who order on the company&apos;s behalf.</Empty>
      ) : (
        staff.map((m) => (
          <Card key={m.id}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{m.fullName}</Text>
                <Text style={s.meta}>
                  {m.staffRole} · limit {m.spendingLimitLabel}
                </Text>
                <Text style={s.meta}>
                  {m.phone} · {m.orderCount} order{m.orderCount === 1 ? '' : 's'} · {money(m.totalSpent)}
                </Text>
              </View>
              <Chip tone={m.status === 'active' ? 'green' : 'red'}>
                {m.status === 'active' ? 'Active' : 'Suspended'}
              </Chip>
            </View>

            <View style={s.actions}>
              <Button
                title={m.status === 'active' ? 'Suspend' : 'Reactivate'}
                variant={m.status === 'active' ? 'danger' : 'ghost'}
                small
                onPress={() => toggleStatus(m)}
              />
            </View>
          </Card>
        ))
      )}

      <SectionTitle>ALL COMPANY ORDERS</SectionTitle>
      {orders.length === 0 ? (
        <Empty>No orders have been placed under this company account yet.</Empty>
      ) : (
        orders.map((o) => (
          <Card
            key={o.id}
            onPress={() => navigation.navigate('Orders', { screen: 'OrderTrack', params: { orderId: o.id } })}
          >
            <View style={s.head}>
              <Text style={s.orderNo}>#{o.order_no}</Text>
              <Chip tone={statusTone(o.status)}>{statusLabel(o.status)}</Chip>
            </View>
            <Text style={s.meta}>
              {o.ordered_by_name}{o.staff_role ? ` (${o.staff_role})` : ''} · {money(o.total)}
            </Text>
            <Text style={s.meta}>{dateTime(o.created_at)}</Text>
          </Card>
        ))
      )}

      {adding && (
        <AddStaffModal
          onClose={() => setAdding(false)}
          onDone={() => { setAdding(false); load(); }}
        />
      )}
    </Screen>
  );
}

function AddStaffModal({ onClose, onDone }) {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', staffRole: '', spendingLimit: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError(''); setBusy(true);
    try {
      await api('/api/company/staff', {
        method: 'POST',
        body: {
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || null,
          staffRole: form.staffRole,
          spendingLimit: form.spendingLimit ? Math.trunc(Number(form.spendingLimit)) : null,
        },
      });
      onDone();
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView>
            <Text style={s.sheetTitle}>Add a staff member</Text>
            <Text style={s.sheetLead}>
              They sign in with their own phone number and order on the company&apos;s behalf.
            </Text>

            <Banner>{error}</Banner>

            <Field label="Full name">
              <Input value={form.fullName} onChangeText={set('fullName')} placeholder="Sarah Namuli" />
            </Field>
            <Field label="Phone number">
              <Input value={form.phone} onChangeText={set('phone')} placeholder="+256770222002" keyboardType="phone-pad" />
            </Field>
            <Field label="Email (optional)">
              <Input value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
            </Field>
            <Field label="Role in the company">
              <Input value={form.staffRole} onChangeText={set('staffRole')} placeholder="Cashier / Buyer / Site Supervisor" />
            </Field>
            <Field label="Spending limit per order (optional)">
              <Input
                value={form.spendingLimit}
                onChangeText={set('spendingLimit')}
                placeholder="5000000"
                keyboardType="number-pad"
              />
            </Field>

            <Button
              title="Add staff member"
              onPress={submit}
              busy={busy}
              disabled={form.fullName.length < 2 || form.phone.length < 9 || form.staffRole.length < 2}
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
  name: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  orderNo: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,36,57,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 20, maxHeight: '90%',
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetLead: { fontSize: 12.5, color: colors.muted, marginTop: 4, marginBottom: 16, lineHeight: 18 },
});
