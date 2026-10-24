import { Logo } from "@app/ui/Logo";
import "@app/components/shared/LoadingFallback.css";

/** Branded splash shown while the first route chunk and translations load. */
export function LoadingFallback() {
  return (
    <div className="loading-splash" role="status" aria-live="polite">
      <Logo
        orientation="vertical"
        iconHeight="4.25rem"
        textHeight="1.55rem"
        gap="0.9rem"
      />
      <span className="loading-splash__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="loading-splash__label">Loading</span>
    </div>
  );
}
