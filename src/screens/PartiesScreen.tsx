import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DemoModeBadge } from '../components/DemoModeBadge';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import type { RootStackParamList } from '../navigation/types';
import { batchService } from '../services/batchService';
import { customerService } from '../services/customerService';
import { subscribeDataChanged } from '../services/dataEvents';
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
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
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => subscribeDataChanged((event) => {
    if (event === 'batch' || event === 'customer' || event === 'payment') {
      void load(false);
    }
  }), [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(false);
  }, [load]);

  return (
    <Screen>
      <FlatList
        data={batches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <DemoModeBadge />
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Yumurta Kayıtları</Text>
                <Text style={styles.subtitle}>Müşterilerin yumurta kabulleri ve ödeme durumu.</Text>
              </View>
              <PrimaryButton title="Yeni Yumurta Kabul" onPress={() => navigation.navigate('NewBatch')} />
            </View>
            {loading ? <Text style={styles.state}>Yükleniyor...</Text> : null}
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.state}>Yumurta kabul kaydı bulunamadı.</Text> : null}
        renderItem={({ item }) => {
          const customer = customers.find((candidate) => candidate.id === item.customerId);
          const eggType = eggTypes.find((candidate) => candidate.id === item.eggTypeId);
          const batchPayments = payments.filter((payment) => payment.batchId === item.id);
          const paid = paymentService.calculatePaidTotal(batchPayments);
          const remaining = paymentService.calculateRemainingDebt(item.totalPrice, batchPayments);

          return (
            <Pressable
              onPress={() => navigation.navigate('BatchDetail', { batchId: item.id })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
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
  content: { padding: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textMuted, marginTop: 6 },
  card: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  pressed: { opacity: 0.82 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 5 },
  meta: { color: colors.textMuted, marginTop: 6 },
  details: { marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  finance: { color: colors.text, fontSize: 13, fontWeight: '800' },
  debt: { color: colors.danger, fontWeight: '900' },
  state: { color: colors.textMuted, textAlign: 'center', marginVertical: 20, fontWeight: '700' },
});
