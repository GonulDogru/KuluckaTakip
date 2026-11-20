import { useCallback, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusedRefresh } from '../hooks/useFocusedRefresh';
import { clearQueryCache } from '../services/queryCache';
import { readPendingOperation } from '../services/pendingOperation';
import { smsService } from '../services/smsService';
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
import { paymentService, type PaymentWriteInput } from '../services/paymentService';
import { colors } from '../theme/colors';
import type { Batch, Breed, Customer, EggType, Payment } from '../types/models';
import { calculateBatchDates, formatDateTR, isValidDateOnly } from '../utils/dateRules';
import { formatCurrency, parseMoneyInput } from '../utils/money';
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
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [voidPayment, setVoidPayment] = useState(false);
  const [paymentNote, setPaymentNote] = useState('');
  const [pendingPayment, setPendingPayment] = useState<PaymentWriteInput | null>(null);
  const [smsSaving, setSmsSaving] = useState(false);
  const [breed, setBreed] = useState<Breed | null>(null);
  const [editBreed, setEditBreed] = useState('');

  const [editModal, setEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [eggTypes, setEggTypes] = useState<EggType[]>([]);
  const [editEggTypeId, setEditEggTypeId] = useState('');
  const [editEggCount, setEditEggCount] = useState('');
  const [editIncubationDate, setEditIncubationDate] = useState('');
  const [editReceivedDate, setEditReceivedDate] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editNote, setEditNote] = useState('');
  const paymentLock = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const saveEditLock = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const batchData = await batchService.getById(route.params.batchId);
    setBatch(batchData);
    if (!batchData) throw new Error('Yumurta kaydı bulunamadı.');
    const [customerData, eggTypeOptions, paymentData] = await Promise.all([
      customerService.getById(batchData.customerId),
      eggTypeService.listAll(),
      paymentService.listByBatch(batchData.id),
    ]);
    setCustomer(customerData);
    setEggType(eggTypeOptions.find((item) => item.id === batchData.eggTypeId) ?? null);
    setEggTypes(eggTypeOptions);
    setPayments(paymentData);
    setBreed(batchData.breedId ? await eggTypeService.getBreedById(batchData.breedId) : null);
    const pending = await readPendingOperation<PaymentWriteInput>(`payment:${batchData.id}`);
    setPendingPayment(pending?.input ?? null);
  }, [route.params.batchId]);

  useFocusedRefresh(() => { void load().catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Veriler alınamadı.')); }, ['batch', 'customer', 'payment', 'eggType']);

  if (loadError) return <Screen><View style={{ padding: 24, gap: 16 }}><Text style={styles.state}>{loadError}</Text><PrimaryButton title="Tekrar dene" onPress={() => { clearQueryCache(); void load().catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Veriler alınamadı.')); }} /></View></Screen>;

  if (!batch) return <Screen><Text style={styles.state}>Yükleniyor...</Text></Screen>;

  const currentBatch = batch;
  const paid = paymentService.calculatePaidTotal(payments);
  const remaining = currentBatch.totalPrice - paid;

  function openPayment(payment: Payment | null = null) {
    if (pendingPayment) { Alert.alert('Bekleyen ödeme', 'Önce sonucu belirsiz işlemi yeniden deneyin.'); return; }
    setSelectedPayment(payment);
    setPaymentAmount(payment ? String(payment.amount) : '');
    setPaymentDate(payment?.paymentDate ?? todayDateOnly());
    setPaymentNote(payment?.note ?? '');
    setVoidPayment(false);
    setPaymentModal(true);
  }

  async function savePayment(input: PaymentWriteInput) {
    if (paymentLock.current) return;
    paymentLock.current = true;
    setSavingPayment(true);
    try {
      await paymentService.save(input);
      setPendingPayment(null);
      setPaymentModal(false);
      try { await load(); } catch { setLoadError('Ödeme kaydedildi; güncel liste alınamadı. Yenileyin.'); }
      Alert.alert('Tamamlandı', input.void ? 'Ödeme iptal edildi; geçmiş kaydı korundu.' : 'Ödeme kaydedildi.');
    } catch (error) {
      const pending = await readPendingOperation<PaymentWriteInput>(`payment:${currentBatch.id}`).catch(() => null);
      setPendingPayment(pending?.input ?? null);
      setPaymentModal(false);
      if (!pending) { try { await load(); } catch { /* Retry remains available. */ } }
      Alert.alert('Ödeme işlemi tamamlanamadı', error instanceof Error ? error.message : 'Sonuç doğrulanamadı.');
    } finally {
      paymentLock.current = false;
      setSavingPayment(false);
    }
  }

  async function addPayment() {
    const amount = parseMoneyInput(paymentAmount);
    if (!customer || (!voidPayment && (amount === null || amount <= 0))) {
      Alert.alert('Uyarı', 'Geçerli bir ödeme tutarı girin.'); return;
    }
    if (!isValidDateOnly(paymentDate)) { Alert.alert('Uyarı', 'Geçerli bir ödeme tarihi seçin.'); return; }
    if (voidPayment && !paymentNote.trim()) { Alert.alert('Uyarı', 'İptal nedenini girin.'); return; }
    const allowed = remaining + (selectedPayment?.amount ?? 0);
    if (!voidPayment && amount! > allowed && amount! > (selectedPayment?.amount ?? 0)) {
      Alert.alert('Fazla ödeme', 'Ödeme kalan borcu aşamaz.'); return;
    }
    const input: PaymentWriteInput = {
      customerId: customer.id, batchId: currentBatch.id, amount: voidPayment ? selectedPayment!.amount : amount!,
      paymentMethod: selectedPayment?.paymentMethod ?? 'Nakit', paymentDate, note: paymentNote.trim() || null,
      ...(selectedPayment ? { id: selectedPayment.id, expectedUpdatedAt: selectedPayment.updatedAt } : {}),
      ...(voidPayment ? { void: true, reason: paymentNote.trim() } : {}),
    };
    if (voidPayment) {
      Alert.alert('Ödemeyi iptal et?', 'Bu işlem borcu yeniden hesaplar ve ödeme geçmişini korur. Fiziksel para iadesi yapmaz.', [
        { text: 'Vazgeç', style: 'cancel' }, { text: 'İptal et', style: 'destructive', onPress: () => { void savePayment(input); } },
      ]);
    } else await savePayment(input);
  }

  async function recoverSms() {
    if (!customer || !eggType || smsSaving) return;
    setSmsSaving(true);
    try {
      const result = await smsService.createHatchDraft({ customer, batch: currentBatch, eggType });
      if (result.sms) navigation.navigate('SmsPreview', { smsId: result.sms.id });
      else Alert.alert('SMS taslağı', result.created ? 'Taslak hazır.' : result.reason);
    } catch (error) { Alert.alert('SMS taslağı oluşturulamadı', error instanceof Error ? error.message : 'Tekrar deneyin.'); }
    finally { setSmsSaving(false); }
  }

  function openEditForm() {
    setEditEggTypeId(currentBatch.eggTypeId);
    setEditEggCount(String(currentBatch.eggCount));
    setEditReceivedDate(currentBatch.receivedDate);
    setEditUnitPrice(String(currentBatch.unitPrice));
    setEditIncubationDate(currentBatch.incubationDate ?? '');
    setEditBreed(breed?.name ?? '');
    setEditNote(currentBatch.note ?? '');
    setEditModal(true);
  }

  async function saveBatchEdits() {
    if (saveEditLock.current) return;
    const eggCount = Number(editEggCount.trim());
    if (!Number.isSafeInteger(eggCount) || eggCount <= 0) {
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

    const unitPrice = parseMoneyInput(editUnitPrice);
    if (unitPrice === null || unitPrice < 0) { Alert.alert('Geçersiz fiyat', 'Sıfır veya daha büyük geçerli bir birim fiyat girin.'); return; }
    if (!isValidDateOnly(editReceivedDate)) { Alert.alert('Geçersiz tarih', 'Geçerli bir kabul tarihi seçin.'); return; }
    if (pendingPayment) { Alert.alert('Bekleyen ödeme', 'Önce sonucu belirsiz ödeme işlemini tamamlayın.'); return; }
    if (editIncubationDate && editIncubationDate < editReceivedDate) { Alert.alert('Geçersiz tarih', 'Kuluçka tarihi kabul tarihinden önce olamaz.'); return; }

    saveEditLock.current = true;
    setSavingEdit(true);
    try {
      const updatedBatch = await batchService.update(currentBatch.id, {
        eggTypeId: editEggTypeId,
        breedId: editBreed.trim() ? await eggTypeService.ensureBreed(editEggTypeId, editBreed) : null,
        eggCount,
        receivedDate: editReceivedDate,
        unitPrice,
        incubationDate: editIncubationDate || null,
        note: editNote.trim() || null,
      }, currentBatch.updatedAt);
      if (!updatedBatch) throw new Error('Düzenlenecek yumurta kaydı bulunamadı.');
      setBatch(updatedBatch);
      setEditModal(false);
      try { await load(); } catch { setLoadError('Kayıt güncellendi; güncel görünüm alınamadı. Yenileyin.'); }
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
    ['Irk', breed?.name ?? '-'],
    ['Yumurta adedi', `${currentBatch.eggCount}`],
    ['Kabul tarihi', formatDateTR(currentBatch.receivedDate)],
    ['Kuluçka tarihi', formatDateTR(currentBatch.incubationDate)],
    ['Tahmini çıkım', formatDateTR(currentBatch.expectedHatchDate)],
    ['Birim fiyat', formatCurrency(currentBatch.unitPrice)],
    ['Toplam fiyat', formatCurrency(currentBatch.totalPrice)],
    ['Toplam ödeme', formatCurrency(paid)],
    [remaining < 0 ? 'Müşteri alacağı' : 'Kalan borç', formatCurrency(Math.abs(remaining))],
    ['Not', currentBatch.note ?? '-'],
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{customer ? `${customer.firstName} ${customer.lastName}` : 'Yumurta Kabulü'}</Text>
        <View style={styles.grid}><InfoCard title="Toplam" value={formatCurrency(currentBatch.totalPrice)} /><InfoCard title={remaining < 0 ? "Müşteri alacağı" : "Kalan"} value={formatCurrency(Math.abs(remaining))} tone="warning" /></View>
        <View style={styles.actions}>
          {pendingPayment ? <Text style={styles.label}>Sonucu bekleyen işlem: {pendingPayment.void ? "ödeme iptali" : pendingPayment.id ? "ödeme düzeltmesi" : "yeni ödeme"} · {formatCurrency(pendingPayment.amount)} · {formatDateTR(pendingPayment.paymentDate)}</Text> : null}
          <PrimaryButton title="DÜZENLE" onPress={openEditForm} variant="secondary" />
          {customer ? <PrimaryButton title="MÜŞTERİYİ AÇ" onPress={() => navigation.navigate('CustomerDetail', { customerId: customer.id })} variant="secondary" /> : null}
          <PrimaryButton title="ÖDEME EKLE" onPress={() => openPayment()} disabled={savingPayment || !!pendingPayment} />
          {pendingPayment ? <PrimaryButton title={savingPayment ? 'Doğrulanıyor...' : 'Bekleyen ödeme işlemini yeniden dene'} onPress={() => { void savePayment(pendingPayment); }} disabled={savingPayment} /> : null}
          <PrimaryButton title={smsSaving ? 'SMS kontrol ediliyor...' : 'SMS taslağını aç / oluştur'} variant="secondary" onPress={() => { void recoverSms(); }} disabled={smsSaving} />
        </View>
        <View style={styles.detailCard}>{rows.map(([label, value]) => <View key={label} style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
        <View style={styles.detailCard}>
          <Text style={styles.historyTitle}>Ödeme Geçmişi</Text>
          {payments.length === 0 ? <Text style={styles.label}>Henüz ödeme eklenmedi.</Text> : payments.map((payment) => (
            <View key={payment.id} style={styles.row}>
              <Text style={styles.label}>{formatDateTR(payment.paymentDate)} · {payment.paymentMethod}{payment.voidedAt ? " · İptal edildi" : ""}</Text>
              <Text style={styles.value}>{formatCurrency(payment.amount)}</Text>
              {payment.voidedAt ? <Text style={styles.label}>{payment.voidReason}</Text> : <PrimaryButton title="Düzelt / iptal et" variant="secondary" onPress={() => openPayment(payment)} disabled={savingPayment || !!pendingPayment} />}
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
                  {eggTypes.filter((item) => item.active || item.id === currentBatch.eggTypeId).map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: editEggTypeId === item.id }}
                      onPress={() => { setEditEggTypeId(item.id); if (item.id !== editEggTypeId) setEditBreed(''); }}
                      style={[styles.eggTypeOption, editEggTypeId === item.id && styles.eggTypeOptionActive]}
                    >
                      <Text style={[styles.eggTypeOptionText, editEggTypeId === item.id && styles.eggTypeOptionTextActive]}>{item.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextField label="Yumurta adedi" value={editEggCount} onChangeText={setEditEggCount} keyboardType="number-pad" />
                <TextField label="Birim fiyat (TL)" value={editUnitPrice} onChangeText={setEditUnitPrice} keyboardType="decimal-pad" />
                <DateField label="Kabul tarihi" value={editReceivedDate} onChange={setEditReceivedDate} />
                <DateField label="Kuluçkaya Giriş Tarihi" value={editIncubationDate} onChange={setEditIncubationDate} />
                {editIncubationDate ? <PrimaryButton title="Kuluçka tarihini kaldır" variant="secondary" onPress={() => setEditIncubationDate('')} disabled={savingEdit} /> : null}
                <Text style={styles.label}>Tahmini Çıkım Tarihi</Text>
                <Text accessibilityLabel="Tahmini çıkım tarihi" style={styles.estimatedDate}>
                  {editExpectedHatchDate ? formatDateTR(editExpectedHatchDate) : '—'}
                </Text>
                <TextField label="Irk" value={editBreed} onChangeText={setEditBreed} />
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
                <Text style={styles.sheetTitle}>{selectedPayment ? "Ödemeyi düzelt" : "Ödeme Ekle"}</Text>
                <Text style={styles.label}>Kalan borç: {formatCurrency(remaining)}</Text>
                <TextField label="Tutar" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" />
                <DateField label="Ödeme Tarihi" value={paymentDate} onChange={setPaymentDate} />
                <TextField label={voidPayment ? "İptal nedeni" : "Ödeme notu"} value={paymentNote} onChangeText={setPaymentNote} />
                {selectedPayment ? <PrimaryButton title={voidPayment ? 'Tutar düzeltmeye dön' : 'Bu ödemeyi iptal et'} variant="secondary" disabled={savingPayment} onPress={() => { setVoidPayment((v) => !v); setPaymentNote(''); }} /> : null}
                <PrimaryButton title={savingPayment ? 'Kaydediliyor...' : voidPayment ? 'İptali onayla' : 'Kaydet'} onPress={addPayment} disabled={savingPayment} />
              </KeyboardAwareForm>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 4 },
  grid: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actions: { gap: 10, marginTop: 16 },
  detailCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 16 },
  row: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  value: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  historyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  state: { color: colors.textMuted, textAlign: 'center', margin: 24, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(23, 32, 51, 0.36)', justifyContent: 'flex-end' },
  backdropDismiss: { zIndex: 0 },
  modalKeyboard: { flex: 1 },
  sheet: { zIndex: 1, width: '100%', height: '78%', minHeight: 320, maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 28, gap: 10 },
  editSheet: { zIndex: 1, width: '100%', height: '82%', minHeight: 440, maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 28, gap: 10 },
  sheetContent: { padding: 0 },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  eggTypeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  eggTypeOption: { minHeight: 44, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 14 },
  eggTypeOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  eggTypeOptionText: { color: colors.text, fontWeight: '900' },
  eggTypeOptionTextActive: { color: colors.surface },
  estimatedDate: { color: colors.textMuted, backgroundColor: colors.surfaceMuted, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 16, fontSize: 16, fontWeight: '800', marginBottom: 14 },
});
