import { isSupabaseConfigured, supabase } from '../lib/supabase';

export const authService = {
  async isAuthorizedUser(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    const { data, error } = await supabase.rpc('is_authorized_app_user');
    if (error) throw error;
    return data === true;
  },

  async signOut(): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
