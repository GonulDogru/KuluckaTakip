import { demoRacks } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Rack } from '../types/models';
import { emitDataChanged } from './dataEvents';
import { trayService } from './trayService';

const store: Rack[] = [...demoRacks];

function mapRack(row: Record<string, any>): Rack {
  const trayCount = Number(row.tray_count ?? row.row_count ?? 10);
  const trayCapacity = Number(row.tray_capacity ?? row.positions_per_row ?? 10);
  return {
    id: row.id,
    machineId: row.machine_id,
    rackNumber: row.rack_number,
    capacity: Number(row.capacity ?? trayCount * trayCapacity),
    rowCount: trayCount,
    positionsPerRow: trayCapacity,
    trayCount,
    trayCapacity,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const rackService = {
  async list(machineId?: string) {
    if (!isSupabaseConfigured || !supabase) return store.filter((rack) => !machineId || rack.machineId === machineId);
    let query = supabase.from('racks').select('*').order('rack_number');
    if (machineId) query = query.eq('machine_id', machineId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapRack);
  },
  async getById(id: string) {
    const racks = await this.list();
    return racks.find((rack) => rack.id === id) ?? null;
  },
  async create(input: { machineId: string; rackNumber: string; rowCount: number; positionsPerRow: number }) {
    const trayCount = input.rowCount;
    const trayCapacity = input.positionsPerRow;
    const capacity = trayCount * trayCapacity;
    if (!isSupabaseConfigured || !supabase) {
      const now = new Date().toISOString();
      const rack: Rack = { id: `rack-${Date.now()}`, capacity, active: true, createdAt: now, updatedAt: now, trayCount, trayCapacity, ...input };
      store.push(rack);
      emitDataChanged('rack');
      return rack;
    }
    const { data, error } = await supabase.from('racks').insert({
      machine_id: input.machineId,
      name: input.rackNumber,
      rack_number: input.rackNumber,
      row_count: input.rowCount,
      column_count: input.positionsPerRow,
      positions_per_row: input.positionsPerRow,
      tray_count: trayCount,
      tray_capacity: trayCapacity,
      capacity,
      active: true,
    }).select('*').single();
    if (error) throw error;
    const rack = mapRack(data);
    const trayRows = Array.from({ length: rack.trayCount }, (_, index) => ({
      rack_id: rack.id,
      tray_number: index + 1,
      capacity: rack.trayCapacity,
      active: true,
    }));
    const { error: trayError } = await supabase.from('rack_trays').insert(trayRows);
    if (trayError) throw trayError;
    emitDataChanged('rack');
    return rack;
  },
  async listWithUsage(machineId: string) {
    const [racks, trays, allocations] = await Promise.all([this.list(machineId), trayService.listTrays(), trayService.listAllocations()]);
    return racks.map((rack) => {
      const rackTrayIds = new Set(trays.filter((tray) => tray.rackId === rack.id).map((tray) => tray.id));
      const used = allocations.filter((allocation) => rackTrayIds.has(allocation.trayId)).reduce((sum, allocation) => sum + allocation.eggCount, 0);
      return { ...rack, used, empty: rack.capacity - used, occupancy: rack.capacity ? Math.round((used / rack.capacity) * 100) : 0 };
    });
  },
};
