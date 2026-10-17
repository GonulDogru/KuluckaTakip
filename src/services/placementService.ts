import { demoPlacementCells } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { PlacementCell, Rack } from '../types/models';
import { emitDataChanged } from './dataEvents';

const store: PlacementCell[] = [...demoPlacementCells];

function mapCell(row: Record<string, any>): PlacementCell {
  return {
    id: row.id,
    batchId: row.batch_id,
    machineId: row.machine_id,
    rackId: row.rack_id,
    rowNumber: Number(row.row_number),
    positionNumber: Number(row.position_number),
    createdAt: row.created_at,
  };
}

export function buildCellRange(rack: Rack, start: { row: number; position: number }, end: { row: number; position: number }) {
  const startIndex = (start.row - 1) * rack.positionsPerRow + start.position;
  const endIndex = (end.row - 1) * rack.positionsPerRow + end.position;
  const min = Math.min(startIndex, endIndex);
  const max = Math.max(startIndex, endIndex);
  return Array.from({ length: max - min + 1 }, (_, offset) => {
    const linear = min + offset;
    return {
      rowNumber: Math.ceil(linear / rack.positionsPerRow),
      positionNumber: ((linear - 1) % rack.positionsPerRow) + 1,
    };
  });
}

export const placementService = {
  async list() {
    if (!isSupabaseConfigured || !supabase) return [...store];
    const { data, error } = await supabase.from('placement_cells').select('*').order('row_number').order('position_number');
    if (error) throw error;
    return (data ?? []).map(mapCell);
  },
  async listByRack(rackId: string) {
    const cells = await this.list();
    return cells.filter((cell) => cell.rackId === rackId);
  },
  async listByBatch(batchId: string) {
    const cells = await this.list();
    return cells.filter((cell) => cell.batchId === batchId);
  },
  async placeCells(input: { batchId: string; machineId: string; rack: Rack; cells: Array<{ rowNumber: number; positionNumber: number }> }) {
    const occupied = await this.listByRack(input.rack.id);
    const occupiedKeys = new Set(occupied.map((cell) => `${cell.rowNumber}-${cell.positionNumber}`));
    const hasConflict = input.cells.some((cell) => occupiedKeys.has(`${cell.rowNumber}-${cell.positionNumber}`));
    if (hasConflict) throw new Error('Seçilen alanda dolu pozisyon var.');
    if (occupied.length + input.cells.length > input.rack.capacity) throw new Error('Raf kapasitesi aşılamaz.');

    if (!isSupabaseConfigured || !supabase) {
      const now = new Date().toISOString();
      const created = input.cells.map((cell) => ({
        id: `cell-${Date.now()}-${cell.rowNumber}-${cell.positionNumber}`,
        batchId: input.batchId,
        machineId: input.machineId,
        rackId: input.rack.id,
        rowNumber: cell.rowNumber,
        positionNumber: cell.positionNumber,
        createdAt: now,
      }));
      store.push(...created);
      emitDataChanged('placement');
      return created;
    }

    const { data, error } = await supabase.from('placement_cells').insert(input.cells.map((cell) => ({
      batch_id: input.batchId,
      machine_id: input.machineId,
      rack_id: input.rack.id,
      row_number: cell.rowNumber,
      position_number: cell.positionNumber,
    }))).select('*');
    if (error) throw error;
    const created = (data ?? []).map(mapCell);
    emitDataChanged('placement');
    return created;
  },
  async clearBatch(batchId: string) {
    if (!isSupabaseConfigured || !supabase) {
      for (let index = store.length - 1; index >= 0; index -= 1) {
        if (store[index].batchId === batchId) store.splice(index, 1);
      }
      emitDataChanged('placement');
      return;
    }
    const { error } = await supabase.from('placement_cells').delete().eq('batch_id', batchId);
    if (error) throw error;
    emitDataChanged('placement');
  },
};
