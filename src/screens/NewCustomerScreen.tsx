import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import type { RootStackParamList } from '../navigation/types';
import { customerService } from '../services/customerService';
import { colors } from '../theme/colors';
import type { Customer } from '../types/models';
import { formatPhoneInput, normalizeTurkishPhone } from '../utils/phone';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Ad zorunludur.'),
  lastName: z.string().trim().min(1, 'Soyad zorunludur.'),
  phone: z.string().trim().min(1, 'Telefon zorunludur.').refine((value) => normalizeTurkishPhone(value), 'Geçerli bir telefon numarası giriniz.'),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<RootStackParamList, 'NewCustomer'>;

export function NewCustomerScreen({ navigation, route }: Props) {
  const customerId = route.params?.customerId;
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(Boolean(customerId));
  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', phone: '', note: '' },
  });

  useEffect(() => {
    if (!customerId) return;
    let active = true;
    customerService.getById(customerId).then((customer) => {
      if (!active) return;
      if (!customer) {
        Alert.alert('Hata', 'Müşteri kaydı bulunamadı.');
        navigation.goBack();
        return;
      }
      reset({
        firstName: customer.firstName,
        lastName: customer.lastName === '-' ? '' : customer.lastName,
        phone: formatPhoneInput(customer.phoneNormalized),
        note: customer.note ?? '',
      });
    }).catch((error) => {
      if (active) Alert.alert('Hata', error instanceof Error ? error.message : 'Müşteri bilgileri yüklenemedi.');
    }).finally(() => {
      if (active) setLoadingCustomer(false);
    });
    return () => { active = false; };
  }, [customerId, navigation, reset]);

  async function onSubmit(values: FormData) {
    if (saving) return;
    setSaving(true);
    setExistingCustomer(null);
    try {
      if (customerId) {
        const existing = await customerService.findByPhone(values.phone);
        if (existing && existing.id !== customerId) {
          throw new Error('Bu telefon numarası başka bir müşteriye kayıtlı.');
        }
        await customerService.update(customerId, values);
        navigation.replace('CustomerDetail', { customerId });
        return;
      }

      const existing = await customerService.findByPhone(values.phone);
      if (existing) {
        setExistingCustomer(existing);
        Alert.alert('Uyarı', 'Bu telefon numarasıyla kayıtlı müşteri bulunmaktadır.');
        return;
      }

      const customer = await customerService.create(values);
      navigation.replace('CustomerDetail', { customerId: customer.id });
    } catch (error) {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Müşteri kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAwareForm>
          <Text style={styles.title}>{customerId ? 'Müşteri Bilgilerini Düzenle' : 'Yeni Müşteri'}</Text>
          <Controller control={control} name="firstName" render={({ field }) => (
            <TextField
              label="Ad"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.firstName?.message}
              returnKeyType="next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />
          )} />
          <Controller control={control} name="lastName" render={({ field }) => (
            <TextField
              ref={lastNameRef}
              label="Soyad"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.lastName?.message}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          )} />
          <Controller control={control} name="phone" render={({ field }) => (
            <TextField
              ref={phoneRef}
              label="Telefon"
              value={field.value}
              onChangeText={(value) => field.onChange(formatPhoneInput(value))}
              keyboardType="phone-pad"
              placeholder="0532 123 45 67"
              error={errors.phone?.message}
              returnKeyType="next"
              onSubmitEditing={() => noteRef.current?.focus()}
            />
          )} />
          <Controller control={control} name="note" render={({ field }) => (
            <TextField
              ref={noteRef}
              label="Not"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              multiline
              returnKeyType="done"
              blurOnSubmit
            />
          )} />
          <PrimaryButton
            title={saving ? (customerId ? 'Güncelleniyor...' : 'Kaydediliyor...') : (customerId ? 'Bilgileri Güncelle' : 'Müşteriyi Kaydet')}
            onPress={handleSubmit(onSubmit)}
            disabled={saving || loadingCustomer}
          />
          {!customerId && existingCustomer ? (
            <PrimaryButton
              title="Var Olan Müşteriyi Aç"
              variant="secondary"
              onPress={() => navigation.replace('CustomerDetail', { customerId: existingCustomer.id })}
            />
          ) : null}
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 12 },
});
