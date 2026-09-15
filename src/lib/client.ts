"use client";

import { useCallback, useEffect, useState } from "react";

export interface Me {
  session: { id: string; name: string; identifier: string } | null;
  passenger?: { id: string; name: string | null; phone: string };
  creditBalance?: number;
  activeCredits?: number;
}

export async function api<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(path, {
    method: options?.method || (options?.body ? "POST" : "GET"),
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

/** Passenger session hook — refreshes on demand. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Me>("/api/me");
      setMe(data);
    } catch {
      setMe({ session: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { me, loading, refresh };
}

export const DIRECTION_LABELS: Record<string, string> = {
  FROM_TERMINUS: "From the SGR Terminus",
  TO_TERMINUS: "To the SGR Terminus",
};
