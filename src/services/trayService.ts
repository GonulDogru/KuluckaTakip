import { DEFAULT_TRAY_CAPACITY, demoRackTrays, demoTrayAllocations } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Rack, RackTray, TrayAllocation, TrayWithUsage } from '../types/models';
import { emitDataChanged } from './dataEvents';
import { batchService } from './batchService';

const trayStore: RackTray[] = [...demoRackTrays];
const allocationStore: TrayAllocation[] = [...demoTrayAllocations];

type AllocationInput = {
  trayId: string;
  batchId: string;
  eggCount: number;
};

function mapTray(row: Record<string, any>): RackTray {
  return {
    id: row.id,
    rackId: row.rack_id,
    trayNumber: Number(row.tray_number),
    capacity: Number(row.capacity),
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

function mapAllocation(row: Record<string, any>): TrayAllocation {
  return {
    id: row.id,
    trayId: row.tray_id,
    batchId: row.batch_id,
    eggCount: Number(row.egg_count),
    createdAt: row.created_at,
  };
}

function withUsage(trays: RackTray[], allocations: TrayAllocation[]): TrayWithUsage[] {
  return trays.map((tray) => {
    const trayAllocations = allocations.filter((allocation) => allocation.trayId === tray.id);
    const used = trayAllocations.reduce((sum, allocation) => sum + allocation.eggCount, 0);
    return { ...tray, allocations: trayAllocations, used, empty: tray.capacity - used };
  });
}

export const trayService = {
  async ensureRackTrays(rack: Rack) {
    const existing = trayStore.filter((tray) => tray.rackId === rack.id);
    if (existing.length || isSupabaseConfigured) return existing;

    const now = new Date().toISOString();
    const created = Array.from({ length: rack.trayCount }, (_, index) => ({
      id: `${rack.id}-tray-${index + 1}`,
      rackId: rack.id,
      trayNumber: index + 1,
      capacity: rack.trayCapacity || DEFAULT_TRAY_CAPACITY,
      active: true,
      createdAt: now,
    }));
    trayStore.push(...created);
    return created;
  },

  async listTrays(rackId?: string) {
    if (!isSupabaseConfigured || !supabase) {
      return trayStore.filter((tray) => !rackId || tray.rackId === rackId);
    }

    let query = supabase.from('rack_trays').select('*').order('tray_number');
    if (rackId) query = query.eq('rack_id', rackId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapTray);
  },

  async listAllocations() {
    if (!isSupabaseConfigured || !supabase) return [...allocationStore];
    const { data, error } = await supabase.from('tray_allocations').select('*').order('created_at');
    if (error) throw error;
    return (data ?? []).map(mapAllocation);
  },

  async listByRack(rack: Rack) {
    await this.ensureRackTrays(rack);
    const [trays, allocations] = await Promise.all([this.listTrays(rack.id), this.listAllocations()]);
    const trayIds = new Set(trays.map((tray) => tray.id));
    return withUsage(trays, allocations.filter((allocation) => trayIds.has(allocation.trayId)));
  },

  async listAllocationsByBatch(batchId: string) {
    const [trays, allocations] = await Promise.all([this.listTrays(), this.listAllocations()]);
    const trayMap = new Map(trays.map((tray) => [tray.id, tray]));
    return allocations
      .filter((allocation) => allocation.batchId === batchId)
      .map((allocation) => ({ ...allocation, tray: trayMap.get(allocation.trayId) }))
      .filter((item) => item.tray);
  },

  async getBatchPlacedCount(batchId: string) {
    const allocations = await this.listAllocations();
    return allocations.filter((allocation) => allocation.batchId === batchId).reduce((sum, allocation) => sum + allocation.eggCount, 0);
  },

  suggestAllocation(trays: TrayWithUsage[], remainingEggs: number) {
    let remaining = remainingEggs;
    const suggestions: AllocationInput[] = [];
    const candidates = [...trays]
      .filter((tray) => tray.empty > 0)
      .sort((a, b) => {
        const aPartial = a.used > 0 ? 0 : 1;
        const bPartial = b.used > 0 ? 0 : 1;
        return aPartial - bPartial || a.trayNumber - b.trayNumber;
      });

    for (const tray of candidates) {
      if (remaining <= 0) break;
      const eggCount = Math.min(tray.empty, remaining);
      suggestions.push({ trayId: tray.id, batchId: '', eggCount });
      remaining -= eggCount;
    }

    return suggestions;
  },

  async placeAllocations(input: { batchId: string; allocations: Array<Omit<AllocationInput, 'batchId'>> }) {
    const batch = await batchService.getById(input.batchId);
    if (!batch) throw new Error('Parti bulunamadı.');

    const cleaned = input.allocations
      .map((allocation) => ({ ...allocation, eggCount: Number(allocation.eggCount) }))
      .filter((allocation) => allocation.eggCount > 0);
    if (!cleaned.length) throw new Error('Yerleştirilecek yumurta adedi girin.');

    const [trays, existingAllocations] = await Promise.all([this.listTrays(), this.listAllocations()]);
    const trayMap = new Map(trays.map((tray) => [tray.id, tray]));
    const alreadyPlaced = existingAllocations
      .filter((allocation) => allocation.batchId === input.batchId)
      .reduce((sum, allocation) => sum + allocation.eggCount, 0);
    const requestedTotal = cleaned.reduce((sum, allocation) => sum + allocation.eggCount, 0);
    if (alreadyPlaced + requestedTotal > batch.eggCount) throw new Error('Parti yumurta adedi aşılamaz.');

    for (const allocation of cleaned) {
      const tray = trayMap.get(allocation.trayId);
      if (!tray) throw new Error('Viyol bulunamadı.');
      const used = existingAllocations
        .filter((item) => item.trayId === allocation.trayId)
        .reduce((sum, item) => sum + item.eggCount, 0);
      if (used + allocation.eggCount > tray.capacity) throw new Error(`V${String(tray.trayNumber).padStart(2, '0')} kapasitesi aşılamaz.`);
    }

    if (!isSupabaseConfigured || !supabase) {
      const now = new Date().toISOString();
      const created = cleaned.map((allocation, index) => ({
        id: `tray-allocation-${Date.now()}-${index}`,
        trayId: allocation.trayId,
        batchId: input.batchId,
        eggCount: allocation.eggCount,
        createdAt: now,
      }));
      allocationStore.push(...created);
      emitDataChanged('placement');
      return created;
    }

    const { data, error } = await supabase.rpc('place_tray_allocations', {
      p_batch_id: input.batchId,
      p_allocations: cleaned,
    });
    if (error) throw error;
    emitDataChanged('placement');
    return (data ?? []).map(mapAllocation);
  },

  async clearBatch(batchId: string) {
    if (!isSupabaseConfigured || !supabase) {
      for (let index = allocationStore.length - 1; index >= 0; index -= 1) {
        if (allocationStore[index].batchId === batchId) allocationStore.splice(index, 1);
      }
      emitDataChanged('placement');
      return;
    }
    const { error } = await supabase.from('tray_allocations').delete().eq('batch_id', batchId);
    if (error) throw error;
    emitDataChanged('placement');
  },
};
