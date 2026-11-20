import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { colors, radius } from '../../lib/theme';
import {
  Screen, Card, Chip, Button, Field, Input, Banner, Empty, Loading, SectionTitle,
} from '../../components/ui';

const ROLES = [
  ['cashier', 'Cashier'],
  ['accounts', 'Accounts'],
  ['store', 'Store Manager'],
  ['manager', 'Manager'],
];

/** Manager: staff accounts and role-based access. */
export default function StaffScreen() {
  const [staff, setStaff] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setStaff((await api('/api/manager/staff')).staff); setError(''); }
    catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggle(member) {
    const suspending = member.status === 'active';
    Alert.alert(
      suspending ? `Suspend ${member.fullName}?` : `Reactivate ${member.fullName}?`,
      suspending ? 'They will not be able to sign in.' : 'They will be able to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: suspending ? 'Suspend' : 'Reactivate',
          style: suspending ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await api(`/api/manager/staff/${member.id}`, {
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

  if (staff === null) return <Loading label="Loading staff…" />;

  const label = (r) => ROLES.find(([v]) => v === r)?.[1] || r;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Banner>{error}</Banner>
      <Banner kind="ok">{notice}</Banner>

      <SectionTitle right={<Button title="+ Add staff" small variant="ghost" onPress={() => setAdding(true)} />}>
        STAFF ACCOUNTS
      </SectionTitle>

      {staff.length === 0 ? (
        <Empty>No staff accounts yet.</Empty>
      ) : (
        staff.map((m) => (
          <Card key={m.id}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{m.fullName}</Text>
                <Text style={s.meta}>{label(m.role)}</Text>
                <Text style={s.meta}>{m.phone}{m.email ? ` · ${m.email}` : ''}</Text>
                <Text style={s.access}>
                  {['cashier', 'accounts'].includes(m.role) ? 'App and Web' : 'App only'}
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
                onPress={() => toggle(m)}
              />
            </View>
          </Card>
        ))
      )}

      {adding && (
        <AddStaffSheet
          onClose={() => setAdding(false)}
          onDone={(msg) => {
            setAdding(false);
            setNotice(msg);
            setTimeout(() => setNotice(''), 4000);
            load();
          }}
        />
      )}
    </Screen>
  );
}

function AddStaffSheet({ onClose, onDone }) {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', role: 'cashier', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError(''); setBusy(true);
    try {
      await api('/api/manager/staff', {
        method: 'POST',
        body: { ...form, email: form.email || null },
      });
      onDone(`${form.fullName} can now sign in as ${form.role}.`);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>Add a staff account</Text>
            <Banner>{error}</Banner>

            <Field label="Full name">
              <Input value={form.fullName} onChangeText={set('fullName')} placeholder="Aisha Nakato" />
            </Field>
            <Field label="Phone number">
              <Input value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="+256700000005" />
            </Field>
            <Field label="Email (optional)">
              <Input value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
            </Field>

            <Field label="Role">
              <View style={s.roles}>
                {ROLES.map(([v, l]) => (
                  <Pressable
                    key={v}
                    onPress={() => set('role')(v)}
                    style={[s.role, form.role === v && s.roleOn]}
                  >
                    <Text style={[s.roleText, form.role === v && { color: '#fff' }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label="Temporary password">
              <Input value={form.password} onChangeText={set('password')} secureTextEntry />
            </Field>

            <Button
              title="Create staff account"
              onPress={submit}
              busy={busy}
              disabled={form.fullName.length < 2 || form.phone.length < 9 || form.password.length < 6}
            />
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 9 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  access: { fontSize: 11, color: colors.blue, marginTop: 5, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,36,57,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 14 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  role: {
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
  roleOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  roleText: { fontSize: 12, fontWeight: '600', color: colors.text },
});
