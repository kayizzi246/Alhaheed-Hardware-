import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { colors, radius } from '../lib/theme';
import { Button, Field, Input, Banner } from '../components/ui';

/**
 * One login screen for everybody.
 * Customers sign in with phone + OTP; staff with phone/email + password.
 */
export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState('customer');

  // customer
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState('');

  // staff
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError(''); setBusy(true);
    try {
      const r = await api('/api/auth/otp/request', { method: 'POST', body: { phone } });
      setOtpSent(true);
      if (r.devCode) setDevCode(r.devCode);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function verifyOtp() {
    setError(''); setBusy(true);
    try {
      const r = await api('/api/auth/otp/verify', { method: 'POST', body: { phone, code } });
      await signIn(r.token, r.user);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  async function staffLogin() {
    setError(''); setBusy(true);
    try {
      const r = await api('/api/auth/staff/login', { method: 'POST', body: { identifier, password } });
      await signIn(r.token, r.user);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.brand}>AL HADEED</Text>
        <Text style={s.brandOrange}>HARDWARE</Text>
        <Text style={s.tagline}>Ordering &amp; Cash Booking</Text>

        <View style={s.card}>
          <View style={s.tabs}>
            {[['customer', 'Customer'], ['staff', 'Staff']].map(([v, l]) => (
              <Pressable
                key={v}
                onPress={() => { setMode(v); setError(''); }}
                style={[s.tab, mode === v && s.tabOn]}
              >
                <Text style={[s.tabText, mode === v && s.tabTextOn]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          <Banner>{error}</Banner>

          {mode === 'customer' ? (
            <>
              <Field label="Phone number">
                <Input
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+256770111001"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  editable={!otpSent}
                />
              </Field>

              {otpSent && (
                <Field label="6-digit code">
                  <Input
                    value={code}
                    onChangeText={setCode}
                    placeholder="123456"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  {!!devCode && (
                    <Text style={s.devHint}>Test mode: your code is {devCode}</Text>
                  )}
                </Field>
              )}

              {otpSent ? (
                <>
                  <Button title="Verify & sign in" onPress={verifyOtp} busy={busy} disabled={code.length !== 6} />
                  <Pressable onPress={() => { setOtpSent(false); setCode(''); }}>
                    <Text style={s.link}>Use a different number</Text>
                  </Pressable>
                </>
              ) : (
                <Button title="Send me a code" onPress={requestOtp} busy={busy} disabled={phone.length < 9} />
              )}

              <Pressable onPress={() => navigation.navigate('Register')}>
                <Text style={s.link}>New customer? Create an account</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Field label="Phone or email">
                <Input
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="cashier@alhadeed.ug"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </Field>
              <Field label="Password">
                <Input value={password} onChangeText={setPassword} secureTextEntry />
              </Field>
              <Button
                title="Sign in"
                onPress={staffLogin}
                busy={busy}
                disabled={!identifier || !password}
              />
              <Text style={s.hint}>
                Cashier, Accounts, Store Manager and Manager each see only their own side.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: colors.navy, justifyContent: 'center', padding: 22 },
  brand: { color: '#fff', fontSize: 25, fontWeight: '800', textAlign: 'center', letterSpacing: 1 },
  brandOrange: { color: colors.orange, fontSize: 25, fontWeight: '800', textAlign: 'center', letterSpacing: 1 },
  tagline: { color: '#8fa8c2', textAlign: 'center', marginTop: 7, marginBottom: 26, fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 20 },
  tabs: { flexDirection: 'row', backgroundColor: '#eef2f6', borderRadius: radius.sm, padding: 3, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  tabTextOn: { color: colors.text },
  link: { color: colors.orangeDark, textAlign: 'center', marginTop: 14, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 11.5, textAlign: 'center', marginTop: 14, lineHeight: 17 },
  devHint: { color: colors.muted, fontSize: 11.5, marginTop: 6 },
});
