import { supabase } from '../lib/supabase';
import { batchService } from './batchService';
import { customerService } from './customerService';
import { eggTypeService } from './eggTypeService';
import { paymentService } from './paymentService';
import { smsService } from './smsService';
import { mapBatch } from './mappers';
import { emitDataChanged } from './dataEvents';
import { runPendingOperation } from './pendingOperation';
import { parseMoneyInput } from '../utils/money';

export type AcceptanceInput = {
  customerName: string; phone: string; eggTypeId: string; breed?: string;
  eggCount: string; receivedDate: string; incubationDate?: string;
  unitPrice: string; paidAmount: string; note?: string;
};

export const acceptanceService = {
  async create(input: AcceptanceInput) {
    const unitPrice = parseMoneyInput(input.unitPrice);
    const paid = parseMoneyInput(input.paidAmount) ?? 0;
    if (unitPrice === null || paid > Number(input.eggCount) * unitPrice) throw new Error('Ödeme toplam tutarı aşamaz.');
    if (supabase) {
      const client = supabase;
      const batch = await runPendingOperation('acceptance', input, async (id, payload) => {
        const { data, error } = await client.rpc('save_acceptance', { p_request_id: id, p_input: payload });
        if (error) throw error;
        if (!data?.id) throw new Error('Kabul sonucu doğrulanamadı. Aynı işlemi yeniden deneyin.');
        return mapBatch(data);
      });
      emitDataChanged('batch');
      emitDataChanged('payment');
      emitDataChanged('customer');
      emitDataChanged('sms');
      return batch;
    }
    let customer = await customerService.findByPhone(input.phone);
    if (customer && !customer.isActive) throw new Error('Önce müşteriyi arşivden çıkarın.');
    const [firstName, ...rest] = input.customerName.trim().split(/\s+/);
    customer ??= await customerService.create({ firstName, lastName: rest.join(' ') || '-', phone: input.phone });
    const breedId = input.breed?.trim() ? await eggTypeService.ensureBreed(input.eggTypeId, input.breed) : null;
    const batch = await batchService.create({ customerId: customer.id, eggTypeId: input.eggTypeId, breedId,
      eggCount: Number(input.eggCount), receivedDate: input.receivedDate, incubationDate: input.incubationDate || null,
      unitPrice, note: input.note });
    if (paid > 0) await paymentService.create({ customerId: customer.id, batchId: batch.id, amount: paid,
      paymentDate: input.receivedDate, paymentMethod: 'Nakit', note: 'Yumurta kabul ödemesi' });
    const eggType = await eggTypeService.getById(input.eggTypeId);
    if (eggType) await smsService.createHatchDraft({ customer, batch, eggType });
    return batch;
  },
};
