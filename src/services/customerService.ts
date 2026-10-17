import { demoCustomers } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Batch, Customer, CustomerSummary, Payment } from '../types/models';
import { normalizeTurkishPhone } from '../utils/phone';
import { batchService } from './batchService';
import { mapCustomer } from './mappers';
import { paymentService } from './paymentService';
import { emitDataChanged } from './dataEvents';

const demoCustomerStore: Customer[] = [...demoCustomers];

type CreateCustomerInput = {
  firstName: string;
  lastName: string;
  phone: string;
  note?: string | null;
};

export const customerService = {
  async list(options: { includeArchived?: boolean } = {}) {
    if (!isSupabaseConfigured || !supabase) {
      return demoCustomerStore.filter((customer) => options.includeArchived || customer.isActive);
    }

    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!options.includeArchived) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapCustomer);
  },

  async listWithSummary(): Promise<CustomerSummary[]> {
    let customers: Customer[];
    let batches: Array<Pick<Batch, 'customerId' | 'totalPrice' | 'status'>>;
    let payments: Array<Pick<Payment, 'customerId' | 'amount'>>;

    if (!isSupabaseConfigured || !supabase) {
      [customers, batches, payments] = await Promise.all([
        this.list(),
        batchService.list(),
        paymentService.list(),
      ]);
    } else {
      const [customerResult, batchResult, paymentResult] = await Promise.all([
        this.list(),
        supabase.from('batches').select('customer_id,total_price,status'),
        supabase.from('payments').select('customer_id,amount'),
      ]);
      if (batchResult.error) throw batchResult.error;
      if (paymentResult.error) throw paymentResult.error;
      customers = customerResult;
      batches = (batchResult.data ?? []).map((batch) => ({
        customerId: batch.customer_id,
        totalPrice: Number(batch.total_price),
        status: batch.status,
      }));
      payments = (paymentResult.data ?? []).map((payment) => ({
        customerId: payment.customer_id,
        amount: Number(payment.amount),
      }));
    }

    const batchTotalsByCustomer = new Map<string, { totalPrice: number; activeBatchCount: number }>();
    for (const batch of batches) {
      const totals = batchTotalsByCustomer.get(batch.customerId) ?? { totalPrice: 0, activeBatchCount: 0 };
      totals.totalPrice += batch.totalPrice;
      if (!['DELIVERED', 'CANCELLED'].includes(batch.status)) totals.activeBatchCount += 1;
      batchTotalsByCustomer.set(batch.customerId, totals);
    }

    const paidByCustomer = new Map<string, number>();
    for (const payment of payments) {
      paidByCustomer.set(payment.customerId, (paidByCustomer.get(payment.customerId) ?? 0) + payment.amount);
    }

    return customers.map((customer) => {
      const batchTotals = batchTotalsByCustomer.get(customer.id);
      const totalPrice = batchTotals?.totalPrice ?? 0;
      const paidTotal = paidByCustomer.get(customer.id) ?? 0;

      return {
        ...customer,
        activeBatchCount: batchTotals?.activeBatchCount ?? 0,
        totalDebt: totalPrice - paidTotal,
      };
    });
  },

  async getById(id: string) {
    if (!isSupabaseConfigured || !supabase) {
      return demoCustomerStore.find((customer) => customer.id === id) ?? null;
    }

    const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapCustomer(data) : null;
  },

  async findByPhone(phone: string) {
    const phoneNormalized = normalizeTurkishPhone(phone);
    if (!phoneNormalized) return null;

    if (!isSupabaseConfigured || !supabase) {
      return demoCustomerStore.find((customer) => customer.phoneNormalized === phoneNormalized) ?? null;
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone_normalized', phoneNormalized)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCustomer(data) : null;
  },

  async create(input: CreateCustomerInput) {
    const phoneNormalized = normalizeTurkishPhone(input.phone);
    if (!phoneNormalized) {
      throw new Error('Telefon numarası geçerli değil.');
    }

    const existing = await this.findByPhone(input.phone);
    if (existing) {
      throw new Error('Bu telefon numarasıyla kayıtlı müşteri bulunmaktadır.');
    }

    if (!isSupabaseConfigured || !supabase) {
      const now = new Date().toISOString();
      const customer: Customer = {
        id: `demo-customer-${Date.now()}`,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone.trim(),
        phoneNormalized,
        note: input.note?.trim() || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      demoCustomerStore.unshift(customer);
      emitDataChanged('customer');
      return customer;
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone.trim(),
        phone_normalized: phoneNormalized,
        note: input.note?.trim() || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    const customer = mapCustomer(data);
    emitDataChanged('customer');
    return customer;
  },

  async update(id: string, input: Partial<CreateCustomerInput>) {
    const phoneNormalized = input.phone ? normalizeTurkishPhone(input.phone) : undefined;
    if (input.phone && !phoneNormalized) {
      throw new Error('Telefon numarası geçerli değil.');
    }

    if (!isSupabaseConfigured || !supabase) {
      const index = demoCustomerStore.findIndex((customer) => customer.id === id);
      if (index < 0) return null;
      demoCustomerStore[index] = {
        ...demoCustomerStore[index],
        ...input,
        phoneNormalized: phoneNormalized ?? demoCustomerStore[index].phoneNormalized,
        updatedAt: new Date().toISOString(),
      };
      emitDataChanged('customer');
      return demoCustomerStore[index];
    }

    const { data, error } = await supabase
      .from('customers')
      .update({
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
        phone_normalized: phoneNormalized,
        note: input.note,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const customer = mapCustomer(data);
    emitDataChanged('customer');
    return customer;
  },

  async archive(id: string) {
    if (!isSupabaseConfigured || !supabase) {
      const customer = demoCustomerStore.find((item) => item.id === id);
      if (!customer) throw new Error('Müşteri kaydı bulunamadı.');
      customer.isActive = false;
      customer.updatedAt = new Date().toISOString();
      emitDataChanged('customer');
      return customer;
    }

    const { data, error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const customer = mapCustomer(data);
    emitDataChanged('customer');
    return customer;
  },
};
