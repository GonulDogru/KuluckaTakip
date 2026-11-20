type Entry = { value?: unknown; expiresAt: number; pending?: Promise<unknown> };
const entries = new Map<string, Entry>();

export function clearQueryCache() {
  entries.clear();
}

export function invalidateQueryCache(prefixes: readonly string[]) {
  for (const key of entries.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) entries.delete(key);
  }
}

export function cachedRead<T>(key: string, read: () => Promise<T>, ttl = 30_000): Promise<T> {
  const existing = entries.get(key);
  if (existing?.pending) return existing.pending as Promise<T>;
  if (existing && existing.expiresAt > Date.now()) return Promise.resolve(existing.value as T);
  const entry: Entry = { expiresAt: 0 };
  const pending = Promise.resolve().then(read).then((value) => {
    // A mutation or account switch can invalidate an in-flight request.
    if (entries.get(key) === entry) {
      entry.value = value;
      entry.expiresAt = Date.now() + ttl;
      entry.pending = undefined;
    }
    return value;
  }, (error) => {
    if (entries.get(key) === entry) entries.delete(key);
    throw error;
  });
  entry.pending = pending;
  for (const [cachedKey, cached] of entries) {
    if (!cached.pending && cached.expiresAt <= Date.now()) entries.delete(cachedKey);
  }
  if (entries.size >= 256) {
    const oldest = Array.from(entries).find(([, cached]) => !cached.pending);
    if (oldest) entries.delete(oldest[0]);
  }
  entries.set(key, entry);
  return pending;
}

function cachedRecord(namespace: string, id: unknown): unknown {
  for (const [key, entry] of entries) {
    if (!key.startsWith(`${namespace}:list:`) || entry.expiresAt <= Date.now() || !Array.isArray(entry.value)) continue;
    const record = entry.value.find((row: { id?: unknown }) => row.id === id);
    if (record) return record;
  }
  return undefined;
}

export function cacheReads<T extends object>(service: T, namespace: string, methods: (keyof T)[]) {
  for (const method of methods) {
    const read = service[method] as (...args: unknown[]) => Promise<unknown>;
    service[method] = ((...args: unknown[]) =>
      cachedRead(`${namespace}:${String(method)}:${JSON.stringify(args)}`, () => {
        const record = method === 'getById' ? cachedRecord(namespace, args[0]) : undefined;
        return record === undefined ? read.apply(service, args) : Promise.resolve(record);
      })) as T[keyof T];
  }
}
