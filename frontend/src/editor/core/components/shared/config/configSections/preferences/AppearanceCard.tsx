import { useId } from "react";
import { Paper, Stack, Switch, Text } from "@mantine/core";
import { InfoTooltip } from "@app/ui/InfoTooltip";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "@app/ui/SegmentedControl";
import { useTheme } from "@app/components/shared/ThemeProvider";
import LanguageSelector from "@app/components/shared/LanguageSelector";
import { usePreferences } from "@app/contexts/PreferencesContext";

/** How the app looks and moves: theme, language and two comfort switches. */
export function AppearanceCard() {
  const { t } = useTranslation();
  const { setTheme, themeMode } = useTheme();
  const { preferences, updatePreference } = usePreferences();
  const labelIds = useId();
  const reduceMotionLabelId = `${labelIds}-reduce-motion`;
  const compactLabelId = `${labelIds}-compact`;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <div
          id="setting-theme"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text fw={500} size="sm">
              {t("settings.general.theme", "Theme")}{" "}
              <InfoTooltip
                label={t(
                  "settings.general.themeDescription",
                  "Choose light, dark, or follow your system so it switches automatically.",
                )}
              />
            </Text>
          </div>
          <SegmentedControl
            value={themeMode}
            onChange={(val) => setTheme(val)}
            options={[
              {
                label: t("settings.general.themeLight", "Light"),
                value: "light",
              },
              {
                label: t("settings.general.themeDark", "Dark"),
                value: "dark",
              },
              {
                label: t("settings.general.themeSystem", "System"),
                value: "system",
              },
            ]}
          />
        </div>
        <div
          id="setting-language"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text fw={500} size="sm">
              {t("settings.general.language", "Language")}{" "}
              <InfoTooltip
                label={t(
                  "settings.general.languageDescription",
                  "Choose the display language",
                )}
              />
            </Text>
          </div>
          <LanguageSelector position="bottom-end" offset={6} />
        </div>
        <div
          id="setting-reduce-motion"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text id={reduceMotionLabelId} fw={500} size="sm">
              {t("settings.general.reduceMotion", "Reduce motion")}{" "}
              <InfoTooltip
                label={t(
                  "settings.general.reduceMotionDescription",
                  "Turn off animations and sliding transitions across the app.",
                )}
              />
            </Text>
          </div>
          <Switch
            aria-labelledby={reduceMotionLabelId}
            checked={preferences.reduceMotion}
            onChange={(event) =>
              updatePreference("reduceMotion", event.currentTarget.checked)
            }
          />
        </div>
        <div
          id="setting-compact-mode"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text id={compactLabelId} fw={500} size="sm">
              {t("settings.general.compactMode", "Compact navigation")}{" "}
              <InfoTooltip
                label={t(
                  "settings.general.compactModeDescription",
                  "Use a narrower rail and tighter spacing to leave more room for documents.",
                )}
              />
            </Text>
          </div>
          <Switch
            aria-labelledby={compactLabelId}
            checked={preferences.compactMode}
            onChange={(event) =>
              updatePreference("compactMode", event.currentTarget.checked)
            }
          />
        </div>
      </Stack>
    </Paper>
  );
}
