import { useFocusedRefresh } from '../hooks/useFocusedRefresh';
import { clearQueryCache } from '../services/queryCache';
import { smsStatusLabel, groupSmsLogs } from '../utils/smsStatus';
import { useCallback, useRef, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { PageHeading } from '../components/PageHeading';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { customerService } from '../services/customerService';
import { batchService } from '../services/batchService';
import { eggTypeService } from '../services/eggTypeService';
import { smsService } from '../services/smsService';
import { authService } from '../services/authService';
import { isSupabaseConfigured } from '../lib/supabase';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import type { Batch, Customer, EggType, SmsLog } from '../types/models';
import { formatDateTR } from '../utils/dateRules';
import { formatTurkishPhone, normalizeTurkishPhone } from '../utils/phone';

export function SmsCenterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [eggTypes, setEggTypes] = useState<EggType[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('pending');
  const loaded = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const sendingSmsRef = useRef(false);

  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    if (!loaded.current) setLoading(true);
    setError(null);
    try {
      const [logs, customerData, batchData, eggTypeData] = await Promise.all([
        smsService.list(), customerService.list({ includeArchived: true }), batchService.list(), eggTypeService.list(),
      ]);
      if (version !== loadVersion.current) return;
      loaded.current = true;
      setSmsLogs(logs);
      setCustomers(customerData);
      setBatches(batchData);
      setEggTypes(eggTypeData);
    } catch (loadError) {
      if (version === loadVersion.current) setError(loadError instanceof Error ? loadError.message : 'SMS kayıtları yüklenemedi.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);
  useFocusedRefresh(() => { void load(); }, ['sms', 'batch', 'customer', 'eggType']);

  const { pending, queued, sent } = groupSmsLogs(smsLogs);
  const deviceSupport = smsService.getDeviceSupport();

  function confirmSend(sms: SmsLog) {
    const destination = normalizeTurkishPhone(sms.phone);
    if (!destination) {
      Alert.alert('Geçersiz alıcı', 'Telefon numarası geçerli bir Türkiye cep telefonu numarası değil. SMS gönderilmedi.');
      return;
    }
    if (!sms.message.trim()) {
      Alert.alert('Boş mesaj', 'SMS mesajı boş olduğu için gönderilemez.');
      return;
    }

    Alert.alert(
      'Gerçek SMS gönderilsin mi?',
      `Alıcı: ${formatTurkishPhone(destination)} (${destination})\n\nMesaj:\n${sms.message}\n\nBu telefonun varsayılan SIM'i kullanılır. Operatör ücreti uygulanabilir; Android gönderim callback'i teslimatı garanti etmez.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'SIM ile gönder',
          style: 'destructive',
          onPress: () => { void sendSms(sms); },
        },
      ],
    );
  }

  async function sendSms(confirmedSms: SmsLog) {
    if (sendingSmsRef.current) return;
    sendingSmsRef.current = true;
    setSendingSmsId(confirmedSms.id);
    try {
      const result = await smsService.sendQueuedSms(confirmedSms.id, {
        phone: confirmedSms.phone,
        message: confirmedSms.message,
      });
      Alert.alert(result.status === 'sent' ? 'Gönderim sonucu' : 'SMS durumu', result.detail ?? 'SMS sonucu doğrulanamadı.');
      try {
        setSmsLogs(await smsService.list());
      } catch (refreshError: unknown) {
        Alert.alert(
          'Liste yenilenemedi',
          `Gönderim sonucu: ${result.detail ?? result.status}. SMS listesi yenilenirken hata oluştu: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`,
        );
      }
    } catch (sendError) {
      Alert.alert('Gönderilemedi', sendError instanceof Error ? sendError.message : 'SMS gönderim işlemi tamamlanamadı.');
    } finally {
      sendingSmsRef.current = false;
      setSendingSmsId(null);
    }
  }

  async function signOut() {
    try {
      await authService.signOut();
    } catch (signOutError) {
      Alert.alert('Oturum kapatılamadı', signOutError instanceof Error ? signOutError.message : 'Lütfen tekrar deneyin.');
    }
  }

  function renderSms(sms: SmsLog, canSend = false) {
    const customer = customers.find((item) => item.id === sms.customerId);
    const batch = batches.find((item) => item.id === sms.batchId);
    const eggType = batch ? eggTypes.find((item) => item.id === batch.eggTypeId) : null;
    const customerName = customer
      ? [customer.firstName, customer.lastName].filter((name) => name && name !== '-').join(' ')
      : 'Müşteri kaydı bulunamadı';

    return (
      <View key={sms.id} style={styles.card}>
        <Pressable onPress={() => navigation.navigate('SmsPreview', { smsId: sms.id })} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.customer}>{customerName}</Text>
          <Text style={styles.phone}>{formatTurkishPhone(sms.phone)}</Text>
          <Text style={styles.eggInfo}>
            {batch ? `${batch.eggCount} ${eggType?.name ?? 'yumurta'} yumurtası` : sms.message}
          </Text>
          {batch ? <Text style={styles.hatchDate}>Tahmini çıkım: {batch.expectedHatchDate ? formatDateTR(batch.expectedHatchDate) : '—'}</Text> : null}
          <Text style={styles.message} numberOfLines={3}>{sms.message}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.status}>{`Durum: ${smsStatusLabel(sms.status)}`}</Text>
            <Text style={styles.openHint}>Önizleme ve düzenleme</Text>
          </View>
        </Pressable>
        {canSend ? (
          <View style={styles.sendButton}>
            <PrimaryButton
              title={sendingSmsId === sms.id ? 'SIM gönderimi sürüyor...' : 'Bu telefondan SIM ile gönder'}
              onPress={() => confirmSend(sms)}
              disabled={sendingSmsId !== null}
            />
          </View>
        ) : null}
      </View>
    );
  }

  const groups = [
    { id: 'pending', title: 'Taslaklar', hint: 'Düzenlenecek ve kontrol edilecek mesajların.', items: pending, color: colors.primary, soft: colors.primarySoft },
    { id: 'queued', title: 'Gönderilecekler', hint: 'Sıradaki ve gönderimi devam eden mesajların.', items: queued, color: colors.red, soft: colors.redSoft },
    { id: 'sent', title: 'Gönderilenler', hint: 'Gönderim geçmişini buradan takip et.', items: sent, color: colors.success, soft: '#E8F5EF' },
  ];
  const group = groups.find((item) => item.id === selectedGroup) ?? groups[0]!;

  return (
    <Screen>
      <FlatList
        data={loading || error ? [] : group.items}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { clearQueryCache(); setLoading(true); void load(); }} />}
        keyExtractor={(sms) => sms.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<>
          <PageHeading eyebrow="HABERLERİ PAYLAŞ" title="SMS Merkezi" subtitle="Mesajlarını hazırla, takip et ve paylaş." />
          <Text testID="sms-device-support" style={styles.deviceSupport}>{deviceSupport.detail}</Text>
          <View style={styles.filters} accessibilityRole="tablist">
            {groups.map((item) => {
              const selected = item.id === selectedGroup;
              return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setSelectedGroup(item.id)} style={[styles.filter, selected && { backgroundColor: item.color, borderColor: item.color }]}>
                <View style={[styles.filterCount, selected && styles.selectedCount]}><Text style={[styles.countText, selected && styles.selectedText]}>{loading ? '—' : item.items.length}</Text></View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.filterText, selected && styles.selectedText]}>{item.title}</Text>
              </Pressable>;
            })}
          </View>
          <View style={[styles.groupHeading, { backgroundColor: group.soft }]}>
            <View style={[styles.groupIcon, { backgroundColor: group.color }]}><AppIcon name="mail" color={colors.surface} size={21} /></View>
            <View style={styles.groupCopy}><Text style={[styles.groupTitle, { color: group.color }]}>{group.title}</Text><Text style={styles.groupHint}>{group.hint}</Text></View>
          </View>
          {loading ? <Text style={styles.state}>Mesajlar yükleniyor...</Text> : null}
          {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><PrimaryButton title="Tekrar dene" onPress={() => { clearQueryCache(); void load(); }} /></> : null}
        </>}
        renderItem={({ item }) => renderSms(item, item.status.toUpperCase() === 'QUEUED')}
        ListEmptyComponent={!loading && !error ? <View style={styles.empty}><View style={styles.emptyIcon}><AppIcon name="mail" size={28} color={group.color} /></View><Text style={styles.emptyTitle}>Burada henüz mesaj yok</Text><Text style={styles.emptyHint}>Bu gruptaki mesajların burada görünecek.</Text></View> : null}
        ListFooterComponent={isSupabaseConfigured ? <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.signOutButton}><Text style={styles.signOutText}>Oturumu kapat</Text></Pressable> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deviceSupport: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  content: { padding: 20, paddingBottom: 28 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 88, paddingHorizontal: 5, paddingVertical: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  filterCount: { minWidth: 32, minHeight: 32, borderRadius: 11, paddingHorizontal: 7, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceMuted },
  countText: { color: colors.textMuted, fontSize: 19, fontWeight: '800' },
  selectedText: { color: colors.surface },
  selectedCount: { backgroundColor: 'rgba(255,255,255,0.2)' },
  groupHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 19, marginBottom: 16 },
  groupIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  groupCopy: { flex: 1 },
  groupTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  groupHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 17, marginBottom: 12 },
  pressed: { opacity: 0.82 },
  customer: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  phone: { color: colors.textMuted, marginTop: 5, fontSize: 12, fontWeight: '600' },
  eggInfo: { color: colors.primary, marginTop: 12, fontSize: 12, fontWeight: '700' },
  hatchDate: { color: colors.textMuted, marginTop: 5, fontSize: 12 },
  message: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 12, backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12 },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 14 },
  status: { color: colors.accent, backgroundColor: colors.cream, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '700' },
  openHint: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  state: { color: colors.textMuted, textAlign: 'center', marginVertical: 16, fontWeight: '600' },
  error: { color: colors.danger, marginVertical: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { backgroundColor: colors.surface, width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyHint: { color: colors.textMuted, fontSize: 12, marginTop: 7, textAlign: 'center' },
  sendButton: { marginTop: 14 },
  signOutButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  signOutText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});
