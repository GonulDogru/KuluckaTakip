import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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

function isSentStatus(status: string) {
  return ['SENT', 'DELIVERED'].includes(status.toUpperCase());
}

function statusLabel(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING': return 'Taslak';
    case 'QUEUED': return 'Gönderilecekler listesinde';
    case 'SENDING': return 'İşlemde / sahiplenilmiş';
    case 'SENT': return 'Gönderildi';
    case 'DELIVERED': return 'Teslim edildi';
    case 'FAILED': return 'Gönderim başarısız';
    case 'UNKNOWN': return 'Gönderim sonucu belirsiz';
    default: return 'Bekliyor';
  }
}

export function SmsCenterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [eggTypes, setEggTypes] = useState<EggType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const sendingSmsRef = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [logs, customerData, batchData, eggTypeData] = await Promise.all([
          smsService.list(),
          customerService.list({ includeArchived: true }),
          batchService.list(),
          eggTypeService.list(),
        ]);
        if (active) {
          setSmsLogs(logs);
          setCustomers(customerData);
          setBatches(batchData);
          setEggTypes(eggTypeData);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'SMS kayıtları yüklenemedi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []));

  const pending = smsLogs.filter((sms) => sms.status.toUpperCase() === 'PENDING');
  const queued = smsLogs.filter((sms) => sms.status.toUpperCase() === 'QUEUED');
  const sending = smsLogs.filter((sms) => sms.status.toUpperCase() === 'SENDING');
  const sent = smsLogs.filter((sms) => isSentStatus(sms.status));
  const failed = smsLogs.filter((sms) => sms.status.toUpperCase() === 'FAILED');
  const unknown = smsLogs.filter((sms) => sms.status.toUpperCase() === 'UNKNOWN');

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
            <Text style={styles.status}>{`Durum: ${statusLabel(sms.status)}`}</Text>
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>SMS Merkezi</Text>
        <Text style={styles.subtitle}>Kuyruk ortak Supabase'dedir. SMS yalnızca açık onayınızla bu telefondaki varsayılan SIM üzerinden gönderilir.</Text>
        <View style={styles.deviceCard}>
          <Text style={styles.deviceTitle}>Gönderim yetkisi</Text>
          <Text style={styles.deviceHint}>Etkin uygulama üyeliği olan kullanıcılar, ayrıca SMS cihaz kaydı veya ana cihaz seçimi olmadan bu telefondan gönderim yapabilir. Aynı SMS'i birden fazla telefonun eşzamanlı göndermesini claim işlemi engeller. Çift SIM cihazlarda Android varsayılan SMS SIM'ini kullanır.</Text>
          {isSupabaseConfigured ? <View style={styles.signOutButton}><PrimaryButton title="Oturumu kapat" variant="secondary" onPress={() => { void signOut(); }} /></View> : null}
        </View>
        {loading ? <Text style={styles.state}>Yükleniyor...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error ? (
          <>
            <Text style={styles.sectionTitle}>Taslaklar ({pending.length})</Text>
            {pending.length ? pending.map((sms) => renderSms(sms)) : <Text style={styles.state}>Bekleyen SMS bulunmuyor.</Text>}
            <Text style={styles.sectionTitle}>Gönderilecekler ({queued.length})</Text>
            {queued.length ? queued.map((sms) => renderSms(sms, true)) : <Text style={styles.state}>Gönderilecek SMS bulunmuyor.</Text>}
            <Text style={styles.sectionTitle}>İşlemde / sahiplenilmiş ({sending.length})</Text>
            {sending.length ? sending.map((sms) => renderSms(sms)) : <Text style={styles.state}>İşlemde SMS yok.</Text>}
            <Text style={styles.sectionTitle}>Gönderilenler ({sent.length})</Text>
            {sent.length ? sent.map((sms) => renderSms(sms)) : <Text style={styles.state}>Gönderilmiş SMS bulunmuyor.</Text>}
            <Text style={styles.sectionTitle}>Başarısız ({failed.length})</Text>
            {failed.length ? failed.map((sms) => renderSms(sms)) : <Text style={styles.state}>Başarısız SMS yok.</Text>}
            <Text style={styles.sectionTitle}>Sonucu belirsiz ({unknown.length})</Text>
            {unknown.length ? unknown.map((sms) => renderSms(sms)) : <Text style={styles.state}>Sonucu belirsiz SMS yok.</Text>}
          </>
        ) : null}
      </ScrollView>

    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textMuted, marginTop: 6, lineHeight: 21 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 24, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  pressed: { opacity: 0.82 },
  customer: { color: colors.text, fontSize: 17, fontWeight: '900' },
  phone: { color: colors.primary, marginTop: 5, fontWeight: '800' },
  eggInfo: { color: colors.text, marginTop: 12, fontWeight: '900' },
  hatchDate: { color: colors.textMuted, marginTop: 5, fontWeight: '700' },
  message: { color: colors.text, lineHeight: 21, marginTop: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 14 },
  status: { color: colors.accent, fontWeight: '900' },
  openHint: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  state: { color: colors.textMuted, textAlign: 'center', marginVertical: 16, fontWeight: '700' },
  error: { color: colors.danger, marginTop: 12, fontWeight: '800' },
  deviceCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 16 },
  deviceTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  deviceHint: { color: colors.textMuted, marginTop: 6, lineHeight: 19, fontSize: 12 },
  sendButton: { marginTop: 14 },
  signOutButton: { marginTop: 16 },
});
