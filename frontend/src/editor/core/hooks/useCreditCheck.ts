import { useTranslation } from "react-i18next";
import { getSession, isAuthConfigured, spendTokens } from "@app/services/authWorker";

/**
 * Pre-flight gate for tool runs.
 *
 * With `VITE_AUTH_WORKER_URL` set, a run requires a Google session and spends
 * tokens before the request leaves the browser. Without it this is a no-op, so
 * local and air-gapped installs keep working.
 */
export function useCreditCheck(operationType?: string, endpoint?: string) {
  const { t } = useTranslation();

  return {
    checkCredits: async (runtimeEndpoint?: string): Promise<string | null> => {
      if (!isAuthConfigured()) return null;
      if (!getSession()) {
        return t("account.signInRequired", "Sign in with Google to run tools.");
      }

      const target = runtimeEndpoint ?? endpoint ?? "";
      const kind = target.includes("/ai/") ? "ai" : "tool";

      try {
        const result = await spendTokens(kind, operationType);
        if (result.ok) return null;
        if (result.error === "insufficient_tokens") {
          return t("account.insufficientTokens", "Not enough tokens (balance: {{balance}}). Buy more in your account.", {
            balance: result.balance,
          });
        }
        return t("account.signInRequired", "Sign in with Google to run tools.");
      } catch {
        return t("account.tokenCheckFailed", "Could not verify your tokens. Please try again.");
      }
    },
  };
}
