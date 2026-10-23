import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadGoogleIdentity } from "@app/services/googleIdentity";
import { googleClientId, signInWithGoogle } from "@app/services/authWorker";

interface UseGoogleButtonOptions {
  onSuccess: () => void;
  onError: (message: string) => void;
}

/**
 * Renders the Google Identity Services button into a container element.
 * Callbacks live in a ref so a parent re-render does not reload or
 * re-render the Google iframe.
 */
export function useGoogleButton({ onSuccess, onError }: UseGoogleButtonOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onSuccess, onError });
  callbacks.current = { onSuccess, onError };
  const { t, i18n } = useTranslation();
  const clientId = googleClientId();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    void loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response.credential) {
              callbacks.current.onError(t("account.signInFailed", "Google sign-in failed."));
              return;
            }
            void signInWithGoogle(response.credential)
              .then(() => callbacks.current.onSuccess())
              .catch((error: unknown) =>
                callbacks.current.onError(
                  error instanceof Error ? error.message : t("account.signInFailed", "Google sign-in failed."),
                ),
              );
          },
        });
        google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 320,
          locale: i18n.resolvedLanguage || undefined,
        });
        setReady(true);
      })
      .catch(() => callbacks.current.onError(t("account.googleUnavailable", "Google sign-in could not be loaded.")));

    return () => {
      cancelled = true;
    };
  }, [clientId, t, i18n.resolvedLanguage]);

  return { containerRef, clientId, ready };
}
