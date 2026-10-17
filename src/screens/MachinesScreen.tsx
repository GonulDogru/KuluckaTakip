import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DemoModeBadge } from '../components/DemoModeBadge';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import type { RootStackParamList } from '../navigation/types';
import { subscribeDataChanged } from '../services/dataEvents';
import { machineService } from '../services/machineService';
import { colors } from '../theme/colors';

type MachineUsage = Awaited<ReturnType<typeof machineService.listWithUsage>>[number];

export function MachinesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [machines, setMachines] = useState<MachineUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setMachines(await machineService.listWithUsage());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => subscribeDataChanged((event) => {
    if (event === 'machine' || event === 'rack' || event === 'placement') {
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
        data={machines}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <DemoModeBadge />
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Makineler</Text>
                <Text style={styles.subtitle}>Kapasite, doluluk ve raf durumları.</Text>
              </View>
              <PrimaryButton title="Yeni" onPress={() => navigation.navigate('NewMachine')} />
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.state}>{loading ? 'Yükleniyor...' : 'Henüz makine bulunmuyor.'}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('MachineDetail', { machineId: item.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.row}>
              <View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>No: {item.machineNumber} · {item.active ? 'Aktif' : 'Pasif'}</Text>
              </View>
              <Text style={styles.percent}>%{item.occupancy}</Text>
            </View>
            <View style={styles.bar}><View style={[styles.fill, { width: `${item.occupancy}%` }]} /></View>
            <Text style={styles.capacity}>Kullanılan {item.used} · Boş {item.empty} · Toplam {item.capacity}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textMuted, marginTop: 6 },
  card: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  pressed: { opacity: 0.82 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  meta: { color: colors.textMuted, marginTop: 5, fontWeight: '700' },
  percent: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  bar: { height: 8, borderRadius: 8, backgroundColor: colors.surfaceMuted, marginTop: 14, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 8, backgroundColor: colors.primary },
  capacity: { color: colors.textMuted, marginTop: 10, fontWeight: '700' },
  state: { color: colors.textMuted, textAlign: 'center', marginTop: 24, fontWeight: '700' },
});
