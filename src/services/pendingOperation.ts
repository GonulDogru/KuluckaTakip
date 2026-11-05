import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { supabase } from '../lib/supabase';

export type PendingOperation<T> = { id: string; input: T };
const locks = new Set<string>();

async function storageKey(scope: string) {
  const { data, error } = await supabase!.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Oturum açmanız gerekiyor.');
  return `pending-operation:${data.session.user.id}:${scope}`;
}

export async function readPendingOperation<T>(scope: string): Promise<PendingOperation<T> | null> {
  if (!supabase) return null;
  const raw = await AsyncStorage.getItem(await storageKey(scope));
  return raw ? JSON.parse(raw) as PendingOperation<T> : null;
}

// Persist before sending. An uncertain response survives a screen close or process restart.
// A changed payload cannot silently turn an unresolved write into another financial operation.
export async function runPendingOperation<T, R>(scope: string, input: T, send: (id: string, input: T) => Promise<R>): Promise<R> {
  const key = await storageKey(scope);
  if (locks.has(key)) throw new Error('Bu işlem zaten devam ediyor.');
  locks.add(key);
  try {
    const raw = await AsyncStorage.getItem(key);
    const pending: PendingOperation<T> = raw ? JSON.parse(raw) : { id: randomUUID(), input };
    if (JSON.stringify(pending.input) !== JSON.stringify(input)) {
      throw new Error('Son işlemin sonucu henüz doğrulanmadı. Önce bekleyen işlemi yeniden deneyin.');
    }
    await AsyncStorage.setItem(key, JSON.stringify(pending));
    let result: R;
    try {
      result = await send(pending.id, pending.input);
    } catch (error) {
      // Postgres errors prove the transaction rolled back; network/gateway errors do not.
      const code = (error as { code?: string })?.code;
      if (code && /^[0-9A-Z]{5}$/.test(code) && !code.startsWith('08')) await AsyncStorage.removeItem(key);
      if (error instanceof Error) throw error;
      throw Object.assign(new Error((error as { message?: string })?.message ?? 'İşlem sonucu doğrulanamadı.'), { code });
    }
    await AsyncStorage.removeItem(key);
    return result;
  } finally {
    locks.delete(key);
  }
}
