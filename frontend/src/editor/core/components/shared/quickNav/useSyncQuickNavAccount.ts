import { useEffect } from "react";
import { useQuickNavHost } from "@app/contexts/QuickNavHostContext";
import { usePortalAccessState } from "@app/hooks/usePortalAccess";
import { useSigningBadgeState } from "@app/hooks/signing/useSigningBadgeCount";

/**
 * Publishes the account-independent rail state. Accounts are gone, so there is
 * no identity to resolve; portal access and signing badges still come from the
 * mounted view.
 */
export function useSyncQuickNavAccount(): void {
  const updateAccount = useQuickNavHost()?.updateAccount;
  const { granted, settled: accessSettled } = usePortalAccessState();
  const { count, settled: signingSettled, items } = useSigningBadgeState();

  useEffect(() => {
    updateAccount?.({
      accountId: null,
      isAnonymous: true,
      signingBadge: signingSettled ? count : undefined,
      signingItems: signingSettled ? items : undefined,
      portalAccess: accessSettled ? granted : undefined,
    });
  }, [updateAccount, signingSettled, items, count, accessSettled, granted]);
}
