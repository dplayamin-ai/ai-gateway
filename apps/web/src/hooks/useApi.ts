import { useEffect, useState } from 'react';

export function useApi<T>(loader: () => Promise<T>, dependencies: unknown[] = []): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loader().then((value) => {
      if (mounted) { setData(value); setError(null); }
    }).catch((reason: unknown) => {
      if (mounted) setError(reason instanceof Error ? reason.message : '데이터를 불러오지 못했습니다.');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  // The caller controls refresh behavior through explicit dependencies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { data, loading, error };
}
