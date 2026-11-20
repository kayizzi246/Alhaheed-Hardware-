import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { money, time } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import {
  Screen, Card, Button, Field, Input, Banner, Empty, Loading, Stat, StatRow, SectionTitle, KeyValue,
} from '../../components/ui';

/** Cash book on mobile: running balance plus manual entries. */
export default function CashBookScreen() {
  const [book, setBook] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setBook(await api('/api/accounts/cash-book')); setError(''); }
    catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!book) return <Loading label="Loading cash book…" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <StatRow>
        <Stat label="Cash in" value={money(book.totalIn)} tone="green" />
        <Stat label="Cash out" value={money(book.totalOut)} tone="red" />
      </StatRow>
      <StatRow>
        <Stat label="Opening" value={money(book.opening)} />
        <Stat label="Closing" value={money(book.closing)} />
      </StatRow>

      <Banner>{error}</Banner>

      <SectionTitle right={<Button title="+ Add entry" small variant="ghost" onPress={() => setAdding(true)} />}>
        CASH BOOK · {book.date}
      </SectionTitle>

      {book.entries.length === 0 ? (
        <Empty>No entries for today yet.</Empty>
      ) : (
        book.entries.map((e) => (
          <Card key={e.id}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.details}>{e.details}</Text>
                <Text style={s.meta}>{time(e.created_at)} · {e.recorded_by_name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.amount, { color: e.cash_in ? colors.green : colors.red }]}>
                  {e.cash_in ? '+' : '−'}{money(e.cash_in || e.cash_out)}
                </Text>
                <Text style={s.meta}>Bal {money(e.balance)}</Text>
              </View>
            </View>
          </Card>
        ))
      )}

      {adding && <AddEntrySheet onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
    </Screen>
  );
}

function AddEntrySheet({ onClose, onDone }) {
  const [details, setDetails] = useState('');
  const [direction, setDirection] = useState('out');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(''); setBusy(true);
    try {
      await api('/api/accounts/cash-book', {
        method: 'POST',
        body: {
          details,
          cashIn: direction === 'in' ? Math.trunc(Number(amount)) : 0,
          cashOut: direction === 'out' ? Math.trunc(Number(amount)) : 0,
          method: 'cash',
        },
      });
      onDone();
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>Add cash book entry</Text>
            <Banner>{error}</Banner>

            <Field label="Details">
              <Input value={details} onChangeText={setDetails} placeholder="Transport - delivery truck fuel" />
            </Field>

            <Field label="Direction">
              <View style={s.toggle}>
                {[['in', 'Cash In'], ['out', 'Cash Out']].map(([v, l]) => (
                  <Pressable
                    key={v}
                    onPress={() => setDirection(v)}
                    style={[s.toggleBtn, direction === v && s.toggleOn]}
                  >
                    <Text style={[s.toggleText, direction === v && s.toggleTextOn]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label="Amount (UGX)">
              <Input value={amount} onChangeText={setAmount} keyboardType="number-pad" />
            </Field>

            <Button
              title="Save entry"
              onPress={submit}
              busy={busy}
              disabled={details.length < 2 || !Number(amount)}
            />
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 9 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  details: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 3 },
  amount: { fontSize: 14.5, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,36,57,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '90%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 16 },
  toggle: { flexDirection: 'row', backgroundColor: '#eef2f6', borderRadius: radius.sm, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center' },
  toggleOn: { backgroundColor: '#fff' },
  toggleText: { fontSize: 12.5, color: colors.muted, fontWeight: '600' },
  toggleTextOn: { color: colors.text },
});
