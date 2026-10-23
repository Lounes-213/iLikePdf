# iLikePdf accounts Worker

Google sign-in, token balances and card/PayPal top-ups for iLikePdf, running on Cloudflare Workers with D1.

## What it does

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/google` | Verifies a Google ID token, upserts the user, returns a signed session |
| `GET /me` | Current user and token balance |
| `POST /tokens/spend` | Atomically charges 1 token (tool) or 5 tokens (AI) |
| `GET /packs` | Token packs and prices |
| `POST /checkout/stripe` | Creates a Stripe Checkout session |
| `POST /webhooks/stripe` | Credits tokens after `checkout.session.completed` |
| `POST /checkout/paypal` | Creates a PayPal order and returns the approval link |
| `POST /checkout/paypal/capture` | Captures the order and credits tokens |
| `GET /health` | Liveness probe |

The Worker has no npm runtime dependencies: Google JWKS verification, HS256 sessions and Stripe signature checks use WebCrypto and `fetch`.

## Setup

1. Install and authenticate Wrangler:

   ```bash
   cd cloudflare/auth-worker
   npm install
   npx wrangler login
   ```

2. Create the database and paste the returned `database_id` into `wrangler.toml`:

   ```bash
   npx wrangler d1 create ilikepdf
   npx wrangler d1 execute ilikepdf --remote --file=schema.sql
   ```

3. Create a Google OAuth **Web** client in the Google Cloud console. Add your app origins (for example `http://localhost:5173` and `https://your-domain`) as authorised JavaScript origins. Copy the client ID.

4. Set the secrets:

   ```bash
   npx wrangler secret put SESSION_SECRET        # openssl rand -base64 32
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put STRIPE_SECRET_KEY     # optional
   npx wrangler secret put STRIPE_WEBHOOK_SECRET # optional
   npx wrangler secret put PAYPAL_CLIENT_ID      # optional
   npx wrangler secret put PAYPAL_CLIENT_SECRET  # optional
   ```

5. Update `[vars]` in `wrangler.toml`: `APP_ORIGIN`, `ALLOWED_ORIGINS`, costs and free allowance.

6. Deploy:

   ```bash
   npx wrangler deploy
   ```

7. Point the front end at it in `frontend/.env.local`:

   ```bash
   VITE_AUTH_WORKER_URL=https://ilikepdf-auth.<account>.workers.dev
   VITE_GOOGLE_CLIENT_ID=<your-web-client-id>.apps.googleusercontent.com
   ```

### Stripe webhook

Add `https://ilikepdf-auth.<account>.workers.dev/webhooks/stripe` as a webhook endpoint for `checkout.session.completed`, then put the signing secret in `STRIPE_WEBHOOK_SECRET`.

### PayPal

Use sandbox credentials first (`PAYPAL_MODE=sandbox`). The capture endpoint validates that the order's `custom_id` matches the signed-in user and credits the pack that matches the captured amount.

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill in values
npx wrangler d1 execute ilikepdf --local --file=schema.sql
npx wrangler dev
```

## Security notes

- Sessions are stateless HS256 JWTs with a 7-day lifetime; rotating `SESSION_SECRET` invalidates every session.
- Token spends are a single conditional `UPDATE ... WHERE balance >= cost`, so concurrent runs cannot overdraw.
- Purchases are idempotent through a unique index on `(provider, provider_ref)`.
- Webhook payloads are verified before any credit is applied.
- Metering runs in the browser before a tool request; keep the Worker as the only writer of balances.
