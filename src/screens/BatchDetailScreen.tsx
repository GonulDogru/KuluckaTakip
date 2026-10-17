import { useCallback, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { DateField } from '../components/DateField';
import { InfoCard } from '../components/InfoCard';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import type { RootStackParamList } from '../navigation/types';
import { batchService } from '../services/batchService';
import { customerService } from '../services/customerService';
import { eggTypeService } from '../services/eggTypeService';
import { paymentService } from '../services/paymentService';
import { colors } from '../theme/colors';
import type { Batch, Customer, EggType, Payment } from '../types/models';
import { calculateBatchDates, formatDateTR, isValidDateOnly } from '../utils/dateRules';
import { formatCurrency } from '../utils/money';
import { todayDateOnly } from '../utils/today';

type Props = NativeStackScreenProps<RootStackParamList, 'BatchDetail'>;

export function BatchDetailScreen({ navigation, route }: Props) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [eggType, setEggType] = useState<EggType | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentModal, setPaymentModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayDateOnly());
  const [editModal, setEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [eggTypes, setEggTypes] = useState<EggType[]>([]);
  const [editEggTypeId, setEditEggTypeId] = useState('');
  const [editEggCount, setEditEggCount] = useState('');
  const [editIncubationDate, setEditIncubationDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const saveEditLock = useRef(false);

  const load = useCallback(async () => {
    const batchData = await batchService.getById(route.params.batchId);
    setBatch(batchData);
    if (!batchData) return;
    const [customerData, eggTypeOptions, paymentData] = await Promise.all([
      customerService.getById(batchData.customerId),
      eggTypeService.list(),
      paymentService.listByBatch(batchData.id),
    ]);
    setCustomer(customerData);
    setEggType(eggTypeOptions.find((item) => item.id === batchData.eggTypeId) ?? null);
    setEggTypes(eggTypeOptions);
    setPayments(paymentData);
  }, [route.params.batchId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!batch) return <Screen><Text style={styles.state}>Yükleniyor...</Text></Screen>;

  const currentBatch = batch;
  const paid = paymentService.calculatePaidTotal(payments);
  const remaining = currentBatch.totalPrice - paid;

  async function addPayment() {
    const amount = Number(paymentAmount.trim().replace(',', '.'));
    if (!customer || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Uyarı', 'Geçerli bir ödeme tutarı girin.');
      return;
    }
    if (savingPayment) return;

    setSavingPayment(true);
    try {
      await paymentService.create({ customerId: customer.id, batchId: currentBatch.id, amount, paymentMethod: 'Nakit', paymentDate, note: null });
      setPaymentAmount('');
      setPaymentDate(todayDateOnly());
      setPaymentModal(false);
      await load();
      Alert.alert('Tamamlandı', 'Ödeme kaydedildi.');
    } catch (error) {
      Alert.alert('Ödeme eklenemedi', error instanceof Error ? error.message : 'Ödeme kaydedilirken bir hata oluştu.');
    } finally {
      setSavingPayment(false);
    }
  }

  function openEditForm() {
    setEditEggTypeId(currentBatch.eggTypeId);
    setEditEggCount(String(currentBatch.eggCount));
    setEditIncubationDate(currentBatch.incubationDate ?? '');
    setEditNote(currentBatch.note ?? '');
    setEditModal(true);
  }

  async function saveBatchEdits() {
    if (saveEditLock.current) return;
    const eggCount = Number(editEggCount.trim());
    if (!Number.isInteger(eggCount) || eggCount <= 0) {
      Alert.alert('Bilgi gerekli', "Yumurta adedini 0'dan büyük tam sayı olarak girin.");
      return;
    }
    if (!editEggTypeId.trim()) {
      Alert.alert('Bilgi gerekli', 'Lütfen geçerli bir yumurta türü seçin.');
      return;
    }
    if (editIncubationDate && !isValidDateOnly(editIncubationDate)) {
      Alert.alert('Geçersiz tarih', 'Lütfen kuluçkaya giriş tarihini tarih seçiciden seçin.');
      return;
    }

    saveEditLock.current = true;
    setSavingEdit(true);
    try {
      const updatedBatch = await batchService.update(currentBatch.id, {
        eggTypeId: editEggTypeId,
        eggCount,
        incubationDate: editIncubationDate || null,
        note: editNote.trim() || null,
      });
      if (!updatedBatch) throw new Error('Düzenlenecek yumurta kaydı bulunamadı.');
      setBatch(updatedBatch);
      await load();
      setEditModal(false);
      Alert.alert('Kaydedildi', 'Yumurta kaydı güncellendi.');
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Yumurta kaydı güncellenemedi.';
      try {
        await load();
      } catch (refreshError) {
        const refreshMessage = refreshError instanceof Error ? refreshError.message : 'Güncel kayıt tekrar yüklenemedi.';
        message = `${message} ${refreshMessage}`;
      }
      Alert.alert('Düzenleme kaydedilemedi', message);
    } finally {
      saveEditLock.current = false;
      setSavingEdit(false);
    }
  }

  const selectedEditEggType = eggTypes.find((item) => item.id === editEggTypeId);
  const editExpectedHatchDate = calculateBatchDates(editIncubationDate, selectedEditEggType).expectedHatchDate;

  const rows = [
    ['Müşteri', customer ? `${customer.firstName} ${customer.lastName}` : '-'],
    ['Telefon', customer?.phone ?? '-'],
    ['Yumurta türü', eggType?.name ?? '-'],
    ['Yumurta adedi', `${currentBatch.eggCount}`],
    ['Kabul tarihi', formatDateTR(currentBatch.receivedDate)],
    ['Kuluçka tarihi', formatDateTR(currentBatch.incubationDate)],
    ['Tahmini çıkım', formatDateTR(currentBatch.expectedHatchDate)],
    ['Birim fiyat', formatCurrency(currentBatch.unitPrice)],
    ['Toplam fiyat', formatCurrency(currentBatch.totalPrice)],
    ['Toplam ödeme', formatCurrency(paid)],
    ['Kalan borç', formatCurrency(remaining)],
    ['Not', currentBatch.note ?? '-'],
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{customer ? `${customer.firstName} ${customer.lastName}` : 'Yumurta Kabulü'}</Text>
        <View style={styles.grid}><InfoCard title="Toplam" value={formatCurrency(currentBatch.totalPrice)} /><InfoCard title="Kalan" value={formatCurrency(remaining)} tone="warning" /></View>
        <View style={styles.actions}>
          <PrimaryButton title="DÜZENLE" onPress={openEditForm} variant="secondary" />
          {customer ? <PrimaryButton title="MÜŞTERİYİ AÇ" onPress={() => navigation.navigate('CustomerDetail', { customerId: customer.id })} variant="secondary" /> : null}
          <PrimaryButton title="ÖDEME EKLE" onPress={() => setPaymentModal(true)} />
        </View>
        <View style={styles.detailCard}>{rows.map(([label, value]) => <View key={label} style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
        <View style={styles.detailCard}>
          <Text style={styles.historyTitle}>Ödeme Geçmişi</Text>
          {payments.length === 0 ? <Text style={styles.label}>Henüz ödeme eklenmedi.</Text> : payments.map((payment) => (
            <View key={payment.id} style={styles.row}>
              <Text style={styles.label}>{formatDateTR(payment.paymentDate)} · {payment.paymentMethod}</Text>
              <Text style={styles.value}>{formatCurrency(payment.amount)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.backdrop}>
            <Pressable style={[StyleSheet.absoluteFill, styles.backdropDismiss]} onPress={() => setEditModal(false)} />
            <View style={styles.editSheet}>
              <KeyboardAwareForm bottomPadding={8} contentContainerStyle={styles.sheetContent}>
                <Text style={styles.sheetTitle}>Yumurta Kaydını Düzenle</Text>
                <Text style={styles.label}>Yumurta türü</Text>
                {eggTypes.length === 0 ? <Text style={styles.label}>Aktif yumurta türü bulunamadı.</Text> : null}
                <View style={styles.eggTypeOptions}>
                  {eggTypes.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: editEggTypeId === item.id }}
                      onPress={() => setEditEggTypeId(item.id)}
                      style={[styles.eggTypeOption, editEggTypeId === item.id && styles.eggTypeOptionActive]}
                    >
                      <Text style={[styles.eggTypeOptionText, editEggTypeId === item.id && styles.eggTypeOptionTextActive]}>{item.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextField label="Yumurta adedi" value={editEggCount} onChangeText={setEditEggCount} keyboardType="number-pad" />
                <DateField label="Kuluçkaya Giriş Tarihi" value={editIncubationDate} onChange={setEditIncubationDate} />
                <Text style={styles.label}>Tahmini Çıkım Tarihi</Text>
                <Text accessibilityLabel="Tahmini çıkım tarihi" style={styles.estimatedDate}>
                  {editExpectedHatchDate ? formatDateTR(editExpectedHatchDate) : '—'}
                </Text>
                <TextField label="Not" value={editNote} onChangeText={setEditNote} multiline />
                <PrimaryButton title={savingEdit ? 'Kaydediliyor...' : 'Kaydet'} onPress={saveBatchEdits} disabled={savingEdit || !editEggTypeId} />
                <PrimaryButton title="Vazgeç" onPress={() => setEditModal(false)} variant="secondary" disabled={savingEdit} />
              </KeyboardAwareForm>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={paymentModal} transparent animationType="slide" onRequestClose={() => setPaymentModal(false)}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.backdrop}>
            <Pressable style={[StyleSheet.absoluteFill, styles.backdropDismiss]} onPress={() => setPaymentModal(false)} />
            <View style={styles.sheet}>
              <KeyboardAwareForm bottomPadding={8} contentContainerStyle={styles.sheetContent}>
                <Text style={styles.sheetTitle}>Ödeme Ekle</Text>
                <Text style={styles.label}>Kalan borç: {formatCurrency(remaining)}</Text>
                <TextField label="Tutar" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" />
                <DateField label="Ödeme Tarihi" value={paymentDate} onChange={setPaymentDate} />
                <PrimaryButton title={savingPayment ? 'Kaydediliyor...' : 'Kaydet'} onPress={addPayment} disabled={savingPayment} />
              </KeyboardAwareForm>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 4 },
  grid: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actions: { gap: 10, marginTop: 16 },
  detailCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 16 },
  row: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  value: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  historyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  state: { color: colors.textMuted, textAlign: 'center', margin: 24, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(23, 32, 51, 0.36)', justifyContent: 'flex-end' },
  backdropDismiss: { zIndex: 0 },
  modalKeyboard: { flex: 1 },
  sheet: { zIndex: 1, width: '100%', height: '55%', minHeight: 320, maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 28, gap: 10 },
  editSheet: { zIndex: 1, width: '100%', height: '82%', minHeight: 440, maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 28, gap: 10 },
  sheetContent: { padding: 0 },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  eggTypeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  eggTypeOption: { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 14 },
  eggTypeOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  eggTypeOptionText: { color: colors.text, fontWeight: '900' },
  eggTypeOptionTextActive: { color: colors.surface },
  estimatedDate: { color: colors.textMuted, backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 16, fontSize: 16, fontWeight: '800', marginBottom: 14 },
});
