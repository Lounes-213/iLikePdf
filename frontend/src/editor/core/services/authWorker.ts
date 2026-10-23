const WORKER_URL = (import.meta.env.VITE_AUTH_WORKER_URL ?? "").trim().replace(/\/$/, "");
const SESSION_KEY = "ilikepdf.auth.session";
const PAYPAL_ORDER_KEY = "ilikepdf.auth.paypal-order";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  balance: number;
}

export interface TokenPack {
  id: string;
  tokens: number;
  amountCents: number;
  currency: string;
  label: string;
}

export type SpendKind = "tool" | "ai";

export type SpendResult =
  | { ok: true; balance: number; spent: number }
  | { ok: false; error: string; balance: number };

interface Session {
  token: string;
  user: AuthUser;
}

let session: Session | null = readSession();
const listeners = new Set<() => void>();

export function isAuthConfigured(): boolean {
  return WORKER_URL.length > 0;
}

export function googleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
}

export function getSession(): Session | null {
  return session;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(next: Session | null): void {
  session = next;
  if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else localStorage.removeItem(SESSION_KEY);
  emit();
}

export async function signInWithGoogle(credential: string): Promise<AuthUser> {
  const body = await request<{ token: string; user: AuthUser }>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
    auth: false,
  });
  writeSession({ token: body.token, user: body.user });
  return body.user;
}

export async function signOut(): Promise<void> {
  writeSession(null);
}

export async function refreshUser(): Promise<AuthUser | null> {
  if (!session) return null;
  try {
    const body = await request<{ user: AuthUser }>("/me");
    writeSession({ token: session.token, user: body.user });
    return body.user;
  } catch {
    writeSession(null);
    return null;
  }
}

export async function spendTokens(kind: SpendKind, tool?: string): Promise<SpendResult> {
  if (!session) return { ok: false, error: "sign_in_required", balance: 0 };
  const response = await fetch(`${WORKER_URL}/tokens/spend`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ kind, tool }),
  });

  if (response.status === 401) {
    writeSession(null);
    return { ok: false, error: "sign_in_required", balance: 0 };
  }

  const body = (await response.json().catch(() => ({}))) as {
    balance?: number;
    spent?: number;
    cost?: number;
    error?: string;
  };

  if (response.status === 402) {
    return { ok: false, error: "insufficient_tokens", balance: body.balance ?? 0 };
  }
  if (!response.ok) {
    return { ok: false, error: body.error ?? "token_check_failed", balance: session.user.balance };
  }

  const balance = body.balance ?? session.user.balance;
  writeSession({ token: session.token, user: { ...session.user, balance } });
  return { ok: true, balance, spent: body.spent ?? 0 };
}

export async function getTokenPacks(): Promise<TokenPack[]> {
  const body = await request<{ packs: TokenPack[] }>("/packs", { auth: false });
  return body.packs;
}

export async function startStripeCheckout(packId: string): Promise<void> {
  const body = await request<{ checkoutUrl: string }>("/checkout/stripe", {
    method: "POST",
    body: JSON.stringify({ packId }),
  });
  window.location.assign(body.checkoutUrl);
}

export async function startPaypalCheckout(packId: string): Promise<void> {
  const body = await request<{ orderId: string; approveUrl: string | null }>("/checkout/paypal", {
    method: "POST",
    body: JSON.stringify({ packId }),
  });
  if (!body.approveUrl) throw new Error("PayPal did not return an approval link");
  sessionStorage.setItem(PAYPAL_ORDER_KEY, body.orderId);
  window.location.assign(body.approveUrl);
}

export async function resumePaypalCapture(): Promise<boolean> {
  const orderId = sessionStorage.getItem(PAYPAL_ORDER_KEY);
  if (!orderId || !session) return false;
  sessionStorage.removeItem(PAYPAL_ORDER_KEY);
  try {
    await request("/checkout/paypal/capture", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
    await refreshUser();
    return true;
  } catch {
    return false;
  }
}

export function consumePurchaseResult(): string | null {
  const params = new URLSearchParams(window.location.search);
  const result = params.get("purchase");
  if (!result) return null;
  params.delete("purchase");
  const query = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  return result;
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}

async function request<T>(
  path: string,
  options: { method?: string; body?: string; auth?: boolean } = {},
): Promise<T> {
  const response = await fetch(`${WORKER_URL}${path}`, {
    method: options.method ?? "GET",
    headers: options.auth === false ? { "Content-Type": "application/json" } : authHeaders(),
    body: options.body,
  });

  if (response.status === 401 && options.auth !== false) {
    writeSession(null);
  }

  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}
