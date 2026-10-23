interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentity {
  initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

interface GoogleNamespace {
  accounts: { id: GoogleIdentity };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

let loader: Promise<GoogleNamespace> | null = null;

/** Loads Google Identity Services once and resolves the `google.accounts.id` API. */
export function loadGoogleIdentity(): Promise<GoogleNamespace> {
  if (window.google) return Promise.resolve(window.google);
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (window.google) resolve(window.google);
      else reject(new Error("Google Identity Services did not initialise"));
    };
    script.onerror = () => {
      loader = null;
      reject(new Error("Google Identity Services failed to load"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export type { GoogleCredentialResponse };
