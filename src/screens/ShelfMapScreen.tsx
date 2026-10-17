import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import type { RootStackParamList } from '../navigation/types';
import { batchService } from '../services/batchService';
import { customerService } from '../services/customerService';
import { eggTypeService } from '../services/eggTypeService';
import { machineService } from '../services/machineService';
import { rackService } from '../services/rackService';
import { trayService } from '../services/trayService';
import { colors } from '../theme/colors';
import type { Batch, Customer, EggType, OperationalMachine, Rack, TrayAllocation, TrayWithUsage } from '../types/models';
import { formatDateTR } from '../utils/dateRules';

type Props = NativeStackScreenProps<RootStackParamList, 'ShelfMap'>;
type Draft = Record<string, number>;

function initials(customer?: Customer) {
  if (!customer) return '--';
  return `${customer.firstName[0] ?? ''}${customer.lastName[0] ?? ''}`.toUpperCase();
}

export function ShelfMapScreen({ navigation, route }: Props) {
  const [machine, setMachine] = useState<OperationalMachine | null>(null);
  const [rack, setRack] = useState<Rack | null>(null);
  const [trays, setTrays] = useState<TrayWithUsage[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [eggTypes, setEggTypes] = useState<EggType[]>([]);
  const [allAllocations, setAllAllocations] = useState<TrayAllocation[]>([]);
  const [selectedTray, setSelectedTray] = useState<TrayWithUsage | null>(null);
  const [placing, setPlacing] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});

  const load = useCallback(async () => {
    const machineData = await machineService.getById(route.params.machineId);
    const racks = await rackService.list(route.params.machineId);
    const rackData = route.params.rackId ? await rackService.getById(route.params.rackId) : racks[0] ?? null;
    const [batchData, customerData, eggTypeData, allocationData] = await Promise.all([batchService.list(), customerService.list({ includeArchived: true }), eggTypeService.list(), trayService.listAllocations()]);
    setMachine(machineData);
    setRack(rackData);
    setBatches(batchData);
    setCustomers(customerData);
    setEggTypes(eggTypeData);
    setAllAllocations(allocationData);
    setTrays(rackData ? await trayService.listByRack(rackData) : []);
  }, [route.params.machineId, route.params.rackId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const batchMap = useMemo(() => new Map(batches.map((batch) => [batch.id, batch])), [batches]);
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const eggTypeMap = useMemo(() => new Map(eggTypes.map((eggType) => [eggType.id, eggType])), [eggTypes]);
  const activeBatches = batches.filter((batch) => ['RECEIVED', 'INCUBATING', 'TRANSFER_DUE'].includes(batch.status));
  const selectedBatch = selectedBatchId ? batchMap.get(selectedBatchId) : null;
  const rackUsed = trays.reduce((sum, tray) => sum + tray.used, 0);
  const rackCapacity = trays.reduce((sum, tray) => sum + tray.capacity, 0);
  const draftTotal = Object.values(draft).reduce((sum, count) => sum + count, 0);
  const selectedBatchPlaced = selectedBatchId
    ? allAllocations.filter((allocation) => allocation.batchId === selectedBatchId).reduce((sum, allocation) => sum + allocation.eggCount, 0)
    : 0;
  const selectedBatchRemaining = selectedBatch ? Math.max(selectedBatch.eggCount - selectedBatchPlaced, 0) : 0;

  function resetPlacement() {
    setPlacing(false);
    setSelectedBatchId(null);
    setDraft({});
  }

  function updateDraft(tray: TrayWithUsage, nextCount: number) {
    const safeCount = Math.max(0, Math.min(tray.empty, nextCount, selectedBatchRemaining));
    setDraft((current) => {
      const next = { ...current };
      if (safeCount <= 0) delete next[tray.id];
      else next[tray.id] = safeCount;
      return next;
    });
  }

  function autoDistribute() {
    if (!selectedBatch) {
      Alert.alert('Uyarı', 'Önce parti seçin.');
      return;
    }
    const suggestions = trayService.suggestAllocation(trays, selectedBatchRemaining);
    setDraft(Object.fromEntries(suggestions.map((suggestion) => [suggestion.trayId, suggestion.eggCount])));
  }

  async function savePlacement() {
    if (!selectedBatchId) return;
    try {
      await trayService.placeAllocations({
        batchId: selectedBatchId,
        allocations: Object.entries(draft).map(([trayId, eggCount]) => ({ trayId, eggCount })),
      });
      resetPlacement();
      await load();
    } catch (error) {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Yerleştirme yapılamadı.');
    }
  }

  if (!machine || !rack) return <Screen><Text style={styles.state}>Yükleniyor...</Text></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{machine.name}</Text>
        <Text style={styles.subtitle}>Raf {rack.rackNumber} · {rackUsed} / {rackCapacity} yumurta</Text>
        <PrimaryButton title={placing ? 'Yerleştirmeyi İptal Et' : 'YUMURTA YERLEŞTİR'} variant={placing ? 'secondary' : 'primary'} onPress={() => (placing ? resetPlacement() : setPlacing(true))} />

        {placing ? (
          <View style={styles.placeBox}>
            <Text style={styles.placeTitle}>Parti seç</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {activeBatches.map((batch) => (
                <Pressable key={batch.id} onPress={() => { setSelectedBatchId(batch.id); setDraft({}); }} style={[styles.batchChip, selectedBatchId === batch.id && styles.batchChipActive]}>
                  <Text style={[styles.batchChipText, selectedBatchId === batch.id && styles.batchChipTextActive]}>{batch.batchNo}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {selectedBatch ? <Text style={styles.placeText}>Kalan yerleşim: {selectedBatchRemaining} yumurta · Öneri: {draftTotal}</Text> : null}
            <View style={styles.actionRow}>
              <PrimaryButton title="BOŞLUKLARA OTOMATİK DAĞIT" onPress={autoDistribute} disabled={!selectedBatch || selectedBatchRemaining <= 0} />
              <PrimaryButton title="Yerleştir" onPress={savePlacement} disabled={!selectedBatchId || draftTotal <= 0} />
            </View>
          </View>
        ) : null}

        <View style={styles.trayGrid}>
          {trays.map((tray) => {
            const draftCount = draft[tray.id] ?? 0;
            const highlighted = route.params.highlightBatchId && tray.allocations.some((allocation) => allocation.batchId === route.params.highlightBatchId);
            const firstAllocation = tray.allocations[0];
            const firstBatch = firstAllocation ? batchMap.get(firstAllocation.batchId) : null;
            const firstCustomer = firstBatch ? customerMap.get(firstBatch.customerId) : undefined;
            return (
              <Pressable key={tray.id} onPress={() => (placing ? updateDraft(tray, draftCount + 1) : setSelectedTray(tray))} style={[styles.trayCard, highlighted && styles.highlightTray]}>
                <Text style={styles.trayTitle}>V{String(tray.trayNumber).padStart(2, '0')}</Text>
                {tray.allocations.length === 0 ? <Text style={styles.emptyText}>Boş</Text> : null}
                {tray.allocations.length === 1 ? <Text style={styles.trayLine}>{initials(firstCustomer)} {firstAllocation?.eggCount}</Text> : null}
                {tray.allocations.length > 1 && tray.allocations.length <= 2 ? tray.allocations.map((allocation) => {
                  const batch = batchMap.get(allocation.batchId);
                  return <Text key={allocation.id} style={styles.trayLine}>{initials(batch ? customerMap.get(batch.customerId) : undefined)} {allocation.eggCount}</Text>;
                }) : null}
                {tray.allocations.length > 2 ? <Text style={styles.trayLine}>{tray.allocations.length} parti</Text> : null}
                <Text style={styles.capacityText}>{tray.used} / {tray.capacity}</Text>
                {placing ? (
                  <View style={styles.stepper}>
                    <Pressable onPress={() => updateDraft(tray, draftCount - 1)} style={styles.stepButton}><Text style={styles.stepText}>-</Text></Pressable>
                    <Text style={styles.draftText}>{draftCount}</Text>
                    <Pressable onPress={() => updateDraft(tray, draftCount + 1)} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedTray)} transparent animationType="slide" onRequestClose={() => setSelectedTray(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelectedTray(null)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>Viyol {String(selectedTray?.trayNumber ?? 0).padStart(2, '0')}</Text>
            <Text style={styles.sheetText}>Doluluk: {selectedTray?.used ?? 0} / {selectedTray?.capacity ?? 0}</Text>
            {selectedTray?.allocations.length === 0 ? <Text style={styles.sheetText}>Bu viyol boş.</Text> : null}
            {selectedTray?.allocations.map((allocation) => {
              const batch = batchMap.get(allocation.batchId);
              const customer = batch ? customerMap.get(batch.customerId) : null;
              const eggType = batch ? eggTypeMap.get(batch.eggTypeId) : null;
              return (
                <Pressable key={allocation.id} onPress={() => batch && navigation.navigate('BatchDetail', { batchId: batch.id })} style={styles.allocationCard}>
                  <Text style={styles.allocationTitle}>{customer ? `${customer.firstName} ${customer.lastName}` : '-'}</Text>
                  <Text style={styles.sheetText}>{batch?.batchNo ?? '-'} · {allocation.eggCount} yumurta</Text>
                  <Text style={styles.sheetText}>{eggType?.name ?? '-'} · Giriş: {formatDateTR(batch?.incubationDate)}</Text>
                  <Text style={styles.sheetText}>Tahmini çıkım: {formatDateTR(batch?.expectedHatchDate)}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textMuted, marginTop: 6, marginBottom: 14 },
  state: { color: colors.textMuted, textAlign: 'center', margin: 24 },
  placeBox: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: 12 },
  placeTitle: { color: colors.text, fontWeight: '900', marginBottom: 8 },
  placeText: { color: colors.primary, fontWeight: '900', marginVertical: 10 },
  batchChip: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  batchChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  batchChipText: { color: colors.text, fontWeight: '900' },
  batchChipTextActive: { color: colors.surface },
  actionRow: { gap: 10 },
  trayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  trayCard: { width: '48%', minHeight: 128, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12 },
  highlightTray: { borderColor: colors.danger, borderWidth: 2 },
  trayTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  trayLine: { color: colors.text, fontWeight: '800', marginTop: 5 },
  emptyText: { color: colors.textMuted, fontWeight: '800', marginTop: 8 },
  capacityText: { color: colors.primary, fontWeight: '900', marginTop: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  stepButton: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.surface, fontSize: 20, fontWeight: '900' },
  draftText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(23, 32, 51, 0.36)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 28, maxHeight: '88%' },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  sheetText: { color: colors.text, fontWeight: '700', marginTop: 6 },
  allocationCard: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 },
  allocationTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
});
