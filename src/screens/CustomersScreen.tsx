import { useFocusedRefresh } from '../hooks/useFocusedRefresh';
import { clearQueryCache } from '../services/queryCache';
import { PageHeading } from '../components/PageHeading';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DemoModeBadge } from '../components/DemoModeBadge';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import type { RootStackParamList } from '../navigation/types';
import { customerService } from '../services/customerService';
import { colors } from '../theme/colors';
import type { CustomerSummary } from '../types/models';
import { formatCurrency } from '../utils/money';

export function CustomersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const loaded = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    try {
      if (showLoading && !loaded.current) setLoading(true);
      setError(null);
      setCustomers(await customerService.listWithSummary({ includeArchived: true }));
      loaded.current = true;
    } catch {
      setError('Müşteriler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusedRefresh(() => { void load(); }, ['customer', 'batch', 'payment', 'eggType']);

  const onRefresh = useCallback(() => {
    clearQueryCache();
    setRefreshing(true);
    void load(false);
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr-TR');
    const visible = customers.filter((customer) => showArchived || customer.isActive);
    if (!term) return visible;
    return visible.filter((customer) =>
      `${customer.firstName} ${customer.lastName} ${customer.phone}`.toLocaleLowerCase('tr-TR').includes(term),
    );
  }, [customers, query, showArchived]);

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <DemoModeBadge />
            <PageHeading eyebrow="BİRLİKTE BÜYÜYORUZ" title="Müşteriler" subtitle="Müşterilerin, kayıtları ve ödemeleri bir arada." />
            <View style={styles.header}>
              <Text style={styles.listLabel}>{filtered.length} müşteri</Text>
              <PrimaryButton title="+ Yeni müşteri" onPress={() => navigation.navigate('NewCustomer')} />
            </View>
            <PrimaryButton title={showArchived ? "Arşivdekileri gizle" : "Arşivdekileri de göster"} variant="secondary" onPress={() => setShowArchived((value) => !value)} />
            <TextField label="Ara" value={query} onChangeText={setQuery} placeholder="Ad, soyad veya telefon" />
            {loading ? <Text style={styles.state}>Yükleniyor...</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={!loading && !error ? <Text style={styles.state}>Kayıtlı müşteri bulunamadı.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.customerTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.firstName.slice(0, 1)}{item.lastName.slice(0, 1)}</Text></View>
              <View style={styles.customerCopy}><Text style={styles.name}>{item.firstName} {item.lastName}{item.isActive ? "" : " · Arşivde"}</Text><Text style={styles.phone}>{item.phone}</Text></View>
              <Text style={styles.chevron}>›</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.metric}>{item.activeBatchCount} aktif yumurta kabulü</Text>
              <Text style={styles.debt}>{item.totalDebt < 0 ? `Alacak: ${formatCurrency(Math.abs(item.totalDebt))}` : formatCurrency(item.totalDebt)}</Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 12, alignSelf: 'center' },
  customerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerCopy: { flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '900', fontSize: 15 },
  chevron: { color: colors.primary, fontSize: 28 },
  content: { padding: 20, paddingBottom: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  pressed: { opacity: 0.82 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  phone: { color: colors.textMuted, marginTop: 5, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  metric: { color: colors.primary, fontWeight: '900' },
  debt: { color: colors.danger, fontWeight: '900' },
  state: { color: colors.textMuted, textAlign: 'center', marginVertical: 20, fontWeight: '700' },
  error: { color: colors.danger, marginBottom: 12, fontWeight: '800' },
});
