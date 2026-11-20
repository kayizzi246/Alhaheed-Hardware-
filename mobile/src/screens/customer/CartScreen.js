import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { api } from '../../lib/api';
import { useCart } from '../../lib/CartContext';
import { useAuth } from '../../lib/AuthContext';
import { money } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import { Screen, Card, Button, Field, Input, Banner, Empty, KeyValue, SectionTitle } from '../../components/ui';

/** Fig 2: Customer App - Cart & Place Order. */
export default function CartScreen({ navigation }) {
  const { items, setQuantity, remove, clear, subtotal } = useCart();
  const { user } = useAuth();
  const [fulfilment, setFulfilment] = useState('pickup');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const overLimit =
    user?.accountType === 'company_staff' &&
    user?.spendingLimit != null &&
    subtotal > user.spendingLimit;

  async function placeOrder() {
    setError(''); setBusy(true);
    try {
      const r = await api('/api/orders', {
        method: 'POST',
        body: {
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          fulfilment,
          deliveryAddress: fulfilment === 'delivery' ? address : null,
          notes: notes || null,
        },
      });
      clear();
      navigation.navigate('Orders', { screen: 'OrderTrack', params: { orderId: r.order.id } });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (items.length === 0) {
    return (
      <Screen>
        <Empty>Your cart is empty. Add products from the Shop to place an order.</Empty>
        <Button title="Browse products" variant="ghost" onPress={() => navigation.navigate('Shop')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>MY CART ({items.length} ITEM{items.length === 1 ? '' : 'S'})</SectionTitle>
      <Text style={s.lead}>Pay at the cashier after placing your order</Text>

      {items.map(({ product, quantity }) => (
        <Card key={product.id}>
          <View style={s.row}>
            <View style={s.thumb}>
              <Text style={s.thumbText}>{product.name.slice(0, 3).toUpperCase()}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={s.name}>{product.name}</Text>
              <Text style={s.meta}>{money(product.price)} · {product.unit}</Text>

              <View style={s.stepper}>
                <Pressable style={s.step} onPress={() => setQuantity(product.id, quantity - 1)}>
                  <Text style={s.stepText}>−</Text>
                </Pressable>
                <Text style={s.qty}>{quantity}</Text>
                <Pressable style={s.step} onPress={() => setQuantity(product.id, quantity + 1)}>
                  <Text style={s.stepText}>+</Text>
                </Pressable>
                <Pressable onPress={() => remove(product.id)} style={{ marginLeft: 14 }}>
                  <Text style={s.removeText}>Remove</Text>
                </Pressable>
              </View>
            </View>

            <Text style={s.lineTotal}>{money(product.price * quantity)}</Text>
          </View>
        </Card>
      ))}

      <Card>
        <Field label="How will you take the goods?">
          <View style={s.toggle}>
            {[['pickup', 'Pick-up at shop'], ['delivery', 'Delivery to site']].map(([v, l]) => (
              <Pressable
                key={v}
                onPress={() => setFulfilment(v)}
                style={[s.toggleBtn, fulfilment === v && s.toggleOn]}
              >
                <Text style={[s.toggleText, fulfilment === v && s.toggleTextOn]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {fulfilment === 'delivery' && (
          <Field label="Delivery address">
            <Input value={address} onChangeText={setAddress} placeholder="Site B, Namugongo Road" />
          </Field>
        )}

        <Field label="Notes for the shop (optional)">
          <Input value={notes} onChangeText={setNotes} placeholder="Call me before delivery" multiline />
        </Field>
      </Card>

      <Card>
        <KeyValue k="Subtotal" v={money(subtotal)} />
        <KeyValue k="Delivery" v={fulfilment === 'delivery' ? 'Quoted at the desk' : money(0)} />
        <View style={s.divider} />
        <KeyValue k="Total" v={money(subtotal)} bold />
      </Card>

      {overLimit && (
        <Banner>
          This order is {money(subtotal)} but your company spending limit is{' '}
          {money(user.spendingLimit)}. Ask the company owner to raise it or reduce the order.
        </Banner>
      )}
      <Banner>{error}</Banner>

      <Button
        title="Place Order"
        onPress={placeOrder}
        busy={busy}
        disabled={overLimit || (fulfilment === 'delivery' && address.trim().length < 3)}
      />
      <Text style={s.foot}>
        Your order goes to the cashier for payment, then to accounts and the store.
        You will be notified at every step.
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  lead: { color: colors.muted, fontSize: 12.5, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumb: {
    width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  step: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  stepText: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 19 },
  qty: { fontSize: 14, fontWeight: '700', minWidth: 26, textAlign: 'center', color: colors.text },
  removeText: { fontSize: 12, color: colors.red, fontWeight: '600' },
  lineTotal: { fontSize: 14, fontWeight: '700', color: colors.text },
  toggle: { flexDirection: 'row', backgroundColor: '#eef2f6', borderRadius: radius.sm, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center' },
  toggleOn: { backgroundColor: '#fff' },
  toggleText: { fontSize: 12.5, color: colors.muted, fontWeight: '600' },
  toggleTextOn: { color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  foot: { color: colors.muted, fontSize: 11.5, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
