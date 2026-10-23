import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@app/ui/Button";
import { Modal } from "@app/ui/Modal";
import {
  consumePurchaseResult,
  getSession,
  getTokenPacks,
  googleClientId,
  isAuthConfigured,
  refreshUser,
  resumePaypalCapture,
  signInWithGoogle,
  signOut,
  startPaypalCheckout,
  startStripeCheckout,
  subscribeSession,
  type AuthUser,
  type TokenPack,
} from "@app/services/authWorker";
import "@app/components/account/AccountWidget.css";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentity {
  initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

type Notice = { tone: "ok" | "error"; message: string } | null;

export function AccountWidget() {
  const { t } = useTranslation();
  const session = useSyncExternalStore(subscribeSession, getSession);
  const [open, setOpen] = useState(false);
  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthConfigured()) return;
    void refreshUser();
    const purchase = consumePurchaseResult();
    if (!purchase) return;
    if (purchase === "paypal-return") {
      void resumePaypalCapture().then((credited) =>
        setNotice(
          credited
            ? { tone: "ok", message: t("account.purchaseComplete", "Payment complete. Tokens added.") }
            : { tone: "error", message: t("account.purchaseFailed", "We could not confirm that payment.") },
        ),
      );
    } else if (purchase === "success") {
      void refreshUser().then(() =>
        setNotice({ tone: "ok", message: t("account.purchaseComplete", "Payment complete. Tokens added.") }),
      );
    } else if (purchase === "cancelled") {
      setNotice({ tone: "error", message: t("account.purchaseCancelled", "Checkout cancelled.") });
    }
  }, [t]);

  useEffect(() => {
    if (!open || packs.length > 0 || !isAuthConfigured()) return;
    void getTokenPacks()
      .then(setPacks)
      .catch(() => setNotice({ tone: "error", message: t("account.packsUnavailable", "Token packs are unavailable right now.") }));
  }, [open, packs.length, t]);

  async function purchase(provider: "stripe" | "paypal", packId: string) {
    setBusy(`${provider}:${packId}`);
    setNotice(null);
    try {
      if (provider === "stripe") await startStripeCheckout(packId);
      else await startPaypalCheckout(packId);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : t("account.checkoutFailed", "Checkout failed."),
      });
      setBusy(null);
    }
  }

  if (!isAuthConfigured()) return null;

  const balance = session?.user.balance ?? 0;

  return (
    <>
      <button
        type="button"
        className="account-widget"
        onClick={() => setOpen(true)}
        aria-label={session ? t("account.open", "Open account") : t("account.signIn", "Sign in")}
      >
        {session?.user.picture ? (
          <img className="account-widget__avatar" src={session.user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="account-widget__avatar account-widget__avatar--empty">
            {(session?.user.name ?? session?.user.email ?? "i").charAt(0).toUpperCase()}
          </span>
        )}
        <span className="account-widget__label">
          {session ? (
            <>
              <span className="account-widget__name">{session.user.name ?? session.user.email}</span>
              <span className="account-widget__tokens">{t("account.tokens", "{{count}} tokens", { count: balance })}</span>
            </>
          ) : (
            t("account.signIn", "Sign in")
          )}
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("account.title", "iLikePdf account")}
        subtitle={t("account.subtitle", "One free allowance, then top up when you need more.")}
        width="md"
      >
        {notice && <p className={`account-notice account-notice--${notice.tone}`}>{notice.message}</p>}

        {session ? (
          <SignedIn
            user={session.user}
            packs={packs}
            busy={busy}
            onPurchase={purchase}
            onSignOut={() => {
              void signOut();
              setOpen(false);
            }}
          />
        ) : (
          <GoogleSignIn
            onSignedIn={() => {
              setNotice({ tone: "ok", message: t("account.welcome", "You are signed in.") });
            }}
            onError={(message) => setNotice({ tone: "error", message })}
          />
        )}
      </Modal>
    </>
  );
}

function SignedIn({
  user,
  packs,
  busy,
  onPurchase,
  onSignOut,
}: {
  user: AuthUser;
  packs: TokenPack[];
  busy: string | null;
  onPurchase: (provider: "stripe" | "paypal", packId: string) => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="account-panel">
      <div className="account-panel__identity">
        {user.picture ? (
          <img className="account-panel__avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : null}
        <div>
          <div className="account-panel__name">{user.name ?? user.email}</div>
          <div className="account-panel__email">{user.email}</div>
        </div>
        <span className="account-panel__balance">{t("account.balance", "{{count}} tokens", { count: user.balance })}</span>
      </div>

      <h3 className="account-panel__heading">{t("account.buyTokens", "Buy tokens")}</h3>
      <div className="account-packs">
        {packs.map((pack) => (
          <div key={pack.id} className="account-pack">
            <div>
              <div className="account-pack__label">{pack.label}</div>
              <div className="account-pack__price">${(pack.amountCents / 100).toFixed(2)}</div>
            </div>
            <div className="account-pack__actions">
              <Button
                size="sm"
                variant="primary"
                loading={busy === `stripe:${pack.id}`}
                onClick={() => onPurchase("stripe", pack.id)}
              >
                {t("account.payCard", "Card")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={busy === `paypal:${pack.id}`}
                onClick={() => onPurchase("paypal", pack.id)}
              >
                {t("account.payPaypal", "PayPal")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="account-panel__footer">
        <Button size="sm" variant="quiet" onClick={onSignOut}>
          {t("account.signOut", "Sign out")}
        </Button>
      </div>
    </div>
  );
}

function GoogleSignIn({ onSignedIn, onError }: { onSignedIn: () => void; onError: (message: string) => void }) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onSignedIn, onError });
  callbacks.current = { onSignedIn, onError };
  const [ready, setReady] = useState(false);
  const clientId = googleClientId();

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGoogleIdentity()
      .then(() => {
        if (cancelled || !container.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response.credential) {
              callbacks.current.onError(t("account.signInFailed", "Google sign-in failed."));
              return;
            }
            void signInWithGoogle(response.credential)
              .then(() => callbacks.current.onSignedIn())
              .catch((error: unknown) =>
                callbacks.current.onError(
                  error instanceof Error ? error.message : t("account.signInFailed", "Google sign-in failed."),
                ),
              );
          },
        });
        window.google.accounts.id.renderButton(container.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 320,
        });
        setReady(true);
      })
      .catch(() => callbacks.current.onError(t("account.googleUnavailable", "Google sign-in could not be loaded.")));

    return () => {
      cancelled = true;
    };
  }, [clientId, t]);

  return (
    <div className="account-signin">
      <p className="account-signin__copy">
        {t(
          "account.signInCopy",
          "Sign in with Google to unlock your free tokens. Your files never leave your device or your own server.",
        )}
      </p>
      <div ref={container} className="account-signin__button" />
      {!clientId && (
        <p className="account-signin__hint">
          {t("account.missingClientId", "Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.")}
        </p>
      )}
      {clientId && !ready && <p className="account-signin__hint">{t("account.loading", "Loading Google sign-in…")}</p>}
    </div>
  );
}

let googleScript: Promise<void> | null = null;

function loadGoogleIdentity(): Promise<void> {
  if (window.google) return Promise.resolve();
  if (googleScript) return googleScript;
  googleScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleScript = null;
      reject(new Error("Google Identity Services failed to load"));
    };
    document.head.appendChild(script);
  });
  return googleScript;
}
