import type { CapabilityMap, CapabilityState, LocalizedMessage } from "../domain/types";
import { useI18n, type MessageKey } from "../i18n";
import { cn } from "../lib/utils";
import { Badge, type BadgeProps } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const stateLabelKeys: Record<CapabilityState, MessageKey> = {
  available: "capability.state.available",
  unsupported: "capability.state.unsupported",
  probeFailed: "capability.state.probeFailed",
  notImplemented: "capability.state.notImplemented",
  browserLimited: "capability.state.browserLimited"
};

interface CapabilityMatrixProps {
  capabilities: CapabilityMap;
}

export function CapabilityMatrix({ capabilities }: CapabilityMatrixProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("capability.title")}</CardTitle>
      </CardHeader>
      <CardContent className="capabilityList">
        {Object.values(capabilities).map((capability) => (
          <article className="capabilityRow" key={capability.key}>
            <div>
              <strong>{t(capability.labelKey)}</strong>
              <p>{formatCapabilityDetail(capability.detail, t)}</p>
            </div>
            <Badge
              className={cn("statusPill", capability.state)}
              variant={stateBadgeVariants[capability.state]}
            >
              {t(stateLabelKeys[capability.state])}
            </Badge>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

const stateBadgeVariants: Record<CapabilityState, BadgeProps["variant"]> = {
  available: "default",
  unsupported: "secondary",
  probeFailed: "warning",
  notImplemented: "secondary",
  browserLimited: "info"
};

function formatCapabilityDetail(
  detail: string | LocalizedMessage,
  translate: (key: MessageKey, params?: LocalizedMessage["params"]) => string
): string {
  return typeof detail === "string" ? detail : translate(detail.key, detail.params);
}
