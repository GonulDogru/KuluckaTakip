import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Controller, type FieldErrors, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DateField } from '../components/DateField';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import type { RootStackParamList } from '../navigation/types';
import { acceptanceService, type AcceptanceInput } from '../services/acceptanceService';
import { readPendingOperation } from '../services/pendingOperation';
import { customerService } from '../services/customerService';
import { eggTypeService } from '../services/eggTypeService';
import { colors } from '../theme/colors';
import type { EggType } from '../types/models';
import { calculateBatchDates, formatDateTR, isValidDateOnly } from '../utils/dateRules';
import { formatCurrency, parseMoneyInput } from '../utils/money';
import { normalizeTurkishPhone } from '../utils/phone';
import { todayDateOnly } from '../utils/today';

const schema = z.object({
  customerName: z.string().trim().min(1, 'Müşteri zorunludur.'),
  phone: z.string().trim().refine((value) => Boolean(normalizeTurkishPhone(value)), 'Geçerli bir cep telefonu giriniz.'),
  eggTypeId: z.string().trim().min(1, 'Yumurta türü zorunludur.'),
  breed: z.string().optional(),
  eggCount: z.string().trim().refine((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0, 'Yumurta adedi pozitif tam sayı olmalıdır.'),
  receivedDate: z.string().trim().refine((value) => isValidDateOnly(value), 'Geçerli bir kabul tarihi seçiniz.'),
  incubationDate: z.string().optional().refine((value) => !value || isValidDateOnly(value), 'Geçerli bir kuluçkaya giriş tarihi seçiniz.'),
  unitPrice: z.string()
    .trim()
    .min(1, 'Birim fiyat zorunludur.')
    .refine((value) => {
      const parsed = parseMoneyInput(value);
      return parsed !== null && parsed >= 0;
    }, 'Geçerli bir birim fiyat giriniz.'),
  paidAmount: z.string().refine((value) => {
    const parsed = parseMoneyInput(value);
    return value.trim() === '' || (parsed !== null && parsed >= 0);
  }, 'Geçerli bir ödenen tutar giriniz.'),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<RootStackParamList, 'NewBatch'>;

export function NewBatchScreen({ navigation, route }: Props) {
  const saveLock = useRef(false);
  const [step, setStep] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [eggTypes, setEggTypes] = useState<EggType[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingAcceptance, setPendingAcceptance] = useState<AcceptanceInput | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const { control, handleSubmit, watch, setValue, reset, trigger, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    shouldUnregister: false,
    defaultValues: {
      customerName: '',
      phone: '',
      eggTypeId: '',
      breed: '',
      eggCount: '',
      receivedDate: todayDateOnly(),
      incubationDate: '',
      unitPrice: '',
      paidAmount: '',
      note: '',
    },
  });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [preselected, eggTypeData] = await Promise.all([
          route.params?.customerId ? customerService.getById(route.params.customerId) : Promise.resolve(null),
          eggTypeService.list(),
        ]);
        if (!active) return;
        setEggTypes(eggTypeData);
        if (preselected) {
          setValue('customerName', `${preselected.firstName} ${preselected.lastName}`);
          setValue('phone', preselected.phone);
        }
        const pending = await readPendingOperation<AcceptanceInput>('acceptance');
        if (!active) return;
        if (pending) { setPendingAcceptance(pending.input); reset(pending.input); setStep(2); Alert.alert('Bekleyen kabul', 'Önceki işlemin sonucu doğrulanmadı. Bilgiler geri yüklendi; aynı kabulü güvenle yeniden deneyebilirsiniz.'); }
        else if (eggTypeData[0]) setValue('eggTypeId', eggTypeData[0].id);
        if (!eggTypeData.length) Alert.alert('Yumurta türleri yüklenemedi', 'Aktif yumurta türü bulunamadı. Lütfen Supabase bağlantısını ve yumurta türü kayıtlarını kontrol edin.');
      } catch (error) {
        if (active) {
          Alert.alert('Form verileri yüklenemedi', error instanceof Error ? error.message : 'Veriler Supabase üzerinden alınamadı.');
        }
      } finally {
        if (active) setLoadingOptions(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [route.params?.customerId, setValue, reset]);

  const values = watch();
  useEffect(() => {
    if (pendingAcceptance || !normalizeTurkishPhone(values.phone)) return;
    let active = true;
    const timer = setTimeout(() => {
      void customerService.findByPhone(values.phone).then((customer) => {
        if (active && customer) setValue('customerName', `${customer.firstName} ${customer.lastName}`);
      }).catch(() => { /* Saving validates the lookup and reports any connection error. */ });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [values.phone, setValue, pendingAcceptance]);

  const unitPricePreview = parseMoneyInput(values.unitPrice) ?? 0;
  const totalPrice = Number(values.eggCount || 0) * unitPricePreview;
  const selectedEggType = eggTypes.find((eggType) => eggType.id === values.eggTypeId);
  const expectedHatchDate = calculateBatchDates(values.incubationDate, selectedEggType).expectedHatchDate;

  async function nextStep() {
    const fields: (keyof FormData)[] = step === 0
      ? ['phone', 'customerName']
      : ['eggTypeId', 'eggCount', 'receivedDate', 'incubationDate'];
    if (await trigger(fields, { shouldFocus: true })) {
      Keyboard.dismiss();
      setStep(Math.min(2, step + 1));
    }
  }

  function onInvalid(formErrors: FieldErrors<FormData>) {
    if (formErrors.phone || formErrors.customerName) setStep(0);
    else if (formErrors.eggTypeId || formErrors.eggCount || formErrors.receivedDate || formErrors.incubationDate) setStep(1);
    else setStep(2);
    const firstMessage = Object.values(formErrors).find((error) => error?.message)?.message;
    Alert.alert(
      'Eksik veya hatalı bilgi',
      typeof firstMessage === 'string' ? firstMessage : 'Lütfen formdaki hataları kontrol edin.',
    );
  }

  async function onSubmit(form: FormData) {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const unitPrice = parseMoneyInput(form.unitPrice);
      const paidAmount = parseMoneyInput(form.paidAmount) ?? 0;
      const eggTypeExists = eggTypes.some((eggType) => eggType.id === form.eggTypeId);

      if (unitPrice === null) {
        throw new Error('Geçerli bir birim fiyat giriniz.');
      }

      if (paidAmount > Number(form.eggCount) * unitPrice) throw new Error('Ödeme toplam tutarı aşamaz.');
      if (form.incubationDate && form.incubationDate < form.receivedDate) throw new Error('Kuluçka tarihi kabul tarihinden önce olamaz.');

      if (!pendingAcceptance && !eggTypeExists) {
        throw new Error('Yumurta türü bulunamadı. Lütfen tekrar seçin.');
      }

      const existing = pendingAcceptance ? null : await customerService.findByPhone(form.phone);
      if (existing && !existing.isActive) {
        Alert.alert('Arşivlenmiş müşteri', 'Yeni kabulden önce müşteriyi arşivden çıkarın.', [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Müşteriyi aç', onPress: () => navigation.navigate('CustomerDetail', { customerId: existing.id }) },
        ]);
        return;
      }
      const batch = await acceptanceService.create(pendingAcceptance ?? form);
      const smsDraftMessage = batch.expectedHatchDate
        ? 'Ödeme ve kabul birlikte kaydedildi. SMS taslağı hazır; henüz gönderilmedi.'
        : 'Ödeme ve kabul birlikte kaydedildi. Kuluçka tarihi eklenince SMS taslağı hazırlanır.';
      setPendingAcceptance(null);
      Alert.alert(
        'Yumurta kabulü kaydedildi',
        smsDraftMessage,
        [
          { text: 'Kabul Detayı', onPress: () => navigation.replace('BatchDetail', { batchId: batch.id }) },
          { text: 'SMS Merkezi', onPress: () => navigation.popTo('MainTabs', { screen: 'SmsCenter' }) },
        ],
        { cancelable: false },
      );
    } catch (error) {
      const pending = await readPendingOperation<AcceptanceInput>('acceptance').catch(() => null);
      setPendingAcceptance(pending?.input ?? null);
      if (pending) { reset(pending.input); setStep(2); Keyboard.dismiss(); }
      if (__DEV__) {
        console.error('Yumurta kabulü kaydedilemedi:', error);
      }
      Alert.alert('Hata', error instanceof Error ? error.message : 'Yumurta kabulü kaydedilemedi.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <KeyboardAwareForm key={step} bottomPadding={20}>
        {pendingAcceptance ? <Text style={styles.sectionHint}>Önceki kabulün sonucu bekleniyor. Kayıt bilgileri korunuyor; yeniden deneme ikinci kayıt oluşturmaz.</Text> : null}
        <View pointerEvents={pendingAcceptance ? "none" : "auto"}>
        <View style={styles.steps}>
          {['Müşteri', 'Yumurta', 'Ödeme'].map((title, index) => <View key={title} accessibilityLabel={`Adım ${index + 1}: ${title}${index === step ? ', geçerli adım' : ''}`} style={[styles.step, index === step && styles.activeStep]}>
            <View style={[styles.stepNumber, index <= step && styles.activeNumber]}><Text style={[styles.numberText, index <= step && styles.activeNumberText]}>{index + 1}</Text></View>
            <Text style={[styles.stepText, index === step && styles.activeStepText]}>{title}</Text>
          </View>)}
        </View>

        {step === 0 ? <View style={styles.card}>
          <Text style={styles.sectionTitle}>Müşteri bilgileri</Text>
          <Text style={styles.sectionHint}>Telefon kayıtlıysa müşteri adı otomatik gelir.</Text>
          <Controller control={control} name="phone" render={({ field }) => <TextField editable={!pendingAcceptance} label="Cep telefonu" value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" placeholder="05xx xxx xx xx" error={errors.phone?.message} />} />
          <Controller control={control} name="customerName" render={({ field }) => <TextField editable={!pendingAcceptance} label="Müşteri adı soyadı" value={field.value} onChangeText={field.onChange} error={errors.customerName?.message} />} />
        </View> : null}

        {step === 1 ? <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Yumurta bilgileri</Text>
            <Text style={styles.label}>Yumurta türü</Text>
            {loadingOptions ? <Text style={styles.hint}>Türler yükleniyor...</Text> : null}
            {!loadingOptions && eggTypes.length === 0 ? <Text style={styles.errorText}>Aktif yumurta türü bulunamadı.</Text> : null}
            <View style={styles.options}>{eggTypes.map((eggType) => <Pressable key={eggType.id} accessibilityRole="radio" accessibilityState={{ checked: values.eggTypeId === eggType.id }} onPress={() => setValue('eggTypeId', eggType.id, { shouldValidate: true })} style={[styles.option, values.eggTypeId === eggType.id && styles.optionActive]}><Text style={[styles.optionText, values.eggTypeId === eggType.id && styles.optionTextActive]}>{eggType.name}</Text></Pressable>)}</View>
            {errors.eggTypeId?.message ? <Text style={styles.errorText}>{errors.eggTypeId.message}</Text> : null}
            <Controller control={control} name="eggCount" render={({ field }) => <TextField editable={!pendingAcceptance} label="Yumurta adedi" value={field.value} onChangeText={field.onChange} keyboardType="number-pad" placeholder="Örn. 100" error={errors.eggCount?.message} />} />
            <View style={styles.row}>
              <View style={styles.column}><Controller control={control} name="receivedDate" render={({ field }) => <DateField compact label="Kabul tarihi" value={field.value} onChange={field.onChange} error={errors.receivedDate?.message} />} /></View>
              <View style={styles.column}><Controller control={control} name="incubationDate" render={({ field }) => <DateField compact label="Kuluçka tarihi" value={field.value} onChange={field.onChange} error={errors.incubationDate?.message} />} /></View>
            </View>
            <View style={styles.datePreview}><AppIcon name="egg" size={18} color={colors.primary} /><Text style={styles.dateText}>{expectedHatchDate ? `Tahmini çıkım: ${formatDateTR(expectedHatchDate)}` : 'Kuluçka tarihi seçilince çıkım hesaplanır.'}</Text></View>
            {values.incubationDate ? <Pressable accessibilityRole="button" onPress={() => setValue('incubationDate', '', { shouldValidate: true })} style={styles.clearDate}><Text style={styles.link}>Kuluçka tarihini kaldır</Text></Pressable> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails((current) => !current)} style={styles.detailsToggle}><View><Text style={styles.detailsTitle}>Irk ve not {values.breed || values.note ? '•' : ''}</Text><Text style={styles.hint}>İsteğe bağlı ayrıntılar</Text></View><Text style={styles.toggleIcon}>{showDetails ? '−' : '+'}</Text></Pressable>
          {showDetails ? <View style={styles.card}>
            <Controller control={control} name="breed" render={({ field }) => <TextField editable={!pendingAcceptance} label="Irk" value={field.value ?? ''} onChangeText={field.onChange} placeholder="İsteğe bağlı" />} />
            <Controller control={control} name="note" render={({ field }) => <TextField editable={!pendingAcceptance} label="Not" value={field.value ?? ''} onChangeText={field.onChange} multiline placeholder="Bu kabulle ilgili kısa not" />} />
          </View> : null}
        </> : null}

        {step === 2 ? <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ücret ve ödeme</Text>
            <View style={styles.row}>
              <View style={styles.column}><Controller control={control} name="unitPrice" render={({ field }) => <TextField editable={!pendingAcceptance} label="Birim fiyat (TL)" value={field.value} onChangeText={field.onChange} keyboardType="decimal-pad" placeholder="0,00" error={errors.unitPrice?.message} />} /></View>
              <View style={styles.column}><Controller control={control} name="paidAmount" render={({ field }) => <TextField editable={!pendingAcceptance} label="Ödenen (TL)" value={field.value} onChangeText={field.onChange} keyboardType="decimal-pad" placeholder="0,00" error={errors.paidAmount?.message} />} /></View>
            </View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Toplam tutar</Text><Text style={styles.total}>{formatCurrency(totalPrice)}</Text></View>
            <View style={styles.balanceRow}><Text style={styles.hint}>Kalan tutar</Text><Text style={styles.balance}>{formatCurrency(totalPrice - (parseMoneyInput(values.paidAmount) ?? 0))}</Text></View>
          </View>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>KABUL ÖZETİ</Text>
            <Text style={styles.summaryName}>{values.customerName}</Text>
            <Text style={styles.summaryText}>{values.eggCount} adet · {selectedEggType?.name}</Text>
            <Text style={styles.summaryText}>Kabul: {formatDateTR(values.receivedDate)}</Text>
            <Text style={styles.summaryText}>Çıkım: {expectedHatchDate ? formatDateTR(expectedHatchDate) : 'Henüz planlanmadı'}</Text>
            {values.breed ? <Text style={styles.summaryText}>Irk: {values.breed}</Text> : null}
            {values.note ? <Text numberOfLines={2} style={styles.summaryText}>Not: {values.note}</Text> : null}
          </View>
        </> : null}

        </View>
        <View style={styles.buttons}>
          {step > 0 ? <View style={styles.back}><PrimaryButton title="Geri" variant="secondary" onPress={() => { Keyboard.dismiss(); setStep((current) => current - 1); }} disabled={saving || !!pendingAcceptance} /></View> : null}
          <View style={styles.next}>{step < 2 ? <PrimaryButton title={step === 0 ? 'Yumurta bilgileri →' : 'Ödemeye geç →'} onPress={() => { void nextStep(); }} disabled={loadingOptions || eggTypes.length === 0} /> : <PrimaryButton title={saving ? 'Kaydediliyor...' : pendingAcceptance ? 'Bekleyen kabulü yeniden dene' : 'Kabulü kaydet'} onPress={pendingAcceptance ? () => { void onSubmit(pendingAcceptance); } : handleSubmit(onSubmit, onInvalid)} disabled={saving || loadingOptions || (!pendingAcceptance && eggTypes.length === 0)} />}</View>
        </View>
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 7, marginBottom: 18 },
  step: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, backgroundColor: colors.surface },
  activeStep: { backgroundColor: colors.primarySoft },
  stepNumber: { width: 22, height: 22, borderRadius: 8, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  activeNumber: { backgroundColor: colors.primary },
  numberText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  activeNumberText: { color: colors.surface },
  stepText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  activeStepText: { color: colors.primary },
  card: { padding: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 20, marginBottom: 14 },
  sectionTitle: { color: colors.navy, fontSize: 16, fontWeight: '800', marginBottom: 15 },
  sectionHint: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: -8, marginBottom: 16 },
  label: { color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  option: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', paddingHorizontal: 13 },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  optionTextActive: { color: colors.surface },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  column: { flex: 1, minWidth: 0 },
  datePreview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, backgroundColor: colors.primarySoft },
  dateText: { flex: 1, color: colors.primary, fontSize: 11, lineHeight: 17, fontWeight: '600' },
  clearDate: { paddingTop: 10, alignSelf: 'flex-start' },
  link: { color: colors.textMuted, fontSize: 10, textDecorationLine: 'underline' },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface },
  detailsTitle: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  toggleIcon: { color: colors.primary, fontSize: 23 },
  totalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 13, backgroundColor: colors.primarySoft },
  totalLabel: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  total: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  balance: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  summary: { padding: 16, borderRadius: 20, backgroundColor: colors.cream, marginBottom: 14 },
  summaryLabel: { color: colors.accent, fontSize: 9, letterSpacing: 1, fontWeight: '800', marginBottom: 8 },
  summaryName: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  summaryText: { color: colors.textMuted, fontSize: 11, lineHeight: 18 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 2 },
  back: { flex: 1 },
  next: { flex: 2 },
  errorText: { color: colors.danger, fontSize: 11, marginBottom: 12 },
});
