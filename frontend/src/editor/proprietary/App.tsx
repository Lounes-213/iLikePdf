import { Suspense, lazy } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import { AppProviders } from "@app/components/AppProviders";
import { AppLayout } from "@app/components/AppLayout";
import { LoadingFallback } from "@app/components/shared/LoadingFallback";
import { PreferencesProvider } from "@app/contexts/PreferencesContext";
import { ThemeProvider } from "@app/components/shared/ThemeProvider";
import { AppRoot } from "@app/components/layout/AppRoot";

const ShareLinkPage = lazy(() => import("@app/routes/ShareLinkPage"));
const ParticipantView = lazy(
  () => import("@app/components/workflow/ParticipantView"),
);
const Onboarding = lazy(() => import("@app/components/onboarding/Onboarding"));

const MobileScannerPage = lazy(() => import("@app/pages/MobileScannerPage"));
const MobileSignPage = lazy(() => import("@app/pages/MobileSignPage"));
import { getAdminRouteExtensions } from "@app/routes/adminRouteExtensions";
import { AppFrame } from "@app/components/layout/AppFrame";
import { NoAppChrome } from "@app/components/layout/NoAppChrome";

import "@app/styles/tailwind.css";
import "@app/styles/cookieconsent.css";
import "@app/styles/index.css";

import "@app/utils/fileIdSafety";

/** Public, token-gated pages need no API session or account. */
function PublicRouteProviders({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </PreferencesProvider>
  );
}

function ParticipantViewPage() {
  const { token } = useParams<{ token: string }>();
  if (!token) return null;
  return <ParticipantView token={token} />;
}

/** The editor is the entry point: no login screen, no account gate. */
function Editor() {
  return (
    <AppProviders>
      <AppLayout>
        <AppRoot />
        <Onboarding />
      </AppLayout>
    </AppProviders>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route
          path="/mobile-scanner"
          element={
            <PublicRouteProviders>
              <MobileScannerPage />
            </PublicRouteProviders>
          }
        />

        <Route
          path="/mobile-sign"
          element={
            <PublicRouteProviders>
              <MobileSignPage />
            </PublicRouteProviders>
          }
        />

        <Route
          path="/workflow/sign/:token"
          element={
            <PublicRouteProviders>
              <ParticipantViewPage />
            </PublicRouteProviders>
          }
        />

        <Route element={<NoAppChrome />}>
          <Route path="/share/:token" element={<ShareLinkPage />} />
        </Route>

        <Route element={<AppFrame />}>
          {getAdminRouteExtensions()}
          <Route path="*" element={<Editor />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
