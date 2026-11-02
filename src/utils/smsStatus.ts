import type { SmsLog } from '../types/models';

export function smsStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Taslak', QUEUED: 'Gönderilecekler listesinde',
    SENDING: 'Gönderiliyor', SENT: 'Gönderildi', DELIVERED: 'Teslim edildi',
    FAILED: 'Gönderim başarısız', UNKNOWN: 'Gönderim sonucu belirsiz',
  };
  return labels[status.toUpperCase()] ?? 'Kontrol edilmeli';
}

export function groupSmsLogs(logs: SmsLog[]) {
  const groups: { pending: SmsLog[]; queued: SmsLog[]; sent: SmsLog[] } = { pending: [], queued: [], sent: [] };
  for (const sms of logs) {
    const status = sms.status.toUpperCase();
    if (status === 'SENT' || status === 'DELIVERED') groups.sent.push(sms);
    else if (status === 'QUEUED' || status === 'SENDING') groups.queued.push(sms);
    else groups.pending.push(sms);
  }
  return groups;
}
