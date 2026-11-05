import { readAllRows } from './readAllRows';
import { cacheReads } from './queryCache';
import { demoBatches } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Batch, BatchStatus } from '../types/models';
import { calculateBatchDates } from '../utils/dateRules';
import { eggTypeService } from './eggTypeService';
import { mapBatch } from './mappers';
import { emitDataChanged } from './dataEvents';
import { smsService } from './smsService';

const demoBatchStore: Batch[] = [...demoBatches];

type CreateBatchInput = {
  customerId: string;
  eggTypeId: string;
  breedId?: string | null;
  eggCount: number;
  receivedDate: string;
  incubationDate?: string | null;
  unitPrice: number;
  status?: BatchStatus;
  note?: string | null;
};

function nextDemoBatchNo() {
  return `P-2026-${String(demoBatchStore.length + 1).padStart(4, '0')}`;
}

// model (camelCase) -> DB kolonları (snake_case) eşlemesi. Yalnızca dolu alanlar gönderilir.
// total_price gönderilmez; hesaplamayı batches_calculate_dates trigger'ı yapar.
function toBatchRow(input: Partial<CreateBatchInput>) {
  const row: Record<string, unknown> = {};
  if (input.customerId !== undefined) row.customer_id = input.customerId;
  if (input.eggTypeId !== undefined) row.egg_type_id = input.eggTypeId;
  if (input.breedId !== undefined) row.breed_id = input.breedId;
  if (input.eggCount !== undefined) row.egg_count = input.eggCount;
  if (input.receivedDate !== undefined) row.received_date = input.receivedDate;
  if (input.incubationDate !== undefined) row.incubation_date = input.incubationDate;
  if (input.unitPrice !== undefined) row.unit_price = input.unitPrice;
  if (input.status !== undefined) row.status = input.status;
  if (input.note !== undefined) row.note = input.note;
  return row;
}

export const batchService = {
  async list() {
    if (!isSupabaseConfigured || !supabase) {
      return [...demoBatchStore];
    }

    const client = supabase;
    const data = await readAllRows((from, to) => client.from('batches').select('*')
      .order('created_at', { ascending: false }).order('id').range(from, to));
    return data.map(mapBatch);
  },

  async getById(id: string) {
    if (!isSupabaseConfigured || !supabase) {
      return demoBatchStore.find((batch) => batch.id === id) ?? null;
    }

    const { data, error } = await supabase.from('batches').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapBatch(data) : null;
  },

  async listByCustomer(customerId: string) {
    if (!supabase) return demoBatchStore.filter((batch) => batch.customerId === customerId);
    const client = supabase;
    const data = await readAllRows((from, to) => client.from('batches').select('*')
      .eq('customer_id', customerId).order('created_at', { ascending: false }).order('id').range(from, to));
    return data.map(mapBatch);
  },

  async create(input: CreateBatchInput) {
    const eggType = await eggTypeService.getById(input.eggTypeId);
    const calculated = input.incubationDate && eggType
      ? calculateBatchDates(input.incubationDate, {
          incubationDays: eggType.incubationDays,
          transferDay: eggType.transferDay,
        })
      : { transferDate: null, expectedHatchDate: null };
    const totalPrice = input.eggCount * input.unitPrice;

    if (!isSupabaseConfigured || !supabase) {
      const now = new Date().toISOString();
      const batch: Batch = {
        id: `demo-batch-${Date.now()}`,
        batchNo: nextDemoBatchNo(),
        customerId: input.customerId,
        eggTypeId: input.eggTypeId,
        breedId: input.breedId ?? null,
        eggCount: input.eggCount,
        receivedDate: input.receivedDate,
        incubationDate: input.incubationDate ?? null,
        transferDate: calculated.transferDate,
        expectedHatchDate: calculated.expectedHatchDate,
        unitPrice: input.unitPrice,
        totalPrice,
        status: input.status ?? (input.incubationDate ? 'INCUBATING' : 'RECEIVED'),
        note: input.note ?? null,
        createdAt: now,
        updatedAt: now,
      };
      demoBatchStore.unshift(batch);
      emitDataChanged('batch');
      return batch;
    }

    const { data, error } = await supabase
      .from('batches')
      .insert({
        batch_no: '',
        customer_id: input.customerId,
        egg_type_id: input.eggTypeId,
        breed_id: input.breedId,
        egg_count: input.eggCount,
        received_date: input.receivedDate,
        incubation_date: input.incubationDate,
        unit_price: input.unitPrice,
        total_price: totalPrice,
        status: input.status ?? (input.incubationDate ? 'INCUBATING' : 'RECEIVED'),
        note: input.note,
      })
      .select('*')
      .single();
    if (error) throw error;
    const batch = mapBatch(data);
    emitDataChanged('batch');
    return batch;
  },

  async update(id: string, input: Partial<CreateBatchInput>) {
    const syncSms = input.customerId !== undefined || input.eggTypeId !== undefined
      || input.eggCount !== undefined || input.incubationDate !== undefined;

    if (!isSupabaseConfigured || !supabase) {
      const index = demoBatchStore.findIndex((batch) => batch.id === id);
      if (index < 0) return null;
      const currentBatch = demoBatchStore[index];
      const eggTypeId = input.eggTypeId ?? currentBatch.eggTypeId;
      const incubationDate = input.incubationDate !== undefined ? input.incubationDate : currentBatch.incubationDate;
      const eggType = await eggTypeService.getById(eggTypeId);
      const calculated = incubationDate && eggType
        ? calculateBatchDates(incubationDate, {
            incubationDays: eggType.incubationDays,
            transferDay: eggType.transferDay,
          })
        : { transferDate: null, expectedHatchDate: null };
      demoBatchStore[index] = {
        ...currentBatch,
        ...input,
        status: (['RECEIVED', 'INCUBATING'].includes(currentBatch.status) || (currentBatch.status === 'TRANSFER_DUE' && incubationDate !== currentBatch.incubationDate))
          ? (incubationDate ? 'INCUBATING' : 'RECEIVED') : currentBatch.status,
        breedId: input.breedId !== undefined ? input.breedId : eggTypeId !== currentBatch.eggTypeId ? null : currentBatch.breedId,
        eggTypeId,
        incubationDate,
        transferDate: calculated.transferDate,
        expectedHatchDate: calculated.expectedHatchDate,
        totalPrice: (input.eggCount ?? demoBatchStore[index].eggCount) * (input.unitPrice ?? demoBatchStore[index].unitPrice),
        updatedAt: new Date().toISOString(),
      };
      emitDataChanged('batch');
      const changedSms = syncSms && (currentBatch.customerId !== input.customerId && input.customerId !== undefined
        || currentBatch.eggTypeId !== eggTypeId || currentBatch.eggCount !== demoBatchStore[index].eggCount
        || currentBatch.incubationDate !== incubationDate);
      if (changedSms) {
        try {
          await smsService.syncHatchDraftForBatch(demoBatchStore[index]);
        } catch (error) {
          throw new Error(`Yumurta kabulü güncellendi ancak SMS taslağı eşitlenemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata.'}`);
        }
      }
      return demoBatchStore[index];
    }

    const { data, error } = await supabase
      .from('batches')
      .update(toBatchRow(input))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const batch = mapBatch(data);
    emitDataChanged('batch');
    // Dates, state, breed and unsent SMS are synchronized atomically by database triggers.
    return batch;
  },
};

cacheReads(batchService, 'batch', ['list', 'getById', 'listByCustomer']);
