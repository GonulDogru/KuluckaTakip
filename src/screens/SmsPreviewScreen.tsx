import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import type { RootStackParamList } from '../navigation/types';
import { batchService } from '../services/batchService';
import { customerService } from '../services/customerService';
import { eggTypeService } from '../services/eggTypeService';
import { smsService } from '../services/smsService';
import { colors } from '../theme/colors';
import type { Batch, Customer, EggType, SmsLog } from '../types/models';
import { formatDateTR } from '../utils/dateRules';
import { formatTurkishPhone } from '../utils/phone';

type Props = NativeStackScreenProps<RootStackParamList, 'SmsPreview'>;

function statusLabel(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING': return 'Taslak';
    case 'SENT': return 'Gönderildi';
    case 'DELIVERED': return 'Teslim edildi';
    case 'QUEUED': return 'Gönderilecekler listesinde';
    case 'SENDING': return 'İşlemde / sahiplenilmiş';
    case 'FAILED': return 'Gönderim başarısız';
    case 'UNKNOWN': return 'Gönderim sonucu belirsiz';
    default: return 'Bekliyor';
  }
}

export function SmsPreviewScreen({ navigation, route }: Props) {
  const [sms, setSms] = useState<SmsLog | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [eggType, setEggType] = useState<EggType | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const smsLog = await smsService.getById(route.params.smsId);
        if (!smsLog) throw new Error('SMS kaydı bulunamadı.');

        const [customerData, batchData, eggTypes] = await Promise.all([
          smsLog.customerId ? customerService.getById(smsLog.customerId) : Promise.resolve(null),
          smsLog.batchId ? batchService.getById(smsLog.batchId) : Promise.resolve(null),
          eggTypeService.list(),
        ]);
        if (active) {
          setSms(smsLog);
          setCustomer(customerData);
          setBatch(batchData);
          setEggType(batchData ? eggTypes.find((item) => item.id === batchData.eggTypeId) ?? null : null);
          setMessageDraft(smsLog.message);
          setEditing(false);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'SMS önizlemesi yüklenemedi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [route.params.smsId]));

  async function saveMessage() {
    if (!sms || saving) return;
    setSaving(true);
    try {
      const updated = await smsService.updateMessage(sms.id, messageDraft);
      setSms(updated);
      setMessageDraft(updated.message);
      setEditing(false);
      Alert.alert('Kaydedildi', 'SMS mesajı güncellendi.');
    } catch (saveError) {
      Alert.alert('Kaydedilemedi', saveError instanceof Error ? saveError.message : 'SMS mesajı güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function addToOutgoingList() {
    if (!sms || addingToQueue) return;
    setAddingToQueue(true);
    try {
      const result = await smsService.addToOutgoingList(sms.id);
      setSms(result.sms);
      const confirmation = result.alreadyQueued
        ? 'Bu SMS zaten gönderilecekler listesinde. Yeni kayıt oluşturulmadı.'
        : 'SMS gönderilecekler listesine eklendi. Gönderim yapılmadı.';
      Alert.alert('Gönderilecekler', confirmation);
    } catch (queueError) {
      Alert.alert('Listeye eklenemedi', queueError instanceof Error ? queueError.message : 'SMS gönderilecekler listesine eklenemedi.');
    } finally {
      setAddingToQueue(false);
    }
  }

  async function resolveOutcome(resolution: 'sent' | 'retry') {
    if (!sms) return;
    try {
      const updated = await smsService.resolveSmsUncertain(sms.id, resolution);
      if (!updated) throw new Error('SMS durumu değişmiş olabilir. Listeyi yenileyin.');
      const refreshed = await smsService.getById(sms.id);
      if (!refreshed) throw new Error('SMS kaydı bulunamadı.');
      setSms(refreshed);
      setMessageDraft(refreshed.message);
      Alert.alert('SMS uzlaştırıldı', resolution === 'sent'
        ? 'Kayıt gönderildi olarak işaretlendi; yeni gönderim yapılmadı.'
        : 'SMS ortak kuyruğa alındı. Bir sonraki SIM gönderimi için ayrıca açık onay gerekir.');
    } catch (resolveError) {
      Alert.alert('Uzlaştırılamadı', resolveError instanceof Error ? resolveError.message : 'SMS durumu güncellenemedi.');
    }
  }

  function confirmOutcome(resolution: 'sent' | 'retry') {
    if (!sms) return;
    if (resolution === 'sent') {
      Alert.alert(
        'Gönderildi olarak işaretle?',
        'Bu işlem SMS göndermeden kaydı gönderildi olarak işaretler. Yalnızca gönderimin gerçekleştiğinden eminseniz kullanın.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Gönderildi olarak işaretle', onPress: () => { void resolveOutcome('sent'); } },
        ],
      );
      return;
    }
    Alert.alert(
      'Yeniden kuyruğa al?',
      'Önceki SMS fiziksel olarak gönderilmiş olabilir. Yeniden gönderme müşteriye çift SMS ulaşmasına neden olabilir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Riski kabul et ve kuyruğa al', style: 'destructive', onPress: () => { void resolveOutcome('retry'); } },
      ],
    );
  }

  if (loading) {
    return <Screen><Text style={styles.state}>SMS önizlemesi yükleniyor...</Text></Screen>;
  }

  if (error || !sms) {
    return <Screen><Text style={styles.error}>{error ?? 'SMS kaydı bulunamadı.'}</Text></Screen>;
  }

  const customerName = customer
    ? [customer.firstName, customer.lastName].filter((name) => name && name !== '-').join(' ')
    : 'Müşteri kaydı bulunamadı';
  const status = sms.status.toUpperCase();
  const canEdit = ['PENDING', 'QUEUED', 'FAILED'].includes(status);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>SMS Önizleme</Text>
        <View style={styles.detailsCard}>
          <Text style={styles.label}>Alıcı</Text>
          <Text style={styles.value}>{customerName}</Text>
          <Text style={styles.label}>Telefon</Text>
          <Text style={styles.value}>{formatTurkishPhone(sms.phone)}</Text>
          <Text style={styles.label}>Yumurta</Text>
          <Text style={styles.value}>
            {batch ? `${batch.eggCount} ${eggType?.name ?? 'yumurta'} yumurtası` : '—'}
          </Text>
          <Text style={styles.label}>Tahmini çıkım</Text>
          <Text style={styles.value}>{batch?.expectedHatchDate ? formatDateTR(batch.expectedHatchDate) : '—'}</Text>
          <Text style={styles.label}>Durum</Text>
          <Text style={styles.status}>{statusLabel(sms.status)}</Text>
        </View>

        <Text style={styles.label}>Mesaj</Text>
        {editing ? (
          <TextInput
            accessibilityLabel="SMS mesajını düzenle"
            multiline
            value={messageDraft}
            onChangeText={setMessageDraft}
            textAlignVertical="top"
            style={styles.messageInput}
          />
        ) : (
          <View style={styles.messageCard}>
            <Text style={styles.message}>{sms.message}</Text>
          </View>
        )}

        {sms.providerResponse && ['FAILED', 'UNKNOWN'].includes(status) ? (
          <Text style={styles.disclaimer}>{sms.providerResponse}</Text>
        ) : null}

        {canEdit ? (
          <View style={styles.actions}>
            {editing ? (
              <>
                <PrimaryButton title={saving ? 'Kaydediliyor...' : 'Kaydet'} onPress={() => { void saveMessage(); }} disabled={saving || !messageDraft.trim()} />
                <PrimaryButton title="Vazgeç" variant="secondary" onPress={() => { setMessageDraft(sms.message); setEditing(false); }} disabled={saving} />
              </>
            ) : (
              <>
                <PrimaryButton title="Mesajı Düzenle" variant="secondary" onPress={() => setEditing(true)} />
                {status === 'PENDING' ? (
                  <PrimaryButton title={addingToQueue ? 'Ekleniyor...' : 'Gönderilecekler Listesine Ekle'} onPress={() => { void addToOutgoingList(); }} disabled={addingToQueue} />
                ) : null}
              </>
            )}
          </View>
        ) : null}
        {(status === 'UNKNOWN' || status === 'FAILED') ? (
          <View style={styles.actions}>
            {status === 'UNKNOWN' ? (
              <PrimaryButton
                title="Gönderildi olarak manuel uzlaştır"
                variant="secondary"
                onPress={() => confirmOutcome('sent')}
              />
            ) : null}
            <PrimaryButton
              title="Yeniden kuyruğa al"
              onPress={() => confirmOutcome('retry')}
            />
          </View>
        ) : null}
        <PrimaryButton title="SMS Merkezi'ne Dön" variant="secondary" onPress={() => navigation.goBack()} />
        <Text style={styles.disclaimer}>Kuyruğa eklemek SMS göndermez. Gerçek SIM gönderimi SMS Merkezi'nden ayrıca onaylanır.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 18 },
  detailsCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 20 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '800', marginTop: 10, marginBottom: 4 },
  value: { color: colors.text, fontSize: 16, fontWeight: '900' },
  status: { color: colors.accent, fontSize: 15, fontWeight: '900' },
  messageCard: { minHeight: 110, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 16 },
  message: { color: colors.text, fontSize: 16, lineHeight: 24 },
  messageInput: { minHeight: 140, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, padding: 14, color: colors.text, fontSize: 16, lineHeight: 24 },
  actions: { gap: 10, marginVertical: 16 },
  disclaimer: { color: colors.textMuted, textAlign: 'center', marginTop: 14, fontSize: 12, fontWeight: '700' },
  state: { color: colors.textMuted, textAlign: 'center', margin: 24, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center', margin: 24, fontWeight: '800' },
});
