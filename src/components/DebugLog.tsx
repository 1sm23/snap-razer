import bugIcon from "@iconify-icons/lucide/bug";
import copyIcon from "@iconify-icons/lucide/copy";
import trash2Icon from "@iconify-icons/lucide/trash-2";
import xIcon from "@iconify-icons/lucide/x";
import { Icon } from "@iconify/react";
import type { HidLogEntry } from "../domain/types";
import { useI18n, type MessageKey } from "../i18n";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { toast } from "./ui/use-toast";

interface DebugLogProps {
  logs: HidLogEntry[];
  open: boolean;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
}

function formatDebugLogValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return undefined;
  }

  return JSON.stringify(value);
}

export function formatDebugLogs(logs: HidLogEntry[], label: (key: MessageKey) => string) {
  return logs
    .map((entry, index) => {
      const lines = [
        `#${index + 1} ${entry.commandName} - ${new Date(entry.timestamp).toISOString()}`,
        `${label("debug.report")}: ${entry.reportId}`,
        `${label("debug.request")}: ${entry.requestHex ?? ""}`
      ];

      const details: Array<[string, string | undefined]> = [
        [label("debug.send"), entry.sendAttempts?.join(" | ")],
        [label("debug.descriptor"), entry.descriptorSummary],
        [label("debug.response"), entry.responseHex ?? entry.error ?? label("debug.noResponse")],
        ["Status", formatDebugLogValue(entry.status)],
        ["Command Class", formatDebugLogValue(entry.commandClass)],
        ["Command ID", formatDebugLogValue(entry.commandId)],
        ["Parsed", formatDebugLogValue(entry.parsed)]
      ];

      details.forEach(([name, value]) => {
        if (value) {
          lines.push(`${name}: ${value}`);
        }
      });

      return lines.join("\n");
    })
    .join("\n\n");
}

export function DebugLog({ logs, open, onClear, onOpenChange }: DebugLogProps) {
  const { t } = useI18n();
  const copyLogs = async () => {
    if (logs.length === 0 || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(formatDebugLogs(logs, t));
      toast({
        title: t("debug.copySuccess")
      });
    } catch {
      toast({
        title: t("debug.copyFailed"),
        variant: "destructive"
      });
    }
  };

  return (
    <div className="debugDock">
      {open ? (
        <Card className="debugPanel">
          <CardHeader className="debugPanelHeader">
            <CardTitle>{t("debug.title", { count: logs.length })}</CardTitle>
            <div className="debugPanelActions">
              <Button
                aria-label={t("debug.clear")}
                disabled={logs.length === 0}
                size="icon"
                title={t("debug.clear")}
                type="button"
                variant="ghost"
                onClick={onClear}
              >
                <Icon aria-hidden="true" height={18} icon={trash2Icon} width={18} />
              </Button>
              <Button
                aria-label={t("debug.copy")}
                disabled={logs.length === 0}
                size="icon"
                title={t("debug.copy")}
                type="button"
                variant="ghost"
                onClick={() => {
                  void copyLogs();
                }}
              >
                <Icon aria-hidden="true" height={18} icon={copyIcon} width={18} />
              </Button>
              <Button
                aria-label={t("debug.close")}
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                <Icon aria-hidden="true" height={18} icon={xIcon} width={18} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="muted">{t("debug.noTraffic")}</p>
            ) : (
              <div className="logList">
                {logs.map((entry) => (
                  <Card className="logEntry" key={entry.id}>
                    <header>
                      <strong>{entry.commandName}</strong>
                      <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </header>
                    <dl>
                      <dt>{t("debug.report")}</dt>
                      <dd>{entry.reportId}</dd>
                      <dt>{t("debug.request")}</dt>
                      <dd>{entry.requestHex}</dd>
                      {entry.sendAttempts ? (
                        <>
                          <dt>{t("debug.send")}</dt>
                          <dd>{entry.sendAttempts.join(" | ")}</dd>
                        </>
                      ) : null}
                      {entry.descriptorSummary ? (
                        <>
                          <dt>{t("debug.descriptor")}</dt>
                          <dd>{entry.descriptorSummary}</dd>
                        </>
                      ) : null}
                      <dt>{t("debug.response")}</dt>
                      <dd>{entry.responseHex ?? entry.error ?? t("debug.noResponse")}</dd>
                    </dl>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
      <Button
        aria-label={t("debug.open")}
        className="debugFab"
        size="icon"
        type="button"
        onClick={() => onOpenChange(!open)}
      >
        <Icon aria-hidden="true" height={22} icon={bugIcon} width={22} />
        <span>{logs.length}</span>
      </Button>
    </div>
  );
}
