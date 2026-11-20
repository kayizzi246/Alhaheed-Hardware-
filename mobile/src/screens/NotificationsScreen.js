import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { dateTime } from '../lib/format';
import { colors } from '../lib/theme';
import { Screen, Card, Button, Empty, Loading, Banner, SectionTitle } from '../components/ui';

/** Alerts: order status changes for customers, queue alerts for staff. */
export default function NotificationsScreen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('/api/notifications')); setError(''); }
    catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onNotif = () => load();
    s.on('notification', onNotif);
    return () => { s.off('notification', onNotif); };
  }, [load]);

  async function markAllRead() {
    try { await api('/api/notifications/read-all', { method: 'POST' }); load(); }
    catch (e) { setError(e.message); }
  }

  if (!data) return <Loading label="Loading notifications…" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Banner>{error}</Banner>

      <SectionTitle
        right={
          data.unread > 0
            ? <Button title="Mark all read" small variant="ghost" onPress={markAllRead} />
            : null
        }
      >
        {data.unread > 0 ? `${data.unread} UNREAD` : 'ALL CAUGHT UP'}
      </SectionTitle>

      {data.notifications.length === 0 ? (
        <Empty>No notifications yet.</Empty>
      ) : (
        data.notifications.map((n) => (
          <Card key={n.id} style={!n.read && s.unread}>
            <View style={s.row}>
              {!n.read && <View style={s.dot} />}
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{n.title}</Text>
                {!!n.body && <Text style={s.body}>{n.body}</Text>}
                <Text style={s.meta}>
                  {dateTime(n.created_at)}{n.order_no ? ` · #${n.order_no}` : ''}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  unread: { borderLeftWidth: 3, borderLeftColor: colors.orange },
  row: { flexDirection: 'row', gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange, marginTop: 6 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  body: { fontSize: 12.5, color: colors.muted, marginTop: 4, lineHeight: 18 },
  meta: { fontSize: 11, color: colors.muted, marginTop: 6 },
});
