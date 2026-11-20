import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { colors, radius } from '../lib/theme';
import { Button, Field, Input, Banner } from '../components/ui';

/** Customer registration: individual, or a company that will add its own staff. */
export default function RegisterScreen({ navigation }) {
  const { signIn } = useAuth();
  const [accountType, setAccountType] = useState('individual');
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', address: '', companyName: '', tin: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError(''); setBusy(true);
    try {
      const r = await api('/api/auth/register', {
        method: 'POST',
        body: {
          accountType,
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || null,
          address: form.address || null,
          companyName: accountType === 'company' ? form.companyName : undefined,
          tin: form.tin || null,
        },
      });
      await signIn(r.token, r.user);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  const valid =
    form.fullName.length > 1 &&
    form.phone.length > 8 &&
    (accountType === 'individual' || form.companyName.length > 1);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.title}>Create your account</Text>

      <View style={s.card}>
        <Banner>{error}</Banner>

        <Field label="Account type">
          <View style={s.toggle}>
            {[['individual', 'Individual'], ['company', 'Company']].map(([v, l]) => (
              <Pressable
                key={v}
                onPress={() => setAccountType(v)}
                style={[s.toggleBtn, accountType === v && s.toggleOn]}
              >
                <Text style={[s.toggleText, accountType === v && s.toggleTextOn]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {accountType === 'company' && (
          <>
            <Field label="Company name">
              <Input value={form.companyName} onChangeText={set('companyName')} placeholder="Kampala Construction Ltd" />
            </Field>
            <Field label="TIN (optional)">
              <Input value={form.tin} onChangeText={set('tin')} keyboardType="number-pad" />
            </Field>
          </>
        )}

        <Field label={accountType === 'company' ? 'Contact person' : 'Full name'}>
          <Input value={form.fullName} onChangeText={set('fullName')} placeholder="John Okello" />
        </Field>

        <Field label="Phone number">
          <Input value={form.phone} onChangeText={set('phone')} placeholder="+256770000000" keyboardType="phone-pad" />
        </Field>

        <Field label="Email (optional)">
          <Input value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        </Field>

        <Field label="Address (optional)">
          <Input value={form.address} onChangeText={set('address')} placeholder="Old Kampala, Kampala" />
        </Field>

        <Button title="Create account" onPress={submit} busy={busy} disabled={!valid} />

        {accountType === 'company' && (
          <Text style={s.note}>
            As the company owner you can add your own staff (cashier, buyer, site supervisor)
            afterwards, set a spending limit for each and see every order they place.
          </Text>
        )}

        <Pressable onPress={() => navigation.goBack()}>
          <Text style={s.link}>I already have an account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 16, borderWidth: 1, borderColor: colors.border },
  toggle: { flexDirection: 'row', backgroundColor: '#eef2f6', borderRadius: radius.sm, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center' },
  toggleOn: { backgroundColor: '#fff' },
  toggleText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  toggleTextOn: { color: colors.text },
  link: { color: colors.orangeDark, textAlign: 'center', marginTop: 16, fontSize: 13, fontWeight: '600' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
});
