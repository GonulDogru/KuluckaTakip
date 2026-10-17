import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import type { RootStackParamList } from '../navigation/types';
import { rackService } from '../services/rackService';
import { colors } from '../theme/colors';

const schema = z.object({
  rackNumber: z.string().trim().min(1, 'Raf numarası zorunludur.'),
  rowCount: z.string().trim().min(1, 'Viyol sayısı zorunludur.').refine((value) => Number(value) >= 1, 'Viyol sayısı en az 1 olmalıdır.'),
  positionsPerRow: z.string().trim().min(1, 'Viyol kapasitesi zorunludur.').refine((value) => Number(value) >= 1, 'Viyol kapasitesi en az 1 olmalıdır.'),
});

type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<RootStackParamList, 'NewRack'>;

export function NewRackScreen({ navigation, route }: Props) {
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rackNumber: '', rowCount: '10', positionsPerRow: '10' },
  });
  const total = Number(watch('rowCount') || 0) * Number(watch('positionsPerRow') || 0);

  async function onSubmit(values: FormData) {
    if (saving) return;
    setSaving(true);
    try {
      await rackService.create({
        machineId: route.params.machineId,
        rackNumber: values.rackNumber,
        rowCount: Number(values.rowCount),
        positionsPerRow: Number(values.positionsPerRow),
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Raf kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAwareForm>
        <Text style={styles.title}>Yeni Raf</Text>
        <Controller control={control} name="rackNumber" render={({ field }) => <TextField label="Raf numarası" value={field.value} onChangeText={field.onChange} error={errors.rackNumber?.message} />} />
        <Controller control={control} name="rowCount" render={({ field }) => <TextField label="Viyol sayısı" value={field.value} onChangeText={field.onChange} keyboardType="number-pad" error={errors.rowCount?.message} />} />
        <Controller control={control} name="positionsPerRow" render={({ field }) => <TextField label="Viyol kapasitesi" value={field.value} onChangeText={field.onChange} keyboardType="number-pad" error={errors.positionsPerRow?.message} />} />
        <Text style={styles.total}>Toplam: {total} yumurta</Text>
        <PrimaryButton title={saving ? 'Kaydediliyor...' : 'Rafı Kaydet'} onPress={handleSubmit(onSubmit)} disabled={saving} />
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 12 },
  total: { color: colors.primary, fontSize: 18, fontWeight: '900', marginBottom: 16 },
});
