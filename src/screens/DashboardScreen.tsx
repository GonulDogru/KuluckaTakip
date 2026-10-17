import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DemoModeBadge } from '../components/DemoModeBadge';
import { InfoCard } from '../components/InfoCard';
import { Screen } from '../components/Screen';
import { batchService } from '../services/batchService';
import { customerService } from '../services/customerService';
import { paymentService } from '../services/paymentService';
import { colors } from '../theme/colors';
import { formatCurrency } from '../utils/money';

export function DashboardScreen() {
  const [summary, setSummary] = useState({ customers: 0, batches: 0, eggs: 0, debt: 0 });

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([customerService.list(), batchService.list(), paymentService.list()]).then(([customers, batches, payments]) => {
      if (!active) return;
      const debt = batches.reduce((total, batch) => {
        const batchPayments = payments.filter((payment) => payment.batchId === batch.id);
        return total + paymentService.calculateRemainingDebt(batch.totalPrice, batchPayments);
      }, 0);
      setSummary({
        customers: customers.length,
        batches: batches.length,
        eggs: batches.reduce((total, batch) => total + batch.eggCount, 0),
        debt,
      });
    });
    return () => { active = false; };
  }, []));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <DemoModeBadge />
        <Text style={styles.eyebrow}>Kuluçka Takip</Text>
        <Text style={styles.title}>Ana Sayfa</Text>
        <Text style={styles.sectionTitle}>Müşteri ve Ödeme Özeti</Text>
        <View style={styles.grid}><InfoCard title="Müşteri" value={`${summary.customers}`} tone="primary" /><InfoCard title="Yumurta kabulü" value={`${summary.batches}`} /></View>
        <View style={styles.grid}><InfoCard title="Alınan yumurta" value={`${summary.eggs}`} /><InfoCard title="Kalan toplam borç" value={formatCurrency(summary.debt)} tone="warning" /></View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 4 },
  grid: { flexDirection: 'row', gap: 12, marginTop: 14 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 24, marginBottom: 10 },
});
