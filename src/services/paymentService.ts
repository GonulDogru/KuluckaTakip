import { runPendingOperation } from './pendingOperation';
import { readAllRows } from './readAllRows';
import { cacheReads } from './queryCache';
import { demoPayments } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Payment } from '../types/models';
import { mapPayment } from './mappers';
import { emitDataChanged } from './dataEvents';

const demoPaymentStore: Payment[] = [...demoPayments];

type CreatePaymentInput = Omit<Payment, 'id' | 'createdAt'>;

export type PaymentWriteInput = CreatePaymentInput & { id?: string; expectedUpdatedAt?: string; void?: boolean; reason?: string };

export const paymentService = {
  removeDemoByBatch(batchId: string) {
    for (let i = demoPaymentStore.length - 1; i >= 0; i--) {
      if (demoPaymentStore[i].batchId === batchId) demoPaymentStore.splice(i, 1);
    }
  },

  async list() {
    if (!isSupabaseConfigured || !supabase) {
      return [...demoPaymentStore];
    }

    const client = supabase;
    const data = await readAllRows((from, to) => client.from('payments').select('*')
      .order('payment_date', { ascending: false }).order('id').range(from, to));
    return data.map(mapPayment);
  },

  async listByBatch(batchId: string) {
    if (!supabase) return demoPaymentStore.filter((payment) => payment.batchId === batchId);
    const client = supabase;
    const data = await readAllRows((from, to) => client.from('payments').select('*')
      .eq('batch_id', batchId).order('payment_date', { ascending: false }).order('id').range(from, to));
    return data.map(mapPayment);
  },

  async listByCustomer(customerId: string) {
    if (!supabase) return demoPaymentStore.filter((payment) => payment.customerId === customerId);
    const client = supabase;
    const data = await readAllRows((from, to) => client.from('payments').select('*')
      .eq('customer_id', customerId).order('payment_date', { ascending: false }).order('id').range(from, to));
    return data.map(mapPayment);
  },

  async getById(id: string) {
    if (!supabase) return demoPaymentStore.find((payment) => payment.id === id) ?? null;
    const { data, error } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapPayment(data) : null;
  },

  async create(input: CreatePaymentInput) {
    if (!isSupabaseConfigured || !supabase) {
      const payment: Payment = {
        ...input,
        id: `demo-payment-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      demoPaymentStore.unshift(payment);
      emitDataChanged('payment');
      return payment;
    }

    return this.save(input);
  },

  async save(input: PaymentWriteInput): Promise<Payment> {
    if (!supabase) {
      if (!input.id) return this.create(input);
      const index = demoPaymentStore.findIndex((p) => p.id === input.id);
      if (index < 0) throw new Error('Ödeme bulunamadı.');
      demoPaymentStore[index] = { ...demoPaymentStore[index], ...input,
        voidedAt: input.void ? new Date().toISOString() : null, voidReason: input.reason };
      emitDataChanged('payment');
      return demoPaymentStore[index];
    }
    const client = supabase;
    const payment = await runPendingOperation(`payment:${input.batchId}`, input, async (id, payload) => {
      const { data, error } = await client.rpc('save_payment', { p_request_id: id, p_input: payload });
      if (error) throw error;
      if (!data?.id) throw new Error('Ödeme sonucu doğrulanamadı. Aynı işlemi yeniden deneyin.');
      return mapPayment(data);
    });
    emitDataChanged('payment');
    return payment;
  },

  calculatePaidTotal(payments: Payment[]) {
    return payments.reduce((sum, payment) => sum + (payment.voidedAt ? 0 : payment.amount), 0);
  },

  calculateRemainingDebt(totalPrice: number, payments: Payment[]) {
    return totalPrice - this.calculatePaidTotal(payments);
  },
};

cacheReads(paymentService, 'payment', ['list', 'getById', 'listByBatch', 'listByCustomer']);
