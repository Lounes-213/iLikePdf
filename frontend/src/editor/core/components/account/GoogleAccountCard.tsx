import { useSyncExternalStore, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@app/components/shared/config/SettingsCard";
import { GoogleSignIn, SignedIn, type Notice } from "@app/components/account/AccountDialog";
import { useTokenPacks } from "@app/hooks/useTokenPacks";
import { getSession, isAuthConfigured, signOut, subscribeSession } from "@app/services/authWorker";
import "@app/components/account/Account.css";

/** Your iLikePdf identity and token balance, under Settings → General (#account). */
export function GoogleAccountCard() {
  const { t } = useTranslation();
  const session = useSyncExternalStore(subscribeSession, getSession);
  const [notice, setNotice] = useState<Notice>(null);
  const { packs, busy, purchase } = useTokenPacks(setNotice);

  if (!isAuthConfigured()) return null;

  return (
    <SettingsCard id="account" title={t("account.settingsTitle", "Your account")}>
      {notice && <p className={`account-notice account-notice--${notice.tone}`}>{notice.message}</p>}

      {session ? (
        <SignedIn
          user={session.user}
          packs={packs}
          busy={busy}
          onPurchase={purchase}
          onSignOut={() => {
            void signOut();
          }}
        />
      ) : (
        <GoogleSignIn
          onSignedIn={() => setNotice({ tone: "ok", message: t("account.welcome", "You are signed in.") })}
          onError={(message) => setNotice({ tone: "error", message })}
        />
      )}
    </SettingsCard>
  );
}
