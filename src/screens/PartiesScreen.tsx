import { useFocusedRefresh } from '../hooks/useFocusedRefresh';
import { clearQueryCache } from '../services/queryCache';
import { PageHeading } from '../components/PageHeading';
import { AppIcon } from '../components/AppIcon';
import { FilterPicker } from '../components/FilterPicker';
import { batchStatusLabels, filterBatches, type BatchFilters } from '../utils/batchFilters';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DemoModeBadge } from '../components/DemoModeBadge';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import type { RootStackParamList } from '../navigation/types';
import { batchService } from '../services/batchService';
import { customerService } from '../services/customerService';
import { eggTypeService } from '../services/eggTypeService';
import { paymentService } from '../services/paymentService';
import { colors } from '../theme/colors';
import type { Batch, Customer, EggType, Payment } from '../types/models';
import { formatDateTR } from '../utils/dateRules';
import { formatCurrency } from '../utils/money';

export function PartiesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [eggTypes, setEggTypes] = useState<EggType[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const loaded = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BatchFilters>({ query: '', customerId: '', status: '', eggTypeId: '', debtOnly: false });
  const updateFilter = <K extends keyof BatchFilters>(key: K, value: BatchFilters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters({ query: '', customerId: '', status: '', eggTypeId: '', debtOnly: false });
  const hasFilters = Boolean(filters.query.trim() || filters.customerId || filters.status || filters.eggTypeId || filters.debtOnly);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading && !loaded.current) setLoading(true);
    setError(null);
    try {
      const [batchData, customerData, eggTypeData, paymentData] = await Promise.all([
        batchService.list(),
        customerService.list({ includeArchived: true }),
        eggTypeService.list(),
        paymentService.list(),
      ]);
      setBatches(batchData);
      setCustomers(customerData);
      setEggTypes(eggTypeData);
      setPayments(paymentData);
      loaded.current = true;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Veriler yüklenemedi.');
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

  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const eggTypesById = useMemo(() => new Map(eggTypes.map((eggType) => [eggType.id, eggType])), [eggTypes]);
  const paidByBatch = useMemo(() => {
    const totals = new Map<string, number>();
    for (const payment of payments.filter((p) => !p.voidedAt)) totals.set(payment.batchId, (totals.get(payment.batchId) ?? 0) + payment.amount);
    return totals;
  }, [payments]);
  const filtered = useMemo(() => filterBatches(batches, customersById, eggTypesById, paidByBatch, filters), [batches, customersById, eggTypesById, paidByBatch, filters]);
  const customerOptions = useMemo(() => [{ value: '', label: 'Tüm müşteriler' }, ...customers.map((customer) => ({ value: customer.id, label: `${customer.firstName} ${customer.lastName === '-' ? '' : customer.lastName}`.trim(), detail: `${customer.phone}${customer.isActive ? '' : ' · Arşivde'}` })).sort((a, b) => a.label.localeCompare(b.label, 'tr'))], [customers]);

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <DemoModeBadge />
            <PageHeading eyebrow="YUMURTADAN HAYATA" title="Yumurta kayıtları" subtitle="Her yumurtanın yolculuğu burada başlar." />
            <View style={styles.header}>
              <Text style={styles.listLabel}>{filtered.length} / {batches.length} kabul</Text>
              <PrimaryButton title="+ Yeni kabul" onPress={() => navigation.navigate('NewBatch')} />
            </View>
            <View style={styles.filterCard}>
              <TextInput accessibilityLabel="Yumurta kayıtlarında ara" value={filters.query} onChangeText={(value) => updateFilter('query', value)} placeholder="Müşteri, telefon veya kabul no ara" placeholderTextColor={colors.textMuted} autoCorrect={false} style={styles.search} />
              <View style={styles.filterRow}>
                <FilterPicker label="Müşteri" value={filters.customerId} options={customerOptions} onChange={(value) => updateFilter('customerId', value)} />
                <FilterPicker label="Durum" value={filters.status} options={[{ value: '', label: 'Tüm durumlar' }, ...Object.entries(batchStatusLabels).map(([value, label]) => ({ value, label }))]} onChange={(value) => updateFilter('status', value)} />
                <FilterPicker label="Yumurta türü" value={filters.eggTypeId} options={[{ value: '', label: 'Tüm türler' }, ...eggTypes.map((eggType) => ({ value: eggType.id, label: eggType.name }))]} onChange={(value) => updateFilter('eggTypeId', value)} />
              </View>
              <View style={styles.filterFooter}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: filters.debtOnly }} onPress={() => updateFilter('debtOnly', !filters.debtOnly)} style={styles.debtFilter}><View style={[styles.checkbox, filters.debtOnly && styles.checked]}>{filters.debtOnly ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={styles.debtFilterText}>Sadece borçlular</Text></Pressable>
                {hasFilters ? <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.clearFilters}><Text style={styles.clearText}>Temizle</Text></Pressable> : null}
              </View>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.state}>{error}</Text> : null}
            {loading ? <Text style={styles.state}>Yükleniyor...</Text> : null}
          </View>
        }
        ListEmptyComponent={!loading && !error ? <Text style={styles.state}>{hasFilters ? 'Bu filtrelere uygun kayıt bulunamadı.' : 'Yumurta kabul kaydı bulunamadı.'}</Text> : null}
        renderItem={({ item }) => {
          const customer = customersById.get(item.customerId);
          const eggType = eggTypesById.get(item.eggTypeId);
          const paid = paidByBatch.get(item.id) ?? 0;
          const remaining = item.totalPrice - paid;

          return (
            <Pressable
              onPress={() => navigation.navigate('BatchDetail', { batchId: item.id })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.batchTop}><View style={styles.eggBadge}><AppIcon name="egg" size={20} color={colors.primary} /></View><Text style={styles.batchNo}>{item.batchNo}</Text><Text style={styles.status}>{batchStatusLabels[item.status] ?? item.status}</Text></View>
              <Text style={styles.name}>{customer ? `${customer.firstName} ${customer.lastName}` : 'Müşteri'}</Text>
              <Text style={styles.meta}>{eggType?.name ?? 'Yumurta türü belirtilmemiş'} · {item.eggCount} adet</Text>
              <View style={styles.details}>
                <Text style={styles.meta}>Kuluçka: {item.incubationDate ? formatDateTR(item.incubationDate) : '—'}</Text>
                <Text style={styles.meta}>Tahmini çıkım: {item.expectedHatchDate ? formatDateTR(item.expectedHatchDate) : '—'}</Text>
                <Text style={styles.meta}>Kabul: {formatDateTR(item.receivedDate)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.finance}>Toplam {formatCurrency(item.totalPrice)}</Text>
                <Text style={styles.finance}>Ödenen {formatCurrency(paid)}</Text>
                <Text style={styles.debt}>Kalan {formatCurrency(remaining)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterCard: { gap: 10, marginBottom: 16 },
  search: { minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 15, paddingHorizontal: 14, color: colors.text, fontSize: 12 },
  filterRow: { flexDirection: 'row', gap: 7 },
  filterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  debtFilter: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 40 },
  checkbox: { width: 19, height: 19, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.surface, fontSize: 12, fontWeight: '800' },
  debtFilterText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  clearFilters: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center' },
  clearText: { color: colors.red, fontSize: 11, fontWeight: '700' },
  status: { marginLeft: 'auto', flexShrink: 1, color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '600' },
  listLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 12, alignSelf: 'center' },
  batchTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  eggBadge: { width: 32, height: 34, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  batchNo: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  content: { padding: 20, paddingBottom: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  pressed: { opacity: 0.82 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 5 },
  meta: { color: colors.textMuted, marginTop: 6 },
  details: { marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  finance: { color: colors.text, fontSize: 13, fontWeight: '800' },
  debt: { color: colors.danger, fontWeight: '900' },
  state: { color: colors.textMuted, textAlign: 'center', marginVertical: 20, fontWeight: '700' },
});
