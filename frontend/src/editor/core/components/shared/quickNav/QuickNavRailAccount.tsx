import { useTranslation } from "react-i18next";
import { Icon } from "@app/ui/Icon";
import { RailButton } from "@app/components/shared/quickNav/QuickNavRailBase";
import "@app/components/shared/quickNav/QuickNavRailAccount.css";

export interface QuickNavRailAccountProps {
  onOpen: () => void;
  /** Drawn as the current destination while the settings page is open. */
  active?: boolean;
}

/** The rail's plain settings button; there is no account layer to open. */
export function QuickNavRailAccount({
  onOpen,
  active = false,
}: QuickNavRailAccountProps) {
  const { t } = useTranslation();
  const label = t("quickNav.settings", "Settings");

  return (
    <div className="quick-nav-rail-account">
      <RailButton
        label={label}
        icon={<Icon name="settings" size="1.125rem" />}
        current={active}
        testId="config-button"
        tourId="config-button"
        onClick={onOpen}
      />
    </div>
  );
}
