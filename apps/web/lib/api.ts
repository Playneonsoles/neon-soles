import type { ShoeEffect } from "@walk/game";

export class ApiError extends Error {
  /** `code` et `params` permettent de traduire l'erreur côté interface ; `message` reste l'anglais du serveur (repli). */
  constructor(public status: number, message: string, public code: string | null = null, public params: Record<string, string | number> | null = null) {
    super(message);
  }
}

/** Appel de l'API (même origine, cookie de session inclus). */
export async function api<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  let res: Response;
  try {
  res = await fetch(`/api/v1${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    body: init.body ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  } catch { throw new ApiError(0, "Network error. Check your connection.", "network"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message ?? "Something went wrong.", data.error ?? null, data.params ?? null);
  return data as T;
}

export interface Me {
  id: string;
  wallet: string;
  pseudo: string | null;
  level: number;
  streak_days: number;
  is_admin: boolean;
  badges?: string[];
  can_walk: boolean;
  walk_block: "running" | "cooldown" | "daily_limit" | null;
  next_session_at: string | null;
  sessions_today: number;
  daily_session_limit: number;
  cooldown_hours: number;
  profile_complete: boolean;
  claims_paused: boolean;
  claim_min: number;
  claim_fee_pct: number;
  profile: { avatar: number | null } | null;
  status: string;
  shoe: { id: string; level: number; model: string; upgrading_until: string | null; visual: { color: string; effects: ShoeEffect[]; tier: string } } | null;
  balances: { pending: string; confirmed: string; claimable: string };
}
