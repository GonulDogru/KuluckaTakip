import { demoOperationalMachines } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { OperationalMachine } from '../types/models';
import { emitDataChanged } from './dataEvents';
import { rackService } from './rackService';
import { trayService } from './trayService';

const store: OperationalMachine[] = [...demoOperationalMachines];

function mapMachine(row: Record<string, any>): OperationalMachine {
  return {
    id: row.id,
    name: row.name,
    machineNumber: row.machine_number,
    capacity: Number(row.capacity),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const machineService = {
  async list() {
    if (!isSupabaseConfigured || !supabase) return [...store];
    const { data, error } = await supabase.from('machines').select('*').order('machine_number');
    if (error) throw error;
    return (data ?? []).map(mapMachine);
  },
  async getById(id: string) {
    const machines = await this.list();
    return machines.find((machine) => machine.id === id) ?? null;
  },
  async create(input: { name: string; machineNumber: string; capacity: number; active: boolean }) {
    const exists = (await this.list()).some((machine) => machine.machineNumber === input.machineNumber);
    if (exists) throw new Error('Bu makine numarasıyla kayıt bulunmaktadır.');
    if (!isSupabaseConfigured || !supabase) {
      const now = new Date().toISOString();
      const machine: OperationalMachine = { id: `machine-${Date.now()}`, createdAt: now, updatedAt: now, ...input };
      store.unshift(machine);
      emitDataChanged('machine');
      return machine;
    }
    const { data, error } = await supabase.from('machines').insert({
      name: input.name,
      machine_number: input.machineNumber,
      capacity: input.capacity,
      active: input.active,
    }).select('*').single();
    if (error) throw error;
    const machine = mapMachine(data);
    emitDataChanged('machine');
    return machine;
  },
  async update(id: string, input: Partial<OperationalMachine>) {
    if (!isSupabaseConfigured || !supabase) {
      const index = store.findIndex((machine) => machine.id === id);
      if (index < 0) return null;
      store[index] = { ...store[index], ...input, updatedAt: new Date().toISOString() };
      emitDataChanged('machine');
      return store[index];
    }
    const { data, error } = await supabase.from('machines').update({
      name: input.name,
      machine_number: input.machineNumber,
      capacity: input.capacity,
      active: input.active,
    }).eq('id', id).select('*').single();
    if (error) throw error;
    const machine = mapMachine(data);
    emitDataChanged('machine');
    return machine;
  },
  async listWithUsage() {
    const [machines, racks, trays, allocations] = await Promise.all([this.list(), rackService.list(), trayService.listTrays(), trayService.listAllocations()]);
    return machines.map((machine) => {
      const machineRacks = racks.filter((rack) => rack.machineId === machine.id);
      const capacity = machineRacks.reduce((sum, rack) => sum + rack.capacity, 0) || machine.capacity;
      const rackIds = new Set(machineRacks.map((rack) => rack.id));
      const trayIds = new Set(trays.filter((tray) => rackIds.has(tray.rackId)).map((tray) => tray.id));
      const used = allocations.filter((allocation) => trayIds.has(allocation.trayId)).reduce((sum, allocation) => sum + allocation.eggCount, 0);
      return { ...machine, capacity, used, empty: Math.max(capacity - used, 0), occupancy: capacity ? Math.round((used / capacity) * 100) : 0 };
    });
  },
};
