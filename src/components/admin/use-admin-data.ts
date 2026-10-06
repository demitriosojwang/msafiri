"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

/** Shared data-fetch hook for admin pages. */
export function useAdminData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api<T>(url);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    let active = true;
    api<T>(url).then((res) => { if (active) { setData(res); setError(null); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Request failed"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [url]);

  return { data, loading, error, refresh };
}
