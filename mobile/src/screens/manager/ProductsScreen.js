import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import {
  Screen, Card, Chip, Button, Field, Input, Banner, Empty, Loading, SectionTitle,
} from '../../components/ui';

/** Manager: products, prices and availability. */
export default function ProductsScreen() {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);   // product or 'new'
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        api(`/api/products?${search ? `search=${encodeURIComponent(search)}` : ''}`),
        api('/api/products/categories'),
      ]);
      setProducts(p.products);
      setCategories(c.categories);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function retire(product) {
    Alert.alert(`Retire ${product.name}?`, 'It will no longer appear in the customer catalogue.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Retire',
        style: 'destructive',
        onPress: async () => {
          try { await api(`/api/products/${product.id}`, { method: 'DELETE' }); load(); }
          catch (e) { setError(e.message); }
        },
      },
    ]);
  }

  if (products === null) return <Loading label="Loading products…" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Field>
        <Input value={search} onChangeText={setSearch} placeholder="Search products" />
      </Field>

      <Banner>{error}</Banner>
      <Banner kind="ok">{notice}</Banner>

      <SectionTitle right={<Button title="+ New product" small variant="ghost" onPress={() => setEditing('new')} />}>
        {products.length} PRODUCT{products.length === 1 ? '' : 'S'}
      </SectionTitle>

      {products.length === 0 ? (
        <Empty>No products match.</Empty>
      ) : (
        products.map((p) => (
          <Card key={p.id}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.meta}>{p.code} · {p.category_name}</Text>
                <Text style={s.meta}>{money(p.price)} per {p.unit} · {p.stock_available} in stock</Text>
              </View>
              {p.stock_available <= p.reorder_level && <Chip tone="red">Low</Chip>}
            </View>

            <View style={s.actions}>
              <Button title="Edit" variant="ghost" small onPress={() => setEditing(p)} />
              <Button title="Retire" variant="danger" small onPress={() => retire(p)} />
            </View>
          </Card>
        ))
      )}

      {editing && (
        <ProductSheet
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onDone={(msg) => {
            setEditing(null);
            setNotice(msg);
            setTimeout(() => setNotice(''), 4000);
            load();
          }}
        />
      )}
    </Screen>
  );
}

function ProductSheet({ product, categories, onClose, onDone }) {
  const isNew = !product;
  const [form, setForm] = useState({
    code: product?.code || '',
    name: product?.name || '',
    unit: product?.unit || 'pc',
    price: String(product?.price || ''),
    stockAvailable: String(product?.stock_available || 0),
    reorderLevel: String(product?.reorder_level || 0),
    supplier: product?.supplier || '',
    categoryId: product?.category_id || categories[0]?.id || null,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError(''); setBusy(true);
    try {
      const body = {
        code: form.code,
        name: form.name,
        unit: form.unit,
        price: Math.trunc(Number(form.price)),
        reorderLevel: Math.trunc(Number(form.reorderLevel)),
        supplier: form.supplier || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
      };
      if (isNew) {
        body.stockAvailable = Math.trunc(Number(form.stockAvailable));
        await api('/api/products', { method: 'POST', body });
        onDone(`${form.name} added to the catalogue.`);
      } else {
        await api(`/api/products/${product.id}`, { method: 'PATCH', body });
        onDone(`${form.name} updated.`);
      }
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>{isNew ? 'New product' : 'Edit product'}</Text>
            {!isNew && product.price !== Number(form.price) && (
              <Text style={s.sheetLead}>
                Price changes are recorded in the price history.
              </Text>
            )}

            <Banner>{error}</Banner>

            <Field label="Product code">
              <Input value={form.code} onChangeText={set('code')} placeholder="AH-CEM-003" autoCapitalize="characters" />
            </Field>
            <Field label="Name">
              <Input value={form.name} onChangeText={set('name')} placeholder="Hima Cement 50kg" />
            </Field>
            <Field label="Category">
              <View style={s.chips}>
                {categories.map((c) => (
                  <Text
                    key={c.id}
                    onPress={() => set('categoryId')(c.id)}
                    style={[s.catChip, Number(form.categoryId) === c.id && s.catChipOn]}
                  >
                    {c.name}
                  </Text>
                ))}
              </View>
            </Field>
            <Field label="Unit">
              <Input value={form.unit} onChangeText={set('unit')} placeholder="bag / pc / length" />
            </Field>
            <Field label="Price (UGX)">
              <Input value={form.price} onChangeText={set('price')} keyboardType="number-pad" />
            </Field>
            {isNew && (
              <Field label="Opening stock">
                <Input value={form.stockAvailable} onChangeText={set('stockAvailable')} keyboardType="number-pad" />
              </Field>
            )}
            <Field label="Reorder level">
              <Input value={form.reorderLevel} onChangeText={set('reorderLevel')} keyboardType="number-pad" />
            </Field>
            <Field label="Supplier">
              <Input value={form.supplier} onChangeText={set('supplier')} />
            </Field>

            <Button
              title={isNew ? 'Add product' : 'Save changes'}
              onPress={submit}
              busy={busy}
              disabled={form.name.length < 2 || form.code.length < 2 || !Number(form.price)}
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
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,36,57,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 14 },
  sheetLead: { fontSize: 12, color: colors.muted, marginTop: -8, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
    borderColor: colors.border, fontSize: 12, color: colors.text, overflow: 'hidden',
  },
  catChipOn: { backgroundColor: colors.orange, borderColor: colors.orange, color: '#fff' },
});
