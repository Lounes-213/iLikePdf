import { useTranslation } from "react-i18next";
import { Icon } from "@app/ui/Icon";
import { Badge, Text, Stack } from "@mantine/core";
import { BaseToolProps, ToolComponent } from "@app/types/tool";
import { useAutoFormDetectionOperation } from "@app/hooks/tools/autoFormDetection/useAutoFormDetectionOperation";

const AutoFormDetection = (_props: BaseToolProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[360px]">
      <Stack align="center" gap="md" maw={460}>
        <div
          style={{
            padding: "1.25rem",
            borderRadius: "50%",
            background: "rgba(249, 115, 22, 0.12)",
          }}
        >
          <Icon name="form-scan" size="3rem" color="var(--c-accent, #f97316)" />
        </div>
        <Badge size="lg" color="orange" variant="light">
          {t("common.comingSoonBadge", "قريباً — Bientôt disponible")}
        </Badge>
        <Text size="xl" fw={700}>
          {t("home.autoFormDetection.title", "Auto Form Detection")}
        </Text>
        <Text c="dimmed" size="sm">
          {t(
            "home.aiTools.comingSoonDesc",
            "Cette fonctionnalité basée sur l'intelligence artificielle (IA) arrive très bientôt dans iLikePdf !",
          )}
        </Text>
      </Stack>
    </div>
  );
};

AutoFormDetection.tool = () => useAutoFormDetectionOperation;

export default AutoFormDetection as ToolComponent;
