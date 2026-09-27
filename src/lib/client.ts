"use client";

import { useCallback, useEffect, useState } from "react";

export interface Me {
  session: { id: string; name: string; identifier: string } | null;
  passenger?: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    idNumber: string | null;
    nationality: string | null;
    gender: string | null;
    isGuest: boolean;
  };
  creditBalance?: number;
  activeCredits?: number;
}

/** Profile fields shared by the booking sheet and the account form. */
export interface PassengerDetails {
  fullName: string;
  idNumber: string;
  nationality: string;
  gender: string;
  email: string;
  phone: string;
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

/** Fire after any auth change (login, logout, signup) so every mounted
 *  useMe() instance refetches — not just the one that caused the change. */
export function notifyAuthChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("mireli:auth"));
}

/** Passenger session hook — refreshes on demand and on any auth change. */
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
    const onAuth = () => refresh();
    window.addEventListener("mireli:auth", onAuth);
    return () => window.removeEventListener("mireli:auth", onAuth);
  }, [refresh]);

  return { me, loading, refresh };
}

export const DIRECTION_LABELS: Record<string, string> = {
  FROM_TERMINUS: "From the SGR Terminus",
  TO_TERMINUS: "To the SGR Terminus",
};
