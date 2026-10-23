import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGoogleButton } from "@app/components/account/useGoogleButton";
import { isAuthConfigured } from "@app/services/authWorker";
import { BrandMark } from "@app/components/shared/BrandMark";
import "@app/components/account/GoogleLoginScreen.css";

/** Google-only sign-in page. The legacy email/password form is gone on purpose. */
export default function GoogleLoginScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const configured = isAuthConfigured();

  const handleSuccess = useCallback(() => {
    const from = searchParams.get("from");
    navigate(from ? safeFrom(from) : "/", { replace: true });
  }, [navigate, searchParams]);

  const { containerRef, clientId, ready } = useGoogleButton({
    onSuccess: handleSuccess,
    onError: () => {},
  });

  return (
    <main className="google-login">
      <div className="google-login__card" data-reveal>
        <div className="google-login__mark">
          <BrandMark height="3rem" />
        </div>
        <h1>{t("account.loginTitle", "Sign in to iLikePdf")}</h1>
        <p className="google-login__lede">
          {t("account.loginLede", "One sign-in, 50 free tokens. Your documents stay on your machine or your server.")}
        </p>

        <div ref={containerRef} className="google-login__button" />

        {!configured && (
          <p className="google-login__hint">
            {t("account.accountsOffline", "Accounts are offline for this install. You can use the app without signing in.")}
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

        <p className="google-login__foot">
          {t("account.loginFoot", "No email, no password — only your Google account.")}
        </p>
      </div>
    </main>
  );
}

function safeFrom(from: string): string {
  // Only same-origin relative paths; reject protocol-relative and backslashes.
  if (!from.startsWith("/") || from.startsWith("//") || from.includes("\\")) return "/";
  return from;
}
