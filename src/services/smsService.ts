import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { PermissionsAndroid, Platform } from 'react-native';
import { customerService } from './customerService';
import { eggTypeService } from './eggTypeService';
import type { Batch, Customer, EggType, SmsLog } from '../types/models';
import { formatDateTR, isValidDateOnly } from '../utils/dateRules';
import { mapSmsLog } from './mappers';
import { emitDataChanged } from './dataEvents';
import { getSmsDeviceIdentity } from './smsDeviceIdentity';
import { isDirectSimSmsModuleInstalled, isDirectSimSmsAvailable, sendDirectSimSms, type NativeSmsResult } from '../../modules/sim-sms';
import { normalizeTurkishPhone } from '../utils/phone';
import { readAllRows } from './readAllRows';
import { withSmsSignature } from '../utils/smsSignature';

const demoSmsStore: SmsLog[] = [];
const demoCustomMessages = new Set<string>();
let nextDemoSmsId = 0;
const smsLogColumns = 'id,customer_id,batch_id,phone,message,status,created_at,provider_response,claimed_by,lease_until,needs_review';

type HatchSmsInput = {
  customer: Customer;
  batch: Batch;
  eggType: EggType;
};

export type HatchSmsDraftResult =
  | { created: true; sms: SmsLog }
  | { created: false; sms?: SmsLog; reason: string };

export type SmsClaimResult = {
  claimed: boolean;
  claimToken: string | null;
  leaseUntil: string | null;
  smsPhone: string | null;
  smsMessage: string | null;
};

export type SmsSendConfirmation = {
  phone: string;
  message: string;
};

export type SmsDeviceSupportStatus = 'available' | 'unsupported' | 'native_unavailable' | 'no_telephony' | 'device_unavailable';
export type SmsPermissionResult = 'granted' | 'denied' | 'never_ask_again' | Exclude<SmsDeviceSupportStatus, 'available'>;

export type SmsAttemptResult = {
  status: 'sent' | 'failed' | 'unknown' | 'not_claimed' | 'permission_denied' | 'unavailable';
  stateSaved: boolean;
  detail?: string;
};

function nativeResultMessage(result: NativeSmsResult) {
  switch (result.code) {
    case 'radio_accepted': return 'Android SMS servisi gönderimi kabul etti; teslimat teyidi alınmaz.';
    case 'radio_rejected': return 'Android SMS servisi gönderimi reddetti.';
    case 'permission_denied': return 'SMS izni verilmedi.';
    case 'no_telephony': return 'Bu cihazda SMS destekleyen telefon donanımı bulunmuyor.';
    case 'invalid_message': return 'Telefon numarası biçimi geçersiz veya mesaj boş.';
    case 'sim_or_radio_unavailable': return 'SIM veya mobil şebeke durumu belirlenemedi.';
    case 'send_callback_timeout': return 'Android gönderim sonucu zamanında bildirmedi; mesaj tekrar gönderilmedi.';
    case 'partial_multipart_result': return 'Çok parçalı SMS sonucunun bir bölümü belirsiz; mesaj tekrar gönderilmedi.';
    case 'native_module_missing': return 'Bu kurulumda SMS bileşeni yüklenemedi. Uygulamayı güncelleyin.';
    default: return result.status === 'unknown'
      ? 'Gönderim sonucu doğrulanamadı; olası çift gönderimi önlemek için otomatik tekrar yapılmadı.'
      : 'SMS gönderimi başarısız.';
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function buildHatchSmsMessage({ customer, batch, eggType }: HatchSmsInput) {
  const customerName = [customer.firstName, customer.lastName]
    .filter((name) => name && name !== '-')
    .join(' ');
  const eggTypeName = eggType.name.toLocaleLowerCase('tr-TR');
  const expectedHatchDate = formatDateTR(batch.expectedHatchDate);

  return withSmsSignature(`Sayın ${customerName}, ${batch.eggCount} adet ${eggTypeName} yumurtanızın tahmini çıkım tarihi ${expectedHatchDate}'dır.`);
}

export const smsService = {
  getDeviceSupport(): { status: SmsDeviceSupportStatus; detail: string } {
    if (Platform.OS !== 'android') return { status: 'unsupported', detail: 'SIM üzerinden SMS gönderimi Android telefonda kullanılabilir.' };
    if (!isDirectSimSmsModuleInstalled()) return { status: 'native_unavailable', detail: 'Bu kurulumda SMS bileşeni yüklenemedi. Uygulamayı güncelleyin.' };
    try {
      if (!isDirectSimSmsAvailable()) return { status: 'no_telephony', detail: 'Bu cihazda SIM üzerinden SMS gönderme desteği algılanamadı.' };
      return { status: 'available', detail: 'Bu telefonun SIM üzerinden SMS desteği algılandı.' };
    } catch {
      return { status: 'device_unavailable', detail: 'Telefonun SMS desteği kontrol edilemedi. Uygulamayı yeniden açıp deneyin.' };
    }
  },

  async list(): Promise<SmsLog[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [...demoSmsStore].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const client = supabase;
    const data = await readAllRows<Record<string, any>>((from, to) => client.rpc('list_sms_logs_with_expired_claims')
      .order('created_at', { ascending: false }).order('id').range(from, to));
    return data.map(mapSmsLog);
  },

  async getById(id: string) {
    if (!supabase) return demoSmsStore.find((sms) => sms.id === id) ?? null;
    const { data, error } = await supabase.from('sms_logs').select(smsLogColumns).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapSmsLog(data) : null;
  },

  async createHatchDraft({ customer, batch, eggType }: HatchSmsInput): Promise<HatchSmsDraftResult> {
    if (supabase) {
      const { data, error } = await supabase.rpc('ensure_hatch_sms', { p_batch_id: batch.id });
      if (error) throw error;
      if (!data?.id) return { created: false, reason: 'SMS için geçerli bir kuluçka tarihi ve aktif müşteri gerekir.' };
      emitDataChanged('sms');
      return { created: true, sms: mapSmsLog(data) };
    }
    const phone = customer.phoneNormalized?.trim() || customer.phone?.trim();
    if (!phone) {
      return { created: false, reason: 'Telefon numarası bulunmuyor. SMS taslağı oluşturulmadı.' };
    }

    if (!eggType.name.trim() || !Number.isFinite(batch.eggCount) || batch.eggCount <= 0) {
      return { created: false, reason: 'Yumurta türü veya adedi eksik. SMS taslağı oluşturulmadı.' };
    }

    if (!isValidDateOnly(batch.expectedHatchDate)) {
      const existing = demoSmsStore.find((item) => item.batchId === batch.id);
      if (existing && ['PENDING', 'QUEUED', 'FAILED'].includes(existing.status)) { existing.status = 'PENDING'; existing.needsReview = true; }
      return { created: false, reason: 'Tahmini çıkım tarihi bulunmuyor. SMS taslağı oluşturulmadı.' };
    }

    const message = buildHatchSmsMessage({ customer, batch, eggType });

    if (!isSupabaseConfigured || !supabase) {
      const existing = demoSmsStore.find((sms) => sms.batchId === batch.id);
      if (existing) {
        if (['SENT', 'DELIVERED'].includes(existing.status.toUpperCase())) {
          return { created: false, sms: existing, reason: 'Bu yumurta kabuline ait SMS zaten gönderilmiş; kayıt değiştirilmedi.' };
        }
        existing.customerId = customer.id;
        existing.phone = phone;
        if (!demoCustomMessages.has(existing.id)) existing.message = message;
        if (existing.status === 'QUEUED') existing.status = 'PENDING';
        existing.needsReview = true;
        emitDataChanged('sms');
        return { created: false, sms: existing, reason: 'Mevcut SMS taslağı güncellendi.' };
      }

      const sms: SmsLog = {
        id: `demo-sms-${Date.now()}-${nextDemoSmsId++}`,
        customerId: customer.id,
        batchId: batch.id,
        phone,
        message,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      demoSmsStore.unshift(sms);
      emitDataChanged('sms');
      return { created: true, sms };
    }

    throw new Error('SMS taslağı oluşturulamadı.');
  },

  async syncHatchDraftForBatch(batch: Batch): Promise<HatchSmsDraftResult> {
    const [customer, eggType] = await Promise.all([
      customerService.getById(batch.customerId), eggTypeService.getById(batch.eggTypeId),
    ]);
    if (!customer || !eggType) return { created: false, reason: 'Müşteri veya yumurta türü bulunamadı.' };
    return this.createHatchDraft({ customer, batch, eggType });
  },

  async updateMessage(id: string, message: string) {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      throw new Error('SMS mesajı boş olamaz.');
    }
    const signedMessage = withSmsSignature(normalizedMessage);

    if (!isSupabaseConfigured || !supabase) {
      const sms = demoSmsStore.find((item) => item.id === id);
      if (!sms) throw new Error('SMS kaydı bulunamadı.');
      if (sms.status.toUpperCase() === 'SENT' || sms.status.toUpperCase() === 'DELIVERED') {
        throw new Error('Gönderilmiş SMS düzenlenemez.');
      }
      sms.message = signedMessage;
      demoCustomMessages.add(id);
      if (sms.status === 'QUEUED') sms.status = 'PENDING';
      emitDataChanged('sms');
      return sms;
    }

    const { data, error } = await supabase.rpc('update_sms_message', {
      p_sms_id: id,
      p_message: signedMessage,
    });
    if (error) throw error;
    if (!data) throw new Error('SMS mesajı güncellenemedi.');
    const sms = mapSmsLog(data);
    emitDataChanged('sms');
    return sms;
  },

  async addToOutgoingList(id: string) {
    const sms = (await this.list()).find((item) => item.id === id);
    if (!sms) throw new Error('SMS kaydı bulunamadı.');
    if (sms.status.toUpperCase() === 'SENT' || sms.status.toUpperCase() === 'DELIVERED') {
      throw new Error('Gönderilmiş SMS tekrar gönderilecekler listesine eklenemez.');
    }
    if (sms.status.toUpperCase() === 'QUEUED') {
      return { sms, alreadyQueued: true };
    }
    if (['SENDING', 'UNKNOWN', 'FAILED', 'SENT', 'DELIVERED'].includes(sms.status.toUpperCase())) {
      throw new Error('İşlemdeki, sonucu belirsiz, başarısız veya gönderilmiş SMS otomatik olarak kuyruğa alınamaz.');
    }

    if (!isSupabaseConfigured || !supabase) {
      const demoSms = demoSmsStore.find((item) => item.id === id);
      if (!demoSms) throw new Error('SMS kaydı bulunamadı.');
      demoSms.status = 'QUEUED';
      emitDataChanged('sms');
      return { sms: demoSms, alreadyQueued: false };
    }

    const { data, error } = await supabase.rpc('queue_sms', { p_sms_id: id });
    if (error) throw error;
    const queueResult = Array.isArray(data) ? data[0] : data;
    if (queueResult?.already_queued === true) return { sms, alreadyQueued: true };
    if (queueResult?.queued !== true) throw new Error('SMS kuyruğa eklenemedi.');
    const queuedSms = await this.getById(id);
    if (!queuedSms) throw new Error('SMS kuyruğa eklendi ancak güncel kayıt alınamadı. Listeyi yenileyin.');
    emitDataChanged('sms');
    return { sms: queuedSms, alreadyQueued: false };
  },

  async claimSms(id: string, expectedPhone: string, expectedMessage: string): Promise<SmsClaimResult> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('SMS sahiplenme işlemi için Supabase bağlantısı gereklidir.');
    }
    const identity = await getSmsDeviceIdentity();

    const { data, error } = await supabase.rpc('claim_sms_for_send', {
      p_sms_id: id,
      p_device_id: identity.deviceId,
      p_device_secret: identity.deviceSecret,
      p_expected_phone: expectedPhone,
      p_expected_message: expectedMessage,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const claim = row as {
      claimed?: boolean;
      claim_token?: string | null;
      lease_until?: string | null;
      sms_phone?: string | null;
      sms_message?: string | null;
    } | null;
    return {
      claimed: claim?.claimed === true,
      claimToken: claim?.claim_token ?? null,
      leaseUntil: claim?.lease_until ?? null,
      smsPhone: claim?.sms_phone ?? null,
      smsMessage: claim?.sms_message ?? null,
    };
  },

  async renewSmsClaim(id: string, claimToken: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('SMS sahipliğini yenilemek için Supabase bağlantısı gereklidir.');
    }
    const identity = await getSmsDeviceIdentity();
    const { data, error } = await supabase.rpc('renew_sms_claim', {
      p_sms_id: id,
      p_device_id: identity.deviceId,
      p_device_secret: identity.deviceSecret,
      p_claim_token: claimToken,
    });
    if (error) throw error;
    return data === true;
  },

  async requestSmsPermission(): Promise<SmsPermissionResult> {
    const support = this.getDeviceSupport();
    if (support.status !== 'available') return support.status;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS);
    if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'never_ask_again' : 'denied';
  },

  async sendQueuedSms(id: string, confirmation: SmsSendConfirmation): Promise<SmsAttemptResult> {
    if (!isSupabaseConfigured || !supabase) {
      return { status: 'unavailable', stateSaved: false, detail: 'Gerçek SMS gönderimi için Supabase bağlantısı gereklidir.' };
    }
    const support = this.getDeviceSupport();
    if (support.status !== 'available') {
      return {
        status: 'unavailable',
        stateSaved: false,
        detail: support.detail,
      };
    }

    const sms = await this.getById(id);
    if (!sms || sms.status.toUpperCase() !== 'QUEUED') {
      return { status: 'not_claimed', stateSaved: false, detail: 'Yalnızca gönderilecekler listesindeki SMS gönderilebilir.' };
    }
    if (sms.phone !== confirmation.phone || sms.message !== confirmation.message) {
      return {
        status: 'not_claimed',
        stateSaved: false,
        detail: 'Onay ekranı açıldıktan sonra alıcı veya mesaj değişmiş. Güncel içeriği yeniden kontrol edip onaylayın.',
      };
    }
    const destination = normalizeTurkishPhone(confirmation.phone);
    if (!destination) {
      return { status: 'failed', stateSaved: false, detail: 'Alıcı telefon numarası geçerli bir Türkiye cep telefonu numarası değil; SMS gönderilmedi.' };
    }
    if (!confirmation.message.trim()) {
      return { status: 'failed', stateSaved: false, detail: 'SMS mesajı boş; SMS gönderilmedi.' };
    }

    const permission = await this.requestSmsPermission();
    if (permission !== 'granted') {
      return {
        status: permission === 'denied' || permission === 'never_ask_again' ? 'permission_denied' : 'unavailable',
        stateSaved: false,
        detail: permission === 'never_ask_again'
          ? 'SMS izni kalıcı olarak reddedildi. Android uygulama ayarlarından SMS iznini açın.'
          : permission === 'denied'
            ? 'SMS izni verilmedi; SMS gönderilmedi.'
            : this.getDeviceSupport().detail,
      };
    }

    const claim = await this.claimSms(id, sms.phone, sms.message);
    const claimToken = claim.claimToken;
    if (!claim.claimed || !claimToken) {
      return {
        status: claim.claimed ? 'unknown' : 'not_claimed',
        stateSaved: false,
        detail: claim.claimed
          ? 'SMS claim edildi ancak güvenli claim bilgisi alınamadı. SMS gönderilmedi; claim süresi dolunca sonuç belirsiz olarak işaretlenebilir.'
          : 'Bu SMS başka bir cihaz tarafından sahiplenilmiş, değişmiş veya gönderilebilir durumda değil.',
      };
    }
    if (claim.smsPhone !== sms.phone || claim.smsMessage !== sms.message) {
      let stateSaved = false;
      let saveError = '';
      try {
        stateSaved = await this.markSmsUnknown(
          id,
          claimToken,
          'Claim edilen alıcı veya mesaj onaylanan içerikle eşleşmedi. Native SMS gönderimi başlatılmadı.',
        );
      } catch (error) {
        saveError = errorMessage(error);
      }
      return {
        status: 'unknown',
        stateSaved,
        detail: stateSaved
          ? 'Claim edilen içerik onaylanan içerikle eşleşmedi. SMS gönderilmedi ve kayıt belirsiz olarak işaretlendi; gönderimden önce içeriği yeniden kontrol edin.'
          : `Claim edilen içerik onaylanan içerikle eşleşmedi; SMS gönderilmedi. Supabase durumu kaydedilemedi${saveError ? `: ${saveError}` : ''}. Claim süresi dolunca kayıt belirsiz duruma geçebilir.`,
      };
    }

    let renewing = false;
    let renewalError: string | null = null;
    const renewal = setInterval(() => {
      if (renewing || renewalError) return;
      renewing = true;
      void this.renewSmsClaim(id, claimToken)
        .then((renewed) => {
          if (!renewed) {
            renewalError = 'SMS claim yenilenemedi; gönderim sonucu claim süresi dolmuş olabilir.';
            clearInterval(renewal);
          }
        })
        .catch((error: unknown) => {
          renewalError = `SMS claim yenileme hatası: ${errorMessage(error)}`;
          clearInterval(renewal);
        })
        .finally(() => { renewing = false; });
    }, 35_000);

    let result: NativeSmsResult;
    let nativeError: string | null = null;
    try {
      result = await sendDirectSimSms(destination, sms.message);
    } catch (error: unknown) {
      nativeError = errorMessage(error);
      result = { status: 'unknown', code: 'send_result_unavailable' };
    } finally {
      clearInterval(renewal);
    }

    const expectedSavedStatus = result.status === 'sent'
      ? 'SENT'
      : result.status === 'failed'
        ? 'FAILED'
        : 'UNKNOWN';
    let savedStatus: string | null = null;
    let recordError = '';
    try {
      if (result.status === 'sent') {
        if (await this.markSmsSent(id, claimToken, result.code)) savedStatus = 'SENT';
      } else if (result.status === 'failed') {
        if (await this.markSmsFailed(id, claimToken, nativeResultMessage(result))) savedStatus = 'FAILED';
      } else {
        if (await this.markSmsUnknown(id, claimToken, nativeResultMessage(result))) savedStatus = 'UNKNOWN';
      }
      if (!savedStatus) recordError = 'Supabase sonuç RPC claim’i kabul etmedi.';
    } catch (error: unknown) {
      recordError = errorMessage(error);
    }

    if (!savedStatus) {
      try {
        const current = await this.getById(id);
        if (current?.status.toUpperCase() === expectedSavedStatus) savedStatus = expectedSavedStatus;
      } catch (error: unknown) {
        recordError = [recordError, `Supabase sonucu okunamadı: ${errorMessage(error)}`].filter(Boolean).join(' ');
      }
    }

    if (!savedStatus) {
      try {
        const markedUnknown = await this.markSmsUnknown(
          id,
          claimToken,
          `SMS native gönderim sonucu güvenilir biçimde kaydedilemedi. ${recordError || 'Claim geçersiz veya süresi dolmuş olabilir.'} Otomatik tekrar gönderilmedi.`,
        );
        if (markedUnknown) savedStatus = 'UNKNOWN';
      } catch (error: unknown) {
        recordError = [recordError, `Belirsiz sonuç kaydı da başarısız: ${errorMessage(error)}`].filter(Boolean).join(' ');
      }
    }

    if (!savedStatus) {
      try {
        const current = await this.getById(id);
        const currentStatus = current?.status.toUpperCase();
        if (currentStatus === expectedSavedStatus || currentStatus === 'UNKNOWN') savedStatus = currentStatus;
      } catch (error: unknown) {
        recordError = [recordError, `Son kayıt durumu doğrulanamadı: ${errorMessage(error)}`].filter(Boolean).join(' ');
      }
    }

    emitDataChanged('sms');
    const stateSaved = savedStatus !== null;
    const status = savedStatus === 'SENT'
      ? 'sent'
      : savedStatus === 'FAILED'
        ? 'failed'
        : 'unknown';
    const detail = !stateSaved
      ? `SMS sonucu Supabase’e kaydedilemedi. Otomatik tekrar yapılmadı; çift gönderim riskini önlemek için SMS durumunu kontrol edin.${recordError ? ` Hata: ${recordError}` : ''}`
      : savedStatus !== expectedSavedStatus
        ? `Gönderim sonucu belirsiz olarak kaydedildi; otomatik tekrar yapılmadı.${nativeError ? ` Native modül: ${nativeError}` : ''}`
        : `${nativeResultMessage(result)}${nativeError ? ` Native modül hatası: ${nativeError}` : ''}`;
    return {
      status,
      stateSaved,
      detail: renewalError ? `${detail} ${renewalError}` : detail,
    };
  },

  async markSmsUnknown(id: string, claimToken: string, detail: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('SMS sonucunu kaydetmek için Supabase bağlantısı gereklidir.');
    }
    const identity = await getSmsDeviceIdentity();
    const { data, error } = await supabase.rpc('mark_sms_unknown', {
      p_sms_id: id,
      p_device_id: identity.deviceId,
      p_device_secret: identity.deviceSecret,
      p_claim_token: claimToken,
      p_detail: detail,
    });
    if (error) throw error;
    return data === true;
  },

  async resolveSmsUncertain(id: string, resolution: 'sent' | 'retry'): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('SMS durumunu uzlaştırmak için Supabase bağlantısı gereklidir.');
    }
    const { data, error } = await supabase.rpc('resolve_sms_uncertain', {
      p_sms_id: id,
      p_resolution: resolution,
    });
    if (error) throw error;
    if (data === true) emitDataChanged('sms');
    return data === true;
  },

  async releaseSmsClaim(id: string, claimToken: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('SMS sahipliğini bırakmak için Supabase bağlantısı gereklidir.');
    }
    const identity = await getSmsDeviceIdentity();

    const { data, error } = await supabase.rpc('release_sms_claim', {
      p_sms_id: id,
      p_device_id: identity.deviceId,
      p_device_secret: identity.deviceSecret,
      p_claim_token: claimToken,
    });
    if (error) throw error;
    return data === true;
  },

  async markSmsSent(id: string, claimToken: string, providerResponse: string | null = null): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('SMS durumunu güncellemek için Supabase bağlantısı gereklidir.');
    }
    const identity = await getSmsDeviceIdentity();

    const { data, error } = await supabase.rpc('mark_sms_sent', {
      p_sms_id: id,
      p_device_id: identity.deviceId,
      p_device_secret: identity.deviceSecret,
      p_claim_token: claimToken,
      p_provider_response: providerResponse,
    });
    if (error) throw error;
    if (data === true) emitDataChanged('sms');
    return data === true;
  },

  async markSmsFailed(id: string, claimToken: string, errorMessage: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('SMS durumunu güncellemek için Supabase bağlantısı gereklidir.');
    }
    const identity = await getSmsDeviceIdentity();

    const { data, error } = await supabase.rpc('mark_sms_failed', {
      p_sms_id: id,
      p_device_id: identity.deviceId,
      p_device_secret: identity.deviceSecret,
      p_claim_token: claimToken,
      p_error: errorMessage,
    });
    if (error) throw error;
    if (data === true) emitDataChanged('sms');
    return data === true;
  },
};
