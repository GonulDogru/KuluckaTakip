type Page<T> = { data: T[] | null; error: unknown };

// Keep list totals correct when a table grows beyond Supabase's default row cap.
export async function readAllRows<T>(loadPage: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const pageSize = 200;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
