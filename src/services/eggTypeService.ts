import { emitDataChanged } from './dataEvents';
import { cacheReads } from './queryCache';
import { demoBreeds, demoEggTypes } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Breed } from '../types/models';
import { mapEggType } from './mappers';

export const eggTypeService = {
  async ensureBreed(eggTypeId: string, name: string): Promise<string> {
    const trimmed = name.trim();
    if (!supabase) {
      const existing = demoBreeds.find((breed) => breed.eggTypeId === eggTypeId && breed.name === trimmed);
      if (existing) return existing.id;
      const id = `demo-breed-${Date.now()}`;
      demoBreeds.push({ id, eggTypeId, name: trimmed, active: true, createdAt: new Date().toISOString() });
      emitDataChanged('eggType');
      return id;
    }
    const { data: existing, error: lookupError } = await supabase.from('breeds').select('id')
      .eq('egg_type_id', eggTypeId).eq('name', trimmed).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return existing.id;
    const { error } = await supabase.from('breeds').upsert(
      { egg_type_id: eggTypeId, name: trimmed, active: true },
      { onConflict: 'egg_type_id,name', ignoreDuplicates: true },
    );
    if (error) throw error;
    const { data, error: readError } = await supabase.from('breeds').select('id')
      .eq('egg_type_id', eggTypeId).eq('name', trimmed).single();
    if (readError) throw readError;
    emitDataChanged('eggType');
    return data.id;
  },
  async list() {
    if (!isSupabaseConfigured || !supabase) {
      return demoEggTypes.filter((eggType) => eggType.active);
    }

    const { data, error } = await supabase.from('egg_types').select('*').eq('active', true).order('name');
    if (error) throw error;
    return (data ?? []).map(mapEggType);
  },

  async listAll() {
    if (!isSupabaseConfigured || !supabase) return [...demoEggTypes];
    const { data, error } = await supabase.from('egg_types').select('*').order('name');
    if (error) throw error;
    return (data ?? []).map(mapEggType);
  },

  async getById(id: string) {
    const eggTypes = await this.listAll();
    return eggTypes.find((eggType) => eggType.id === id) ?? null;
  },

  async getBreedById(id: string): Promise<Breed | null> {
    if (!supabase) return demoBreeds.find((b) => b.id === id) ?? null;
    const { data, error } = await supabase.from('breeds').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, eggTypeId: data.egg_type_id, name: data.name, active: data.active, createdAt: data.created_at } : null;
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
      emitDataChanged('eggType');
      return eggType;
    }

    const { data, error } = await supabase
      .from('egg_types')
      .insert({ name: input.name, incubation_days: input.incubationDays, transfer_day: input.transferDay })
      .select('*')
      .single();
    if (error) throw error;
    emitDataChanged('eggType');
    return mapEggType(data);
  },

  async update(id: string, input: Partial<{ name: string; incubationDays: number; transferDay: number; active: boolean }>) {
    if (!isSupabaseConfigured || !supabase) {
      const eggType = demoEggTypes.find((item) => item.id === id);
      if (!eggType) return null;
      Object.assign(eggType, input);
      emitDataChanged('eggType');
      return eggType;
    }

    const { data, error } = await supabase
      .from('egg_types')
      .update({ name: input.name, incubation_days: input.incubationDays, transfer_day: input.transferDay, active: input.active })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    emitDataChanged('eggType');
    return mapEggType(data);
  },
};

cacheReads(eggTypeService, 'eggType', ['list', 'listAll', 'getById', 'listBreeds']);
