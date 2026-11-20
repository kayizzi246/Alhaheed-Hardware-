import { View, Text, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { money } from '../../lib/format';
import { colors } from '../../lib/theme';
import { Screen, Card, Button, KeyValue, SectionTitle, Chip } from '../../components/ui';

/** Profile and sign-out. */
export default function AccountScreen({ navigation }) {
  const { user, signOut } = useAuth();

  const typeLabel = {
    individual: 'Individual customer',
    company_owner: 'Company owner',
    company_staff: 'Company staff',
  }[user?.accountType] || user?.accountType;

  return (
    <Screen>
      <Card>
        <View style={s.avatarRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(user?.fullName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.fullName}</Text>
            <Text style={s.meta}>{user?.phone}</Text>
            <Chip tone="blue">{typeLabel}</Chip>
          </View>
        </View>
      </Card>

      <SectionTitle>ACCOUNT</SectionTitle>
      <Card>
        <KeyValue k="Name" v={user?.fullName} />
        <KeyValue k="Phone" v={user?.phone} />
        <KeyValue k="Email" v={user?.email || '—'} />
        <KeyValue k="Account type" v={typeLabel} />
        {!!user?.company?.company_name && <KeyValue k="Company" v={user.company.company_name} />}
        {!!user?.staffRole && <KeyValue k="Role in company" v={user.staffRole} />}
        {user?.spendingLimit != null && (
          <KeyValue k="Spending limit" v={money(user.spendingLimit)} />
        )}
      </Card>

      <SectionTitle>NOTIFICATIONS</SectionTitle>
      <Card onPress={() => navigation.navigate('Notifications')}>
        <Text style={s.linkRow}>View all notifications</Text>
      </Card>

      <Button
        title="Sign out"
        variant="danger"
        style={{ marginTop: 10 }}
        onPress={() =>
          Alert.alert('Sign out?', 'You will need your phone and a code to sign back in.', [
            { text: 'Stay signed in', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: signOut },
          ])
        }
      />

      <Text style={s.version}>Al Hadeed Hardware · v1.0.0</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  avatarRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12.5, color: colors.muted, marginTop: 2, marginBottom: 6 },
  linkRow: { fontSize: 14, color: colors.text, fontWeight: '600' },
  version: { textAlign: 'center', color: colors.muted, fontSize: 11.5, marginTop: 20 },
});
