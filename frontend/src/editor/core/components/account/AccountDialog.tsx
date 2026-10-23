import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSyncExternalStore } from "react";
import { Modal } from "@app/ui/Modal";
import { Button } from "@app/ui/Button";
import { useGoogleButton } from "@app/components/account/useGoogleButton";
import { useTokenPacks } from "@app/hooks/useTokenPacks";
import {
  consumePurchaseResult,
  getSession,
  isAuthConfigured,
  refreshUser,
  resumePaypalCapture,
  signOut,
  subscribeSession,
  type AuthUser,
  type TokenPack,
} from "@app/services/authWorker";
import "@app/components/account/Account.css";

export type Notice = { tone: "ok" | "error"; message: string } | null;

/**
 * The account dialog. Opens from the custom `ilikepdf:open-account` event when
 * a tool run needs a session or a top-up, so it mounts once in the app frame
 * and shows nothing of its own.
 */
export function AccountDialog() {
  const { t } = useTranslation();
  const session = useSyncExternalStore(subscribeSession, getSession);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const { packs, busy, purchase } = useTokenPacks(setNotice);

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
    function onPrompt(event: Event) {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      setOpen(true);
      setNotice(
        reason === "insufficient_tokens"
          ? {
              tone: "error",
              message: t("account.insufficientTokensShort", "You are out of tokens. Top up to keep running tools."),
            }
          : { tone: "error", message: t("account.signInRequired", "Sign in with Google to run tools.") },
      );
    }
    window.addEventListener("ilikepdf:open-account", onPrompt);
    return () => window.removeEventListener("ilikepdf:open-account", onPrompt);
  }, [t]);

  useEffect(() => {
    if (open && getSession()) void refreshUser();
  }, [open]);

  if (!isAuthConfigured()) return null;

  return (
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
          onSignedIn={() => setNotice({ tone: "ok", message: t("account.welcome", "You are signed in.") })}
          onError={(message) => setNotice({ tone: "error", message })}
        />
      )}
    </Modal>
  );
}

export function SignedIn({
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

export function GoogleSignIn({
  onSignedIn,
  onError,
}: {
  onSignedIn: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const { containerRef, clientId, ready } = useGoogleButton({ onSuccess: onSignedIn, onError });

  return (
    <div className="account-signin">
      <p className="account-signin__copy">
        {t(
          "account.signInCopy",
          "Sign in with Google to unlock your free tokens. Your files never leave your device or your own server.",
        )}
      </p>
      <div ref={containerRef} className="account-signin__button" />
      {!clientId && (
        <p className="account-signin__hint">
          {t("account.missingClientId", "Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.")}
        </p>
      )}
      {clientId && !ready && <p className="account-signin__hint">{t("account.loading", "Loading Google sign-in…")}</p>}
    </div>
  );
}
