import { readAllRows } from './readAllRows';
import { cacheReads } from './queryCache';
import { demoPayments } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Payment } from '../types/models';
import { mapPayment } from './mappers';
import { emitDataChanged } from './dataEvents';

const demoPaymentStore: Payment[] = [...demoPayments];

type CreatePaymentInput = Omit<Payment, 'id' | 'createdAt'>;

// model (camelCase) -> DB kolonları (snake_case) eşlemesi. Yalnızca dolu alanlar gönderilir.
function toPaymentRow(input: Partial<CreatePaymentInput>) {
  const row: Record<string, unknown> = {};
  if (input.customerId !== undefined) row.customer_id = input.customerId;
  if (input.batchId !== undefined) row.batch_id = input.batchId;
  if (input.amount !== undefined) row.amount = input.amount;
  if (input.paymentMethod !== undefined) row.payment_method = input.paymentMethod;
  if (input.paymentDate !== undefined) row.payment_date = input.paymentDate;
  if (input.note !== undefined) row.note = input.note;
  return row;
}

export const paymentService = {
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

    const { data, error } = await supabase
      .from('payments')
      .insert({
        customer_id: input.customerId,
        batch_id: input.batchId,
        amount: input.amount,
        payment_method: input.paymentMethod,
        payment_date: input.paymentDate,
        note: input.note,
      })
      .select('*')
      .single();
    if (error) throw error;
    const payment = mapPayment(data);
    emitDataChanged('payment');
    return payment;
  },

  async update(id: string, input: Partial<CreatePaymentInput>) {
    if (!isSupabaseConfigured || !supabase) {
      const index = demoPaymentStore.findIndex((payment) => payment.id === id);
      if (index < 0) return null;
      demoPaymentStore[index] = { ...demoPaymentStore[index], ...input };
      emitDataChanged('payment');
      return demoPaymentStore[index];
    }

    const { data, error } = await supabase.from('payments').update(toPaymentRow(input)).eq('id', id).select('*').single();
    if (error) throw error;
    const payment = mapPayment(data);
    emitDataChanged('payment');
    return payment;
  },

  calculatePaidTotal(payments: Payment[]) {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  },

  calculateRemainingDebt(totalPrice: number, payments: Payment[]) {
    return totalPrice - this.calculatePaidTotal(payments);
  },
};

cacheReads(paymentService, 'payment', ['list', 'getById', 'listByBatch', 'listByCustomer']);
