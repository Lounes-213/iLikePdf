interface D1Result<T = unknown> {
  results?: T[];
  meta: { changes: number };
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}

interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  ALLOWED_ORIGINS: string;
  GOOGLE_CLIENT_ID: string;
  SESSION_SECRET: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
  TOOL_COST?: string;
  AI_COST?: string;
  FREE_TOKENS?: string;
}

interface UserRow {
  id: string;
  google_sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  balance: number;
}

interface SessionClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

interface Pack {
  id: string;
  tokens: number;
  amountCents: number;
  currency: string;
  label: string;
}

const PACKS: Pack[] = [
  { id: "starter", tokens: 100, amountCents: 299, currency: "usd", label: "100 tokens" },
  { id: "pro", tokens: 500, amountCents: 999, currency: "usd", label: "500 tokens" },
  { id: "mega", tokens: 2000, amountCents: 2999, currency: "usd", label: "2,000 tokens" },
];

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

let jwksCache: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    try {
      const response = await route(request, env, url);
      return withCors(response, request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        return withCors(json({ error: error.message }, error.status), request, env);
      }
      const message = error instanceof Error ? error.message : "Unexpected error";
      return withCors(json({ error: message }, 500), request, env);
    }
  },
};

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/health") {
    return json({ ok: true });
  }

  if (path === "/packs" && request.method === "GET") {
    return json({ packs: PACKS.map(publicPack) });
  }

  if (path === "/auth/google" && request.method === "POST") {
    return signInWithGoogle(request, env);
  }

  if (path === "/me" && request.method === "GET") {
    const claims = await requireSession(request, env);
    const user = await getUser(env, claims.sub);
    if (!user) return json({ error: "User not found" }, 404);
    return json({ user: publicUser(user) });
  }

  if (path === "/tokens/spend" && request.method === "POST") {
    return spendTokens(request, env);
  }

  if (path === "/checkout/stripe" && request.method === "POST") {
    return createStripeCheckout(request, env);
  }

  if (path === "/webhooks/stripe" && request.method === "POST") {
    return handleStripeWebhook(request, env);
  }

  if (path === "/checkout/paypal" && request.method === "POST") {
    return createPaypalOrder(request, env);
  }

  if (path === "/checkout/paypal/capture" && request.method === "POST") {
    return capturePaypalOrder(request, env);
  }

  return json({ error: "Not found" }, 404);
}

async function signInWithGoogle(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { credential?: string } | null;
  const credential = body?.credential;
  if (!credential) return json({ error: "Missing Google credential" }, 400);

  const profile = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID).catch((error: unknown) => {
    throw new HttpError(401, error instanceof Error ? error.message : "Invalid Google credential");
  });
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const freeTokens = Number(env.FREE_TOKENS ?? "50");

  await env.DB.prepare(
    `INSERT INTO users (id, google_sub, email, name, picture, balance, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
     ON CONFLICT(google_sub) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       picture = excluded.picture,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, profile.sub, profile.email, profile.name, profile.picture, freeTokens, now)
    .run();

  const user = await getUserBySub(env, profile.sub);
  if (!user) return json({ error: "Could not create user" }, 500);

  await recordLedger(env, user.id, freeTokens, "signup_bonus", null, true);

  const token = await signSession(
    { sub: user.id, email: user.email, iat: nowSeconds(), exp: nowSeconds() + SESSION_TTL_SECONDS },
    env.SESSION_SECRET,
  );

  return json({ token, user: publicUser(user) });
}

async function spendTokens(request: Request, env: Env): Promise<Response> {
  const claims = await requireSession(request, env);
  const body = (await request.json().catch(() => ({}))) as { kind?: string; tool?: string };
  const kind = body.kind === "ai" ? "ai" : "tool";
  const cost = Math.max(1, Number(kind === "ai" ? env.AI_COST ?? "5" : env.TOOL_COST ?? "1"));

  const update = await env.DB.prepare(
    "UPDATE users SET balance = balance - ?1, updated_at = ?2 WHERE id = ?3 AND balance >= ?1",
  )
    .bind(cost, new Date().toISOString(), claims.sub)
    .run();

  if (update.meta.changes === 0) {
    const user = await getUser(env, claims.sub);
    return json({ error: "Not enough tokens", balance: user?.balance ?? 0, cost }, 402);
  }

  await recordLedger(env, claims.sub, -cost, kind === "ai" ? "ai_run" : "tool_run", body.tool ?? null, false);

  const user = await getUser(env, claims.sub);
  return json({ ok: true, spent: cost, balance: user?.balance ?? 0 });
}

async function createStripeCheckout(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Stripe is not configured" }, 503);

  const claims = await requireSession(request, env);
  const pack = await readPack(request);
  if (!pack) return json({ error: "Unknown token pack" }, 400);

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${env.APP_ORIGIN}/?purchase=success`);
  form.set("cancel_url", `${env.APP_ORIGIN}/?purchase=cancelled`);
  form.set("client_reference_id", claims.sub);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", pack.currency);
  form.set("line_items[0][price_data][unit_amount]", String(pack.amountCents));
  form.set("line_items[0][price_data][product_data][name]", `iLikePdf ${pack.label}`);
  form.set("metadata[user_id]", claims.sub);
  form.set("metadata[pack_id]", pack.id);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const session = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !session.url) {
    return json({ error: session.error?.message ?? "Stripe checkout failed" }, 502);
  }

  return json({ checkoutUrl: session.url });
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "Stripe webhook is not configured" }, 503);

  const raw = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  if (!(await verifyStripeSignature(raw, signature, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "Invalid signature" }, 400);
  }

  const event = JSON.parse(raw) as {
    type?: string;
    data?: { object?: { id?: string; payment_status?: string; metadata?: { user_id?: string; pack_id?: string } } };
  };

  const session = event.data?.object;
  if (
    event.type !== "checkout.session.completed" ||
    session?.payment_status !== "paid" ||
    !session.metadata?.user_id ||
    !session.metadata.pack_id
  ) {
    return json({ received: true });
  }

  const pack = PACKS.find((candidate) => candidate.id === session.metadata?.pack_id);
  if (!pack) return json({ error: "Unknown pack" }, 400);

  await creditPurchase(env, {
    userId: session.metadata.user_id,
    provider: "stripe",
    providerRef: session.id ?? "",
    packId: pack.id,
    tokens: pack.tokens,
    amountCents: pack.amountCents,
    currency: pack.currency,
  });

  return json({ received: true });
}

async function createPaypalOrder(request: Request, env: Env): Promise<Response> {
  const credentials = await paypalCredentials(env);
  if (!credentials) return json({ error: "PayPal is not configured" }, 503);

  const claims = await requireSession(request, env);
  const pack = await readPack(request);
  if (!pack) return json({ error: "Unknown token pack" }, 400);

  const order = {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: claims.sub,
        description: `iLikePdf ${pack.label}`,
        amount: { currency_code: pack.currency.toUpperCase(), value: (pack.amountCents / 100).toFixed(2) },
      },
    ],
    application_context: {
      brand_name: "iLikePdf",
      user_action: "PAY_NOW",
      return_url: `${env.APP_ORIGIN}/?purchase=paypal-return`,
      cancel_url: `${env.APP_ORIGIN}/?purchase=cancelled`,
    },
  };

  const response = await fetch(`${credentials.baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(order),
  });

  const created = (await response.json()) as {
    id?: string;
    links?: Array<{ rel: string; href: string }>;
    message?: string;
  };
  if (!response.ok || !created.id) {
    return json({ error: created.message ?? "PayPal order failed" }, 502);
  }

  const approve = created.links?.find((link) => link.rel === "approve")?.href ?? null;
  return json({ orderId: created.id, approveUrl: approve, packId: pack.id });
}

async function capturePaypalOrder(request: Request, env: Env): Promise<Response> {
  const credentials = await paypalCredentials(env);
  if (!credentials) return json({ error: "PayPal is not configured" }, 503);

  const claims = await requireSession(request, env);
  const body = (await request.json().catch(() => null)) as { orderId?: string } | null;
  if (!body?.orderId) return json({ error: "Missing orderId" }, 400);

  const response = await fetch(`${credentials.baseUrl}/v2/checkout/orders/${body.orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const captured = (await response.json()) as {
    id?: string;
    status?: string;
    purchase_units?: Array<{ custom_id?: string; payments?: { captures?: Array<{ amount?: { value?: string; currency_code?: string } }> } }>;
    message?: string;
  };

  if (!response.ok || captured.status !== "COMPLETED") {
    return json({ error: captured.message ?? "PayPal capture failed" }, 402);
  }

  const unit = captured.purchase_units?.[0];
  if (unit?.custom_id !== claims.sub) {
    return json({ error: "Order does not belong to this user" }, 403);
  }

  const value = Number(unit?.payments?.captures?.[0]?.amount?.value ?? "0");
  const pack = PACKS.find((candidate) => Math.abs(candidate.amountCents / 100 - value) < 0.01);
  if (!pack) return json({ error: "Unknown token pack" }, 400);

  await creditPurchase(env, {
    userId: claims.sub,
    provider: "paypal",
    providerRef: captured.id ?? body.orderId,
    packId: pack.id,
    tokens: pack.tokens,
    amountCents: pack.amountCents,
    currency: pack.currency,
  });

  const user = await getUser(env, claims.sub);
  return json({ ok: true, balance: user?.balance ?? 0 });
}

async function verifyGoogleIdToken(credential: string, clientId: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = credential.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error("Malformed Google credential");

  const header = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedHeader))) as { alg?: string; kid?: string };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Google token");

  const jwks = await getGoogleKeys();
  const jwk = jwks.find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk) throw new Error("Unknown Google signing key");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(encodedSignature),
    textEncoder.encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) throw new Error("Invalid Google signature");

  const payload = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedPayload))) as {
    iss?: string;
    aud?: string;
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    exp?: number;
    email_verified?: boolean;
  };

  const issuerOk = payload.iss === "accounts.google.com" || payload.iss === "https://accounts.google.com";
  if (!issuerOk) throw new Error("Invalid Google issuer");
  if (payload.aud !== clientId) throw new Error("Google client ID mismatch");
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error("Google token expired");
  if (!payload.sub || !payload.email) throw new Error("Google token is missing profile data");

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}

async function getGoogleKeys(): Promise<JsonWebKey[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000) return jwksCache.keys;
  const response = await fetch(GOOGLE_JWKS_URL);
  const body = (await response.json()) as { keys?: JsonWebKey[] };
  if (!response.ok || !body.keys) throw new Error("Could not load Google signing keys");
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

async function verifyStripeSignature(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  ) as Record<string, string>;
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = await crypto.subtle.sign("HMAC", key, textEncoder.encode(`${parts.t}.${raw}`));
  return timingSafeEqual(hex(expected), parts.v1);
}

async function creditPurchase(
  env: Env,
  purchase: {
    userId: string;
    provider: string;
    providerRef: string;
    packId: string;
    tokens: number;
    amountCents: number;
    currency: string;
  },
): Promise<void> {
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO purchases
       (id, user_id, provider, provider_ref, pack_id, tokens, amount_cents, currency)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(
      crypto.randomUUID(),
      purchase.userId,
      purchase.provider,
      purchase.providerRef,
      purchase.packId,
      purchase.tokens,
      purchase.amountCents,
      purchase.currency,
    )
    .run();

  if (inserted.meta.changes === 0) return;

  await env.DB.prepare("UPDATE users SET balance = balance + ?1, updated_at = ?2 WHERE id = ?3")
    .bind(purchase.tokens, new Date().toISOString(), purchase.userId)
    .run();
  await recordLedger(env, purchase.userId, purchase.tokens, "purchase", purchase.providerRef, false);
}

async function recordLedger(
  env: Env,
  userId: string,
  delta: number,
  reason: string,
  ref: string | null,
  skipSignupBonus: boolean,
): Promise<void> {
  if (skipSignupBonus) {
    const existing = await env.DB.prepare("SELECT id FROM ledger WHERE user_id = ?1 AND reason = 'signup_bonus'")
      .bind(userId)
      .first<{ id: string }>();
    if (existing) return;
  }

  await env.DB.prepare("INSERT INTO ledger (id, user_id, delta, reason, ref) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(crypto.randomUUID(), userId, delta, reason, ref)
    .run();
}

async function requireSession(request: Request, env: Env): Promise<SessionClaims> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Missing session token");
  return verifySession(token, env.SESSION_SECRET);
}

async function signSession(claims: SessionClaims, secret: string): Promise<string> {
  const header = base64UrlEncode(textEncoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64UrlEncode(textEncoder.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifySession(token: string, secret: string): Promise<SessionClaims> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new HttpError(401, "Malformed session");

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(encodedSignature),
    textEncoder.encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) throw new HttpError(401, "Invalid session");

  const claims = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedPayload))) as SessionClaims;
  if (!claims.sub || claims.exp * 1000 < Date.now()) throw new HttpError(401, "Session expired");
  return claims;
}

async function getUser(env: Env, id: string): Promise<UserRow | null> {
  return env.DB.prepare(
    "SELECT id, google_sub, email, name, picture, balance FROM users WHERE id = ?1",
  )
    .bind(id)
    .first<UserRow>();
}

async function getUserBySub(env: Env, sub: string): Promise<UserRow | null> {
  return env.DB.prepare(
    "SELECT id, google_sub, email, name, picture, balance FROM users WHERE google_sub = ?1",
  )
    .bind(sub)
    .first<UserRow>();
}

async function readPack(request: Request): Promise<Pack | null> {
  const body = (await request.json().catch(() => null)) as { packId?: string } | null;
  return PACKS.find((pack) => pack.id === body?.packId) ?? null;
}

async function paypalCredentials(env: Env): Promise<{ accessToken: string; baseUrl: string } | null> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return null;

  const baseUrl = env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const basic = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const body = (await response.json()) as { access_token?: string };
  if (!response.ok || !body.access_token) return null;
  return { accessToken: body.access_token, baseUrl };
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    balance: user.balance,
  };
}

function publicPack(pack: Pack) {
  return { id: pack.id, tokens: pack.tokens, amountCents: pack.amountCents, currency: pack.currency, label: pack.label };
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function withCors(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const headers = new Headers(response.headers);
  if (allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, { status: response.status, headers });
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
