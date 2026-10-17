import { demoHatchBasketPlacements, demoHatchBaskets } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { HatchBasket, HatchBasketPlacement } from '../types/models';
import { batchService } from './batchService';
import { emitDataChanged } from './dataEvents';
import { placementService } from './placementService';
import { trayService } from './trayService';

const basketStore: HatchBasket[] = [...demoHatchBaskets];
const placementStore: HatchBasketPlacement[] = [...demoHatchBasketPlacements];

function mapBasket(row: Record<string, any>): HatchBasket {
  return { id: row.id, machineId: row.machine_id, basketNumber: row.basket_number, capacity: Number(row.capacity), active: Boolean(row.active), createdAt: row.created_at };
}

function mapPlacement(row: Record<string, any>): HatchBasketPlacement {
  return { id: row.id, hatchBasketId: row.hatch_basket_id, batchId: row.batch_id, eggCount: Number(row.egg_count), createdAt: row.created_at };
}

export const hatchBasketService = {
  async list() {
    if (!isSupabaseConfigured || !supabase) return [...basketStore];
    const { data, error } = await supabase.from('hatch_baskets').select('*').order('basket_number');
    if (error) throw error;
    return (data ?? []).map(mapBasket);
  },
  async listPlacements() {
    if (!isSupabaseConfigured || !supabase) return [...placementStore];
    const { data, error } = await supabase.from('hatch_basket_placements').select('*');
    if (error) throw error;
    return (data ?? []).map(mapPlacement);
  },
  async listWithUsage() {
    const [baskets, placements] = await Promise.all([this.list(), this.listPlacements()]);
    return baskets.map((basket) => {
      const used = placements.filter((item) => item.hatchBasketId === basket.id).reduce((sum, item) => sum + item.eggCount, 0);
      return { ...basket, used, empty: basket.capacity - used };
    });
  },
  async transferBatch(input: { batchId: string; basketId: string; eggCount: number }) {
    const basket = (await this.listWithUsage()).find((item) => item.id === input.basketId);
    if (!basket) throw new Error('Çıkım sepeti bulunamadı.');
    if (basket.used + input.eggCount > basket.capacity) throw new Error('Çıkım sepeti kapasitesi aşılamaz.');

    if (!isSupabaseConfigured || !supabase) {
      placementStore.push({ id: `hbp-${Date.now()}`, hatchBasketId: input.basketId, batchId: input.batchId, eggCount: input.eggCount, createdAt: new Date().toISOString() });
      await trayService.clearBatch(input.batchId);
      await placementService.clearBatch(input.batchId);
      await batchService.update(input.batchId, { status: 'HATCHING' });
      emitDataChanged('hatchBasket');
      return;
    }

    const { error } = await supabase.rpc('transfer_batch_to_hatch_basket', {
      p_batch_id: input.batchId,
      p_hatch_basket_id: input.basketId,
      p_egg_count: input.eggCount,
    });
    if (error) throw error;
    emitDataChanged('hatchBasket');
  },
};
