import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { batchService } from '../services/batchService';
import { customerService } from '../services/customerService';
import { hatchBasketService } from '../services/hatchBasketService';
import { colors } from '../theme/colors';
import type { Batch, Customer, HatchBasketPlacement } from '../types/models';

type BasketUsage = Awaited<ReturnType<typeof hatchBasketService.listWithUsage>>[number];

export function HatchBasketsScreen() {
  const [baskets, setBaskets] = useState<BasketUsage[]>([]);
  const [placements, setPlacements] = useState<HatchBasketPlacement[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([hatchBasketService.listWithUsage(), hatchBasketService.listPlacements(), batchService.list(), customerService.list({ includeArchived: true })]).then(([basketData, placementData, batchData, customerData]) => {
      if (active) { setBaskets(basketData); setPlacements(placementData); setBatches(batchData); setCustomers(customerData); }
    });
    return () => { active = false; };
  }, []));

  return (
    <Screen>
      <FlatList
        data={baskets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<><Text style={styles.title}>Çıkım Sepetleri</Text><Text style={styles.subtitle}>Sepet dolulukları ve içerikleri.</Text></>}
        renderItem={({ item }) => {
          const basketPlacements = placements.filter((placement) => placement.hatchBasketId === item.id);
          return (
            <View style={styles.card}>
              <Text style={styles.name}>Sepet {item.basketNumber}</Text>
              <Text style={styles.capacity}>{item.used} / {item.capacity} {item.used >= item.capacity ? 'DOLU' : ''}</Text>
              {basketPlacements.map((placement) => {
                const batch = batches.find((candidate) => candidate.id === placement.batchId);
                const customer = batch ? customers.find((candidate) => candidate.id === batch.customerId) : null;
                return <Text key={placement.id} style={styles.line}>{batch?.batchNo ?? '-'} · {customer ? `${customer.firstName} ${customer.lastName}` : '-'} · {placement.eggCount} yumurta</Text>;
              })}
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textMuted, marginTop: 6, marginBottom: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  capacity: { color: colors.primary, fontWeight: '900', marginTop: 6 },
  line: { color: colors.textMuted, marginTop: 8, fontWeight: '700' },
});
