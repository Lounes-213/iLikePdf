import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTokenPacks, isAuthConfigured, startPaypalCheckout, startStripeCheckout, type TokenPack } from "@app/services/authWorker";
import type { Notice } from "@app/components/account/AccountDialog";

/** Pack list + checkout handling shared by the dialog and the settings card. */
export function useTokenPacks(setNotice: (notice: Notice) => void) {
  const { t } = useTranslation();
  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (packs.length > 0 || !isAuthConfigured()) return;
    void getTokenPacks()
      .then(setPacks)
      .catch(() =>
        setNotice({ tone: "error", message: t("account.packsUnavailable", "Token packs are unavailable right now.") }),
      );
  }, [packs.length, setNotice, t]);

  async function purchase(provider: "stripe" | "paypal", packId: string) {
    setBusy(`${provider}:${packId}`);
    setNotice(null);
    try {
      if (provider === "stripe") await startStripeCheckout(packId);
      else await startPaypalCheckout(packId);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      setNotice({
        tone: "error",
        message: /not configured|503/i.test(raw)
          ? t("account.paymentsUnavailable", "Payments are not enabled on this deployment yet.")
          : raw || t("account.checkoutFailed", "Checkout failed."),
      });
      setBusy(null);
    }
  }

  return { packs, busy, purchase };
}
