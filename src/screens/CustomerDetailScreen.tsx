import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InfoCard } from '../components/InfoCard';
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
import { formatTurkishPhone } from '../utils/phone';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;

function eggEmoji(name?: string) {
  switch (name?.toLocaleLowerCase('tr-TR')) {
    case 'tavuk': return '🐔';
    case 'hindi': return '🦃';
    case 'bıldırcın': return '🐦';
    case 'kaz': return '🪿';
    case 'ördek': return '🦆';
    case 'keklik': return '🐦';
    default: return '🥚';
  }
}

function displayDate(value?: string | null) {
  return value ? formatDateTR(value) : '—';
}

export function CustomerDetailScreen({ navigation, route }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [eggTypes, setEggTypes] = useState<EggType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eggTypeError, setEggTypeError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      setEggTypeError(null);
      try {
        const [customerData, batchData, paymentData] = await Promise.all([
          customerService.getById(route.params.customerId),
          batchService.listByCustomer(route.params.customerId),
          paymentService.list(),
        ]);
        if (active) {
          setCustomer(customerData);
          setBatches(batchData);
          setPayments(paymentData.filter((payment) => payment.customerId === route.params.customerId));
        }
        try {
          const eggTypeData = await eggTypeService.list();
          if (active) setEggTypes(eggTypeData);
        } catch (eggTypeLoadError) {
          if (active) {
            setEggTypeError(eggTypeLoadError instanceof Error ? eggTypeLoadError.message : 'Yumurta türü bilgileri yüklenemedi.');
          }
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Müşteri bilgileri yüklenemedi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [route.params.customerId]));

  function confirmArchive() {
    Alert.alert(
      'Müşteriyi Sil',
      'Bu müşteriyi arşivlemek istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Arşivle', style: 'destructive', onPress: () => { void archiveCustomer(); } },
      ],
    );
  }

  async function archiveCustomer() {
    if (!customer || archiving) return;
    setArchiving(true);
    try {
      await customerService.archive(customer.id);
      navigation.goBack();
    } catch (archiveError) {
      Alert.alert('Arşivleme başarısız', archiveError instanceof Error ? archiveError.message : 'Müşteri arşivlenemedi.');
    } finally {
      setArchiving(false);
    }
  }

  const totalEggs = batches.reduce((sum, batch) => sum + batch.eggCount, 0);
  const totalPrice = batches.reduce((sum, batch) => sum + batch.totalPrice, 0);
  const paid = paymentService.calculatePaidTotal(payments);
  const debt = totalPrice - paid;

  if (loading) {
    return <Screen><Text style={styles.state}>Yükleniyor...</Text></Screen>;
  }

  if (error || !customer) {
    return <Screen><Text style={styles.error}>{error ?? 'Müşteri kaydı bulunamadı.'}</Text></Screen>;
  }

  return (
    <Screen>
      <FlatList
        data={batches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionTitle}>Müşteri Bilgileri</Text>
            <Text style={styles.title}>{customer.firstName} {customer.lastName}</Text>
            <Text style={styles.phone}>{formatTurkishPhone(customer.phoneNormalized)}</Text>
            {eggTypeError ? <Text style={styles.warning}>Yumurta türü bilgileri alınamadı: {eggTypeError}</Text> : null}
            {!customer.isActive ? <Text style={styles.archived}>Arşivlenmiş müşteri</Text> : null}
            {customer.note ? <Text style={styles.note}>{customer.note}</Text> : null}
            <PrimaryButton
              title="MÜŞTERİ BİLGİLERİNİ DÜZENLE"
              variant="secondary"
              onPress={() => navigation.navigate('NewCustomer', { customerId: customer.id })}
            />
            <View style={styles.grid}><InfoCard title="Yumurta kabulü" value={`${batches.length}`} /><InfoCard title="Toplam yumurta" value={`${totalEggs}`} /></View>
            <View style={styles.grid}><InfoCard title="Toplam tutar" value={formatCurrency(totalPrice)} /><InfoCard title="Toplam ödenen" value={formatCurrency(paid)} tone="success" /></View>
            <View style={styles.grid}><InfoCard title="Toplam borç" value={formatCurrency(debt)} tone="warning" /></View>
            <Text style={styles.sectionTitle}>Ödemeler</Text>
            {payments.length === 0 ? <Text style={styles.state}>Henüz ödeme kaydı yok.</Text> : payments.map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <View>
                  <Text style={styles.paymentDate}>{displayDate(payment.paymentDate)}</Text>
                  <Text style={styles.paymentMethod}>{payment.paymentMethod || 'Ödeme'}</Text>
                </View>
                <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
              </View>
            ))}
            <Text style={styles.sectionTitle}>Geçmiş Yumurta Kabulleri</Text>
            {customer.isActive ? <PrimaryButton title="Yeni Yumurta Kabul" onPress={() => navigation.navigate('NewBatch', { customerId: customer.id })} /> : null}
            {customer.isActive ? (
              <Pressable
                accessibilityRole="button"
                disabled={archiving}
                onPress={confirmArchive}
                style={({ pressed }) => [styles.archiveButton, pressed && styles.archivePressed, archiving && styles.archiveDisabled]}
              >
                <Text style={styles.archiveText}>{archiving ? 'Arşivleniyor...' : 'Müşteriyi Sil'}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.state}>Geçmiş yumurta kabulü bulunmuyor.</Text>}
        renderItem={({ item }) => {
          const eggType = eggTypes.find((candidate) => candidate.id === item.eggTypeId);
          const batchPayments = payments.filter((payment) => payment.batchId === item.id);
          const batchPaid = paymentService.calculatePaidTotal(batchPayments);
          return (
            <Pressable onPress={() => navigation.navigate('BatchDetail', { batchId: item.id })} style={({ pressed }) => [styles.batchCard, pressed && styles.batchPressed]}>
              <Text style={styles.batchTitle}>{eggEmoji(eggType?.name)} {item.eggCount} {eggType ? `${eggType.name} yumurtası` : 'yumurta'}</Text>
              <View style={styles.batchDetails}>
                <Text style={styles.batchLabel}>Kuluçka</Text>
                <Text style={styles.batchValue}>{displayDate(item.incubationDate)}</Text>
                <Text style={styles.batchLabel}>Tahmini çıkım</Text>
                <Text style={styles.batchValue}>{displayDate(item.expectedHatchDate)}</Text>
                <Text style={styles.batchLabel}>Toplam</Text>
                <Text style={styles.batchValue}>{formatCurrency(item.totalPrice)}</Text>
                <Text style={styles.batchLabel}>Ödenen</Text>
                <Text style={styles.batchValue}>{formatCurrency(batchPaid)}</Text>
                <Text style={styles.batchLabel}>Kalan</Text>
                <Text style={[styles.batchValue, styles.batchDebt]}>{formatCurrency(item.totalPrice - batchPaid)}</Text>
              </View>
              <Text style={styles.openHint}>Detay ve ödeme geçmişini aç</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  phone: { color: colors.primary, marginTop: 6, fontWeight: '900' },
  archived: { color: colors.textMuted, marginTop: 8, fontWeight: '800' },
  warning: { color: colors.danger, marginTop: 10, fontWeight: '700' },
  note: { color: colors.textMuted, marginTop: 10, lineHeight: 21 },
  error: { color: colors.danger, textAlign: 'center', margin: 24, fontWeight: '800' },
  archiveButton: { minHeight: 52, marginTop: 12, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  archivePressed: { opacity: 0.75 },
  archiveDisabled: { opacity: 0.55 },
  archiveText: { color: colors.danger, fontSize: 15, fontWeight: '900' },
  grid: { flexDirection: 'row', gap: 12, marginTop: 14 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 24, marginBottom: 10 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  paymentDate: { color: colors.text, fontWeight: '900' },
  paymentMethod: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  paymentAmount: { color: colors.success, fontWeight: '900' },
  batchCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  batchPressed: { opacity: 0.82 },
  batchTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  batchDetails: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  batchLabel: { width: '50%', color: colors.textMuted, paddingVertical: 5, fontSize: 13, fontWeight: '700' },
  batchValue: { width: '50%', color: colors.text, paddingVertical: 5, textAlign: 'right', fontWeight: '800' },
  batchDebt: { color: colors.danger },
  openHint: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 8 },
  state: { color: colors.textMuted, textAlign: 'center', margin: 24, fontWeight: '700' },
});
