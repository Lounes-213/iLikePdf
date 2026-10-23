import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@app/auth/UseSession";
import { useQuickNavHost } from "@app/contexts/QuickNavHostContext";
import { useAccountIdentity } from "@app/hooks/useAccountIdentity";
import { usePortalAccessState } from "@app/hooks/usePortalAccess";
import { useSigningBadgeState } from "@app/hooks/signing/useSigningBadgeCount";
import { getSession, subscribeSession } from "@app/services/authWorker";

/** Publishes resolved account fields from the mounted view into the root cache. */
export function useSyncQuickNavAccount(): void {
  const updateAccount = useQuickNavHost()?.updateAccount;
  const { user, isAnonymous, loading: authLoading } = useAuth();
  const googleSession = useSyncExternalStore(subscribeSession, getSession);
  const {
    displayName,
    profilePictureUrl,
    loading: identityLoading,
  } = useAccountIdentity();
  const { granted, settled: accessSettled } = usePortalAccessState();
  const { count, settled: signingSettled, items } = useSigningBadgeState();
  const accountId = user?.id ?? googleSession?.user.email ?? null;
  const displayNameOrGoogle = googleSession?.user.name ?? googleSession?.user.email ?? displayName;
  const pictureOrGoogle = googleSession?.user.picture ?? profilePictureUrl;

  useEffect(() => {
    if (authLoading) return;
    updateAccount?.({
      accountId,
      isAnonymous: Boolean(isAnonymous),
      identity: identityLoading
        ? undefined
        : { displayName: displayNameOrGoogle, profilePictureUrl: pictureOrGoogle },
      signingBadge: signingSettled ? count : undefined,
      signingItems: signingSettled ? items : undefined,
      portalAccess: accessSettled ? granted : undefined,
    });
  }, [
    updateAccount,
    accountId,
    isAnonymous,
    authLoading,
    identityLoading,
    displayNameOrGoogle,
    pictureOrGoogle,
    signingSettled,
    items,
    count,
    accessSettled,
    granted,
  ]);
}
