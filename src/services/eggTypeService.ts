import { demoBreeds, demoEggTypes } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Breed } from '../types/models';
import { mapEggType } from './mappers';

export const eggTypeService = {
  async list() {
    if (!isSupabaseConfigured || !supabase) {
      return demoEggTypes.filter((eggType) => eggType.active);
    }

    const { data, error } = await supabase.from('egg_types').select('*').eq('active', true).order('name');
    if (error) throw error;
    return (data ?? []).map(mapEggType);
  },

  async getById(id: string) {
    const eggTypes = await this.list();
    return eggTypes.find((eggType) => eggType.id === id) ?? null;
  },

  async listBreeds(eggTypeId?: string) {
    if (!isSupabaseConfigured || !supabase) {
      return demoBreeds.filter((breed) => breed.active && (!eggTypeId || breed.eggTypeId === eggTypeId));
    }

    let query = supabase.from('breeds').select('*').eq('active', true).order('name');
    if (eggTypeId) query = query.eq('egg_type_id', eggTypeId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row): Breed => ({
      id: row.id,
      eggTypeId: row.egg_type_id,
      name: row.name,
      active: row.active,
      createdAt: row.created_at,
    }));
  },

  async create(input: { name: string; incubationDays: number; transferDay: number }) {
    if (!isSupabaseConfigured || !supabase) {
      const now = new Date().toISOString();
      const eggType = { id: `demo-egg-${Date.now()}`, active: true, createdAt: now, ...input };
      demoEggTypes.push(eggType);
      return eggType;
    }

    const { data, error } = await supabase
      .from('egg_types')
      .insert({ name: input.name, incubation_days: input.incubationDays, transfer_day: input.transferDay })
      .select('*')
      .single();
    if (error) throw error;
    return mapEggType(data);
  },

  async update(id: string, input: Partial<{ name: string; incubationDays: number; transferDay: number; active: boolean }>) {
    if (!isSupabaseConfigured || !supabase) {
      const eggType = demoEggTypes.find((item) => item.id === id);
      if (!eggType) return null;
      Object.assign(eggType, input);
      return eggType;
    }

    const { data, error } = await supabase
      .from('egg_types')
      .update({ name: input.name, incubation_days: input.incubationDays, transfer_day: input.transferDay, active: input.active })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapEggType(data);
  },
};
