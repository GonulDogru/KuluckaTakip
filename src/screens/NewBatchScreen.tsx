import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { batchService } from '../services/batchService';
import { customerService } from '../services/customerService';
import { eggTypeService } from '../services/eggTypeService';
import { paymentService } from '../services/paymentService';
import { smsService } from '../services/smsService';
import { colors } from '../theme/colors';
import type { Customer, EggType } from '../types/models';
import { calculateBatchDates, formatDateTR, isValidDateOnly } from '../utils/dateRules';
import { formatCurrency } from '../utils/money';
import { todayDateOnly } from '../utils/today';

function parseMoneyInput(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const schema = z.object({
  customerName: z.string().trim().min(1, 'Müşteri zorunludur.'),
  phone: z.string().trim().min(1, 'Telefon zorunludur.'),
  eggTypeId: z.string().trim().min(1, 'Yumurta türü zorunludur.'),
  breed: z.string().optional(),
  eggCount: z.string().trim().min(1, 'Yumurta adedi zorunludur.').refine((value) => Number(value) > 0, "Yumurta adedi 0'dan büyük olmalıdır."),
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
    return parsed === null || parsed >= 0;
  }, 'Geçerli bir ödenen tutar giriniz.'),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<RootStackParamList, 'NewBatch'>;

export function NewBatchScreen({ navigation, route }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [eggTypes, setEggTypes] = useState<EggType[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
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
        const [customerData, eggTypeData] = await Promise.all([customerService.list(), eggTypeService.list()]);
        if (!active) return;
        setCustomers(customerData);
        setEggTypes(eggTypeData);
        const preselected = route.params?.customerId ? customerData.find((customer) => customer.id === route.params?.customerId) : null;
        if (preselected) {
          setValue('customerName', `${preselected.firstName} ${preselected.lastName}`);
          setValue('phone', preselected.phone);
        }
        if (eggTypeData[0]) setValue('eggTypeId', eggTypeData[0].id);
        else Alert.alert('Yumurta türleri yüklenemedi', 'Aktif yumurta türü bulunamadı. Lütfen Supabase bağlantısını ve yumurta türü kayıtlarını kontrol edin.');
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
  }, [route.params?.customerId, setValue]);

  const values = watch();
  const unitPricePreview = parseMoneyInput(values.unitPrice) ?? 0;
  const totalPrice = Number(values.eggCount || 0) * unitPricePreview;
  const selectedEggType = eggTypes.find((eggType) => eggType.id === values.eggTypeId);
  const expectedHatchDate = calculateBatchDates(values.incubationDate, selectedEggType).expectedHatchDate;

  function onInvalid(formErrors: FieldErrors<FormData>) {
    const firstMessage = Object.values(formErrors).find((error) => error?.message)?.message;
    Alert.alert(
      'Eksik veya hatalı bilgi',
      typeof firstMessage === 'string' ? firstMessage : 'Lütfen formdaki hataları kontrol edin.',
    );
  }

  async function onSubmit(form: FormData) {
    if (saving) return;
    setSaving(true);
    try {
      const unitPrice = parseMoneyInput(form.unitPrice);
      const paidAmount = parseMoneyInput(form.paidAmount) ?? 0;
      const eggTypeExists = eggTypes.some((eggType) => eggType.id === form.eggTypeId);

      if (unitPrice === null) {
        throw new Error('Geçerli bir birim fiyat giriniz.');
      }

      if (!eggTypeExists) {
        throw new Error('Yumurta türü bulunamadı. Lütfen tekrar seçin.');
      }

      let customer = await customerService.findByPhone(form.phone);
      if (!customer) {
        const [firstName, ...rest] = form.customerName.trim().split(/\s+/);
        customer = await customerService.create({
          firstName,
          lastName: rest.join(' ') || '-',
          phone: form.phone,
          note: null,
        });
      }

      const batch = await batchService.create({
        customerId: customer.id,
        eggTypeId: form.eggTypeId,
        eggCount: Number(form.eggCount),
        receivedDate: form.receivedDate,
        incubationDate: form.incubationDate || null,
        unitPrice,
        note: form.note,
      });

      if (paidAmount > 0) {
        await paymentService.create({
          customerId: customer.id,
          batchId: batch.id,
          amount: paidAmount,
          paymentMethod: 'Nakit',
          paymentDate: form.receivedDate,
          note: 'Yumurta kabul ödemesi',
        });
      }

      const eggType = eggTypes.find((item) => item.id === form.eggTypeId);
      if (!eggType) throw new Error('Yumurta türü bulunamadı. Lütfen tekrar seçin.');
      let smsDraftMessage: string;
      try {
        const draftResult = await smsService.createHatchDraft({ customer, batch, eggType });
        smsDraftMessage = draftResult.created
          ? 'SMS taslağı Bekleyen SMS bölümüne eklendi. Gönderilmedi.'
          : draftResult.reason;
      } catch (error) {
        smsDraftMessage = `Yumurta kabulü kaydedildi ancak SMS taslağı oluşturulamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata.'}`;
      }
      Alert.alert(
        'Yumurta kabulü kaydedildi',
        smsDraftMessage,
        [
          { text: 'Kabul Detayı', onPress: () => navigation.replace('BatchDetail', { batchId: batch.id }) },
          { text: 'SMS Merkezi', onPress: () => navigation.navigate('MainTabs', { screen: 'SmsCenter' }) },
        ],
        { cancelable: false },
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Yumurta kabulü kaydedilemedi:', error);
      }
      Alert.alert('Hata', error instanceof Error ? error.message : 'Yumurta kabulü kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAwareForm>
        <Text style={styles.title}>Yeni Yumurta Kabul</Text>
        <Controller control={control} name="phone" render={({ field }) => (
          <TextField label="Telefon" value={field.value} onChangeText={async (value) => {
            field.onChange(value);
            const customer = await customerService.findByPhone(value);
            if (customer) setValue('customerName', `${customer.firstName} ${customer.lastName}`);
          }} keyboardType="phone-pad" error={errors.phone?.message} />
        )} />
        <Controller control={control} name="customerName" render={({ field }) => (
          <TextField label="Müşteri" value={field.value} onChangeText={field.onChange} error={errors.customerName?.message} />
        )} />
        <Text style={styles.label}>Yumurta türü</Text>
        {loadingOptions ? <Text style={styles.optionsState}>Yumurta türleri yükleniyor...</Text> : null}
        {!loadingOptions && eggTypes.length === 0 ? <Text style={styles.errorText}>Aktif yumurta türü bulunamadı.</Text> : null}
        <View style={styles.options}>
          {eggTypes.map((eggType) => (
            <Pressable key={eggType.id} onPress={() => setValue('eggTypeId', eggType.id)} style={[styles.option, values.eggTypeId === eggType.id && styles.optionActive]}>
              <Text style={[styles.optionText, values.eggTypeId === eggType.id && styles.optionTextActive]}>{eggType.name}</Text>
            </Pressable>
          ))}
        </View>
        {errors.eggTypeId?.message ? <Text style={styles.errorText}>{errors.eggTypeId.message}</Text> : null}
        <Controller control={control} name="breed" render={({ field }) => (
          <TextField label="Irk" value={field.value ?? ''} onChangeText={field.onChange} placeholder="Opsiyonel" />
        )} />
        <Controller control={control} name="eggCount" render={({ field }) => (
          <TextField label="Yumurta adedi" value={field.value} onChangeText={field.onChange} keyboardType="number-pad" error={errors.eggCount?.message} />
        )} />
        <Controller control={control} name="receivedDate" render={({ field }) => (
          <DateField label="Kabul Tarihi" value={field.value} onChange={field.onChange} error={errors.receivedDate?.message} />
        )} />
        <Controller control={control} name="incubationDate" render={({ field }) => (
          <DateField label="Kuluçkaya Giriş Tarihi" value={field.value} onChange={field.onChange} error={errors.incubationDate?.message} />
        )} />
        <Text style={styles.label}>Tahmini Çıkım Tarihi</Text>
        <Text accessibilityLabel="Tahmini çıkım tarihi" style={styles.estimatedDate}>
          {expectedHatchDate ? formatDateTR(expectedHatchDate) : '—'}
        </Text>
        <Controller control={control} name="unitPrice" render={({ field }) => (
          <TextField label="Birim fiyat" value={field.value} onChangeText={field.onChange} keyboardType="decimal-pad" error={errors.unitPrice?.message} />
        )} />
        <Text style={styles.preview}>Toplam fiyat: {formatCurrency(totalPrice)}</Text>
        <Controller control={control} name="paidAmount" render={({ field }) => (
          <TextField label="Ödenen tutar" value={field.value} onChangeText={field.onChange} keyboardType="decimal-pad" error={errors.paidAmount?.message} />
        )} />
        <Controller control={control} name="note" render={({ field }) => (
          <TextField label="Not" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )} />
        <PrimaryButton title={saving ? 'Kaydediliyor...' : 'Yumurta Kabulünü Kaydet'} onPress={handleSubmit(onSubmit, onInvalid)} disabled={saving || loadingOptions || eggTypes.length === 0} />
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 12 },
  label: { color: colors.text, fontSize: 13, fontWeight: '900', marginBottom: 6 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  optionsState: { color: colors.textMuted, marginBottom: 10, fontWeight: '700' },
  estimatedDate: { color: colors.textMuted, backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 16, fontSize: 16, fontWeight: '800', marginBottom: 14 },
  option: { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 14 },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.text, fontWeight: '900' },
  optionTextActive: { color: colors.surface },
  preview: { color: colors.primary, fontWeight: '900', marginBottom: 14 },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: -8, marginBottom: 12 },
});
