import type { Batch, Customer, EggType } from '../types/models';

export type BatchFilters = { query: string; customerId: string; status: string; eggTypeId: string; debtOnly: boolean };

export const batchStatusLabels: Record<Batch['status'], string> = {
  RECEIVED: 'Kabul edildi', INCUBATING: 'Kuluçkada', TRANSFER_DUE: 'Aktarım bekliyor',
  HATCHING: 'Çıkımda', HATCHED: 'Çıkım tamamlandı', DELIVERED: 'Teslim edildi', CANCELLED: 'İptal edildi',
};

export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim();
}

export function filterBatches(batches: Batch[], customers: Map<string, Customer>, eggTypes: Map<string, EggType>, paid: Map<string, number>, filters: BatchFilters): Batch[] {
  const term = normalizeSearch(filters.query);
  const phoneDigits = /^[+\d\s().-]+$/.test(term) ? term.replace(/\D/g, '') : '';
  return batches.filter((batch) => {
    if (filters.customerId && batch.customerId !== filters.customerId) return false;
    if (filters.status && batch.status !== filters.status) return false;
    if (filters.eggTypeId && batch.eggTypeId !== filters.eggTypeId) return false;
    if (filters.debtOnly && Math.round((batch.totalPrice - (paid.get(batch.id) ?? 0)) * 100) <= 0) return false;
    if (!term) return true;
    const customer = customers.get(batch.customerId);
    const text = normalizeSearch([batch.batchNo, customer?.firstName, customer?.lastName, customer?.phone, customer?.phoneNormalized, eggTypes.get(batch.eggTypeId)?.name].join(' '));
    return text.includes(term) || Boolean(phoneDigits && customer && [customer.phone, customer.phoneNormalized].some((phone) => phone.replace(/\D/g, '').includes(phoneDigits)));
  });
}
