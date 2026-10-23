import { useCallback, useSyncExternalStore } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGoogleButton } from "@app/components/account/useGoogleButton";
import { getSession, isAuthConfigured, subscribeSession } from "@app/services/authWorker";
import { BrandMark } from "@app/components/shared/BrandMark";
import "@app/components/account/GoogleLoginScreen.css";

/** Google-only sign-in page. */
export default function GoogleLoginScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = useSyncExternalStore(subscribeSession, getSession);
  const configured = isAuthConfigured();
  const target = safeFrom(searchParams.get("from"));

  const handleSuccess = useCallback(() => navigate(target, { replace: true }), [navigate, target]);

  const { containerRef, clientId, ready } = useGoogleButton({
    onSuccess: handleSuccess,
    onError: () => {},
  });

  if (session) return <Navigate to={target} replace />;

  return (
    <main className="google-login">
      <div className="google-login__glow" aria-hidden="true" />

      <section className="google-login__brand">
        <div className="google-login__brand-top">
          <BrandMark height="2.4rem" />
          <span className="google-login__brand-name">iLikePdf</span>
        </div>
        <h2>{t("account.loginHeadline", "Every PDF tool. One calm workspace.")}</h2>
        <p className="google-login__brand-sub">
          {t(
            "account.loginSub",
            "Merge, split, compress, convert, sign and edit — in your browser or on your own server.",
          )}
        </p>
        <ul className="google-login__perks">
          <li>
            <strong>50</strong> {t("account.perkFree", "free tokens when you first sign in")}
          </li>
          <li>
            <strong>1</strong> {t("account.perkTool", "token per tool run, 5 per AI action")}
          </li>
          <li>{t("account.perkPrivate", "Your files never leave your device or your server")}</li>
        </ul>
      </section>

      <section className="google-login__panel">
        <div className="google-login__card">
          <div className="google-login__mobile-brand">
            <BrandMark height="2.1rem" />
            <span>iLikePdf</span>
          </div>
          <h1>{t("account.loginTitle", "Welcome to iLikePdf")}</h1>
          <p className="google-login__lede">
            {t("account.loginLede", "Sign in with Google to get your free tokens and keep your balance across devices.")}
          </p>

          <div ref={containerRef} className="google-login__button" />

          {!configured && (
            <p className="google-login__hint">
              {t(
                "account.accountsOffline",
                "Accounts are offline for this install. You can keep using the app without signing in.",
              )}
            </p>
          )}
          {configured && !clientId && (
            <p className="google-login__hint">
              {t("account.missingClientId", "Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.")}
            </p>
          )}
          {configured && clientId && !ready && (
            <p className="google-login__hint">{t("account.loading", "Loading Google sign-in…")}</p>
          )}

          <div className="google-login__badge">
            <span className="google-login__badge-dot" />
            {t("account.loginBadge", "50 free tokens on your first sign-in")}
          </div>
        </div>
      </section>
    </main>
  );
}

function safeFrom(from: string | null): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.includes("\\")) return "/";
  return from;
}
