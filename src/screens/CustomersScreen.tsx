import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DemoModeBadge } from '../components/DemoModeBadge';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import type { RootStackParamList } from '../navigation/types';
import { customerService } from '../services/customerService';
import { subscribeDataChanged } from '../services/dataEvents';
import { colors } from '../theme/colors';
import type { CustomerSummary } from '../types/models';
import { formatCurrency } from '../utils/money';

export function CustomersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      setCustomers(await customerService.listWithSummary());
    } catch {
      setError('Müşteriler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => subscribeDataChanged((event) => {
    if (event === 'customer' || event === 'batch' || event === 'payment') {
      void load(false);
    }
  }), [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(false);
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr-TR');
    if (!term) return customers;
    return customers.filter((customer) =>
      `${customer.firstName} ${customer.lastName} ${customer.phone}`.toLocaleLowerCase('tr-TR').includes(term),
    );
  }, [customers, query]);

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <DemoModeBadge />
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Müşteriler</Text>
                <Text style={styles.subtitle}>Müşteri borç ve yumurta kabulü özeti.</Text>
              </View>
              <PrimaryButton title="Yeni" onPress={() => navigation.navigate('NewCustomer')} />
            </View>
            <TextField label="Ara" value={query} onChangeText={setQuery} placeholder="Ad, soyad veya telefon" />
            {loading ? <Text style={styles.state}>Yükleniyor...</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={!loading && !error ? <Text style={styles.state}>Kayıtlı müşteri bulunamadı.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
            <Text style={styles.phone}>{item.phone}</Text>
            <View style={styles.row}>
              <Text style={styles.metric}>{item.activeBatchCount} aktif yumurta kabulü</Text>
              <Text style={styles.debt}>{formatCurrency(item.totalDebt)}</Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textMuted, marginTop: 6 },
  card: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  pressed: { opacity: 0.82 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  phone: { color: colors.textMuted, marginTop: 5, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  metric: { color: colors.primary, fontWeight: '900' },
  debt: { color: colors.danger, fontWeight: '900' },
  state: { color: colors.textMuted, textAlign: 'center', marginVertical: 20, fontWeight: '700' },
  error: { color: colors.danger, marginBottom: 12, fontWeight: '800' },
});
