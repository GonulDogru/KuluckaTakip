import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import type { RootStackParamList } from '../navigation/types';
import { machineService } from '../services/machineService';
import { colors } from '../theme/colors';

const schema = z.object({
  name: z.string().trim().min(1, 'Makine adı zorunludur.'),
  machineNumber: z.string().trim().min(1, 'Makine numarası zorunludur.'),
  capacity: z.string().trim().min(1, 'Kapasite zorunludur.').refine((value) => Number(value) > 0, "Kapasite 0'dan büyük olmalıdır."),
  active: z.boolean(),
});

type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<RootStackParamList, 'NewMachine'>;

export function NewMachineScreen({ navigation }: Props) {
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', machineNumber: '', capacity: '', active: true },
  });

  async function onSubmit(values: FormData) {
    if (saving) return;
    setSaving(true);
    try {
      const machine = await machineService.create({
        name: values.name,
        machineNumber: values.machineNumber,
        capacity: Number(values.capacity),
        active: values.active,
      });
      navigation.replace('MachineDetail', { machineId: machine.id });
    } catch (error) {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Makine kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  const active = watch('active');
  return (
    <Screen>
      <KeyboardAwareForm>
        <Text style={styles.title}>Yeni Makine</Text>
        <Controller control={control} name="name" render={({ field }) => <TextField label="Makine adı" value={field.value} onChangeText={field.onChange} error={errors.name?.message} />} />
        <Controller control={control} name="machineNumber" render={({ field }) => <TextField label="Makine numarası" value={field.value} onChangeText={field.onChange} error={errors.machineNumber?.message} />} />
        <Controller control={control} name="capacity" render={({ field }) => <TextField label="Toplam kapasite" value={field.value} onChangeText={field.onChange} keyboardType="number-pad" error={errors.capacity?.message} />} />
        <View style={styles.switchRow}><Text style={styles.switchText}>Durum: {active ? 'Aktif' : 'Pasif'}</Text><PrimaryButton title={active ? 'Pasif Yap' : 'Aktif Yap'} variant="secondary" onPress={() => setValue('active', !active)} /></View>
        <PrimaryButton title={saving ? 'Kaydediliyor...' : 'Makineyi Kaydet'} onPress={handleSubmit(onSubmit)} disabled={saving} />
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 12 },
  switchRow: { gap: 10, marginBottom: 14 },
  switchText: { color: colors.text, fontWeight: '900' },
});
