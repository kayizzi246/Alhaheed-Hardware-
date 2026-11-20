import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { api } from '../../lib/api';
import { useCart } from '../../lib/CartContext';
import { useAuth } from '../../lib/AuthContext';
import { money } from '../../lib/format';
import { colors, radius, shadow } from '../../lib/theme';
import { AppHeader, Input, Loading, Empty, Banner, Chip } from '../../components/ui';

/** Fig 1: Customer App - Product List. */
export default function ShopScreen({ navigation }) {
  const { user } = useAuth();
  const { add, count } = useCart();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [added, setAdded] = useState('');

  useEffect(() => {
    api('/api/products/categories').then((r) => setCategories(r.categories)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category !== 'all') params.set('category', category);
      const r = await api(`/api/products?${params}`);
      setProducts(r.products);
    } catch (e) { setError(e.message); }
  }, [search, category]);

  // Debounce the search so typing does not hammer the API.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const onAdd = (p) => {
    add(p, 1);
    setAdded(p.name);
    setTimeout(() => setAdded(''), 1600);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader
        subtitle={
          user?.companyId
            ? `${user.company?.company_name || 'Company'} · ordering as ${user.fullName}`
            : user?.fullName
        }
      />

      <View style={s.searchWrap}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search cement, iron bars, paint…"
        />
      </View>

      <View style={s.catRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: 'All' }, ...categories]}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
          renderItem={({ item }) => {
            const on = String(category) === String(item.id);
            return (
              <Pressable
                onPress={() => setCategory(item.id)}
                style={[s.cat, on && { backgroundColor: colors.orange, borderColor: colors.orange }]}
              >
                <Text style={[s.catText, on && { color: '#fff' }]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {!!added && (
        <View style={{ paddingHorizontal: 14 }}>
          <Banner kind="ok">{added} added to your cart</Banner>
        </View>
      )}
      {!!error && <View style={{ paddingHorizontal: 14 }}><Banner>{error}</Banner></View>}

      {products === null ? (
        <Loading label="Loading products…" />
      ) : products.length === 0 ? (
        <Empty>No products match that search.</Empty>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 14 }}
          contentContainerStyle={{ paddingVertical: 12, gap: 10, paddingBottom: 28 }}
          renderItem={({ item }) => (
            <View style={[s.tile, shadow]}>
              <Pressable
                style={s.thumb}
                onPress={() => navigation.navigate('Product', { product: item })}
              >
                <Text style={s.thumbText} numberOfLines={2}>
                  {item.name.split(' ').slice(0, 2).join('\n').toUpperCase()}
                </Text>
              </Pressable>

              <Text style={s.name} numberOfLines={2}>{item.name}</Text>
              <Text style={s.unit}>{item.unit}</Text>

              <View style={s.priceRow}>
                <Text style={s.price}>{money(item.price)}</Text>
                <Pressable
                  style={[s.addBtn, item.stock_available === 0 && { backgroundColor: colors.border }]}
                  disabled={item.stock_available === 0}
                  onPress={() => onAdd(item)}
                >
                  <Text style={s.addText}>+</Text>
                </Pressable>
              </View>

              {item.stock_available === 0 ? (
                <Chip tone="red">Out of stock</Chip>
              ) : item.stock_available <= item.reorder_level ? (
                <Chip tone="pending">{item.stock_available} left</Chip>
              ) : (
                <Text style={s.stock}>{item.stock_available} in stock</Text>
              )}
            </View>
          )}
        />
      )}

      {count > 0 && (
        <Pressable style={s.cartBar} onPress={() => navigation.navigate('Cart')}>
          <Text style={s.cartBarText}>
            View cart · {count} item{count === 1 ? '' : 's'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  searchWrap: { padding: 14, paddingBottom: 10, backgroundColor: colors.navy },
  catRow: { paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  cat: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
  catText: { fontSize: 12.5, color: colors.text, fontWeight: '600' },

  tile: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: 10,
  },
  thumb: {
    height: 78, borderRadius: radius.sm, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginBottom: 9,
  },
  thumbText: { color: '#fff', fontWeight: '800', fontSize: 12, textAlign: 'center', letterSpacing: 0.5 },
  name: { fontSize: 13, fontWeight: '600', color: colors.text, minHeight: 34 },
  unit: { fontSize: 11, color: colors.muted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 6 },
  price: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  addBtn: {
    width: 28, height: 28, borderRadius: 7, backgroundColor: colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  addText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 21 },
  stock: { fontSize: 11, color: colors.muted },

  cartBar: {
    position: 'absolute', left: 14, right: 14, bottom: 14,
    backgroundColor: colors.navy, borderRadius: radius.md, padding: 14, alignItems: 'center',
  },
  cartBarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
