import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCart } from '../../lib/CartContext';
import { money } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import { Screen, Card, Button, Chip, KeyValue } from '../../components/ui';

/** Product detail with a quantity stepper. */
export default function ProductScreen({ route, navigation }) {
  const { product } = route.params;
  const { add } = useCart();
  const [qty, setQty] = useState(1);

  const max = product.stock_available;

  return (
    <Screen>
      <View style={s.hero}>
        <Text style={s.heroText}>{product.name.toUpperCase()}</Text>
      </View>

      <Card>
        <Text style={s.name}>{product.name}</Text>
        <Text style={s.code}>{product.code} · {product.category_name}</Text>
        <Text style={s.price}>{money(product.price)} <Text style={s.per}>per {product.unit}</Text></Text>

        {max === 0
          ? <Chip tone="red">Out of stock</Chip>
          : max <= product.reorder_level
            ? <Chip tone="pending">Only {max} {product.unit} left</Chip>
            : <Chip tone="green">{max} {product.unit} in stock</Chip>}

        {!!product.description && <Text style={s.desc}>{product.description}</Text>}
      </Card>

      <Card>
        <KeyValue k="Unit" v={product.unit} />
        <KeyValue k="Supplier" v={product.supplier || '—'} />
        <KeyValue k="In stock" v={`${max} ${product.unit}`} />
        {!!product.remarks && <KeyValue k="Remarks" v={product.remarks} />}
      </Card>

      <Card>
        <Text style={s.qtyLabel}>Quantity</Text>
        <View style={s.stepper}>
          <Button title="−" variant="ghost" small onPress={() => setQty((q) => Math.max(1, q - 1))} />
          <Text style={s.qty}>{qty}</Text>
          <Button title="+" variant="ghost" small onPress={() => setQty((q) => Math.min(max, q + 1))} />
          <View style={{ flex: 1 }} />
          <Text style={s.lineTotal}>{money(product.price * qty)}</Text>
        </View>

        <Button
          title={max === 0 ? 'Out of stock' : 'Add to cart'}
          disabled={max === 0}
          style={{ marginTop: 14 }}
          onPress={() => {
            add(product, qty);
            navigation.goBack();
          }}
        />
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: {
    height: 150, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroText: { color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: 1, textAlign: 'center', paddingHorizontal: 20 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  code: { fontSize: 12, color: colors.muted, marginTop: 3, marginBottom: 10 },
  price: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 10 },
  per: { fontSize: 13, fontWeight: '500', color: colors.muted },
  desc: { fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: 12 },
  qtyLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qty: { fontSize: 17, fontWeight: '700', minWidth: 34, textAlign: 'center', color: colors.text },
  lineTotal: { fontSize: 16, fontWeight: '700', color: colors.text },
});
