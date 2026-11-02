import { cacheReads } from './queryCache';
import { batchService } from './batchService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { customerService } from './customerService';
import { paymentService } from './paymentService';

export type DashboardSummary = {
  customers: number;
  batches: number;
  eggs: number;
  debt: number;
};

function toDashboardSummary(row: Record<string, unknown>): DashboardSummary {
  const summary = {
    customers: Number(row.customer_count),
    batches: Number(row.batch_count),
    eggs: Number(row.egg_count),
    debt: Number(row.total_debt),
  };
  if (Object.values(summary).some((value) => !Number.isFinite(value))) {
    throw new Error('Ana sayfa özeti geçersiz biçimde döndü.');
  }
  return summary;
}

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('get_dashboard_summary');
      if (error) throw error;
      const row = data?.[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error('Ana sayfa özeti alınamadı.');
      return toDashboardSummary(row);
    }

    const [customers, batches, payments] = await Promise.all([
      customerService.list(),
      batchService.list(),
      paymentService.list(),
    ]);
    const paidByBatch = new Map<string, number>();
    for (const payment of payments) {
      paidByBatch.set(payment.batchId, (paidByBatch.get(payment.batchId) ?? 0) + payment.amount);
    }
    return {
      customers: customers.length,
      batches: batches.length,
      eggs: batches.reduce((total, batch) => total + batch.eggCount, 0),
      debt: batches.reduce((total, batch) => total + batch.totalPrice - (paidByBatch.get(batch.id) ?? 0), 0),
    };
  },

};

cacheReads(dashboardService, 'dashboard', ['getSummary']);
