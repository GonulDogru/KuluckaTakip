import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InfoCard } from '../components/InfoCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import type { RootStackParamList } from '../navigation/types';
import { machineService } from '../services/machineService';
import { rackService } from '../services/rackService';
import { colors } from '../theme/colors';
import type { OperationalMachine } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'MachineDetail'>;
type RackUsage = Awaited<ReturnType<typeof rackService.listWithUsage>>[number];

export function MachineDetailScreen({ navigation, route }: Props) {
  const [machine, setMachine] = useState<OperationalMachine | null>(null);
  const [racks, setRacks] = useState<RackUsage[]>([]);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([machineService.getById(route.params.machineId), rackService.listWithUsage(route.params.machineId)]).then(([machineData, rackData]) => {
      if (active) { setMachine(machineData); setRacks(rackData); }
    });
    return () => { active = false; };
  }, [route.params.machineId]));

  if (!machine) return <Screen><Text style={styles.state}>Yükleniyor...</Text></Screen>;

  const used = racks.reduce((sum, rack) => sum + rack.used, 0);
  return (
    <Screen>
      <FlatList
        data={racks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={styles.status}>{machine.active ? 'Aktif' : 'Pasif'}</Text>
            <Text style={styles.title}>{machine.name}</Text>
            <Text style={styles.subtitle}>Makine No: {machine.machineNumber}</Text>
            <View style={styles.grid}><InfoCard title="Kullanılan" value={`${used}`} /><InfoCard title="Boş" value={`${Math.max(machine.capacity - used, 0)}`} tone="success" /></View>
            <View style={styles.actions}><PrimaryButton title="+ RAF EKLE" onPress={() => navigation.navigate('NewRack', { machineId: machine.id })} /><PrimaryButton title="ÇIKIM SEPETLERİ" variant="secondary" onPress={() => navigation.navigate('HatchBaskets')} /></View>
            <Text style={styles.section}>Raflar</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.state}>Henüz raf bulunmuyor.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('ShelfMap', { machineId: machine.id, rackId: item.id })} style={styles.rackCard}>
            <View style={styles.row}><Text style={styles.rackTitle}>RAF {item.rackNumber}</Text><Text style={styles.percent}>%{item.occupancy}</Text></View>
            <Text style={styles.capacity}>{item.used} / {item.capacity} · Boş {item.empty}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  status: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 4 },
  subtitle: { color: colors.textMuted, marginTop: 6 },
  grid: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actions: { gap: 10, marginTop: 16 },
  section: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 24, marginBottom: 10 },
  rackCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rackTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  percent: { color: colors.primary, fontWeight: '900' },
  capacity: { color: colors.textMuted, marginTop: 8, fontWeight: '700' },
  state: { color: colors.textMuted, textAlign: 'center', margin: 24 },
});
