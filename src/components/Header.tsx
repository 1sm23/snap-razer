import { Icon } from "@iconify/react";
import batteryIcon from "@iconify-icons/lucide/battery";
import chevronDownIcon from "@iconify-icons/lucide/chevron-down";
import chevronRightIcon from "@iconify-icons/lucide/chevron-right";
import downloadIcon from "@iconify-icons/lucide/download";
import externalLinkIcon from "@iconify-icons/lucide/external-link";
import helpCircleIcon from "@iconify-icons/lucide/help-circle";
import languagesIcon from "@iconify-icons/lucide/languages";
import moonIcon from "@iconify-icons/lucide/moon";
import settingsIcon from "@iconify-icons/lucide/settings";
import sunIcon from "@iconify-icons/lucide/sun";
import sunMoonIcon from "@iconify-icons/lucide/sun-moon";
import githubIcon from "@iconify-icons/simple-icons/github";
import type { ConnectedDevice } from "../domain/types";
import type { BatteryResult } from "../features/batteryAdapter";
import { useI18n, type SupportedLanguage } from "../i18n";
import type { ResolvedThemeMode, ThemeMode } from "../theme";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { Switch } from "./ui/switch";

interface HeaderProps {
  device: ConnectedDevice | null;
  battery: BatteryResult | null;
  hidSupported: boolean;
  connecting: boolean;
  error: string | null;
  themeMode: ThemeMode;
  resolvedThemeMode: ResolvedThemeMode;
  debugEnabled: boolean;
  installAvailable: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onDebugEnabledChange: (enabled: boolean) => void;
  onInstallApp: () => void;
  onThemeModeChange: (themeMode: ThemeMode) => void;
  onToggleTheme: (origin: { x: number; y: number }) => void;
}

export function Header({
  device,
  battery,
  hidSupported,
  connecting,
  error,
  themeMode,
  resolvedThemeMode,
  debugEnabled,
  installAvailable,
  onConnect,
  onDisconnect,
  onDebugEnabledChange,
  onInstallApp,
  onThemeModeChange,
  onToggleTheme
}: HeaderProps) {
  const githubUrl = "https://github.com/1sm23/snap-razer";
  const { availableLanguages, language, setLanguage, t } = useI18n();
  const nextTheme = resolvedThemeMode === "dark" ? "light" : "dark";
  const themeOptions: ThemeMode[] = ["light", "dark", "system"];
  const themeIcons = {
    light: sunIcon,
    dark: moonIcon,
    system: sunMoonIcon
  } satisfies Record<ThemeMode, typeof sunIcon>;
  const orderedLanguages = [...availableLanguages].sort((a, b) => {
    if (a.code === language) {
      return -1;
    }

    if (b.code === language) {
      return 1;
    }

    return 0;
  });

  return (
    <header className="topBar">
      <div className="brandLockup">
        <img aria-hidden="true" className="brandLogo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
        <div className="brandText">
          <p className="eyebrow">{t("app.eyebrow")}</p>
          <h1>Snap Razer</h1>
          <p className="subtitle">{hidSupported ? t("app.subtitle") : t("app.webHidUnavailable")}</p>
        </div>
      </div>
      <div className="connectionBox">
        <div className="topActions">
          <Button
            aria-label={t("theme.toggle", { theme: t(`theme.${nextTheme}`) })}
            className="themeIconButton"
            size="icon"
            title={t("theme.toggle", { theme: t(`theme.${nextTheme}`) })}
            type="button"
            variant="ghost"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onToggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            }}
          >
            <Icon aria-hidden="true" height={20} icon={resolvedThemeMode === "dark" ? sunIcon : moonIcon} width={20} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={t("language.label")} size="icon" title={t("language.label")} type="button" variant="ghost">
                <Icon aria-hidden="true" height={20} icon={languagesIcon} width={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={language}
                onValueChange={(value) => setLanguage(value as SupportedLanguage)}
              >
                {orderedLanguages.map((item) => (
                  <DropdownMenuRadioItem key={item.code} value={item.code}>
                    {item.nativeName}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={t("settings.label")} size="icon" title={t("settings.label")} type="button" variant="ghost">
                <Icon aria-hidden="true" height={20} icon={settingsIcon} width={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="settingsMenu">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <span className="settingsMenuLabel">
                    <Icon
                      aria-hidden="true"
                      className="settingsMenuIcon"
                      height={16}
                      icon={themeIcons[themeMode]}
                      width={16}
                    />
                    {t("theme.label")}
                  </span>
                  <Icon aria-hidden="true" height={14} icon={chevronRightIcon} width={14} />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={themeMode}
                    onValueChange={(value) => onThemeModeChange(value as ThemeMode)}
                  >
                    {themeOptions.map((option) => (
                      <DropdownMenuRadioItem className="themeMenuItem" key={option} value={option}>
                        <Icon aria-hidden="true" height={16} icon={themeIcons[option]} width={16} />
                        {t(`theme.${option}`)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <div className="settingsMenuRow">
                <label htmlFor="debug-toggle">
                  <Icon
                    aria-hidden="true"
                    className="settingsMenuIcon"
                    height={16}
                    icon="pixelarticons:debug"
                    width={16}
                  />
                  {t("settings.debug")}
                </label>
                <Switch
                  checked={debugEnabled}
                  id="debug-toggle"
                  onClick={() => onDebugEnabledChange(!debugEnabled)}
                />
              </div>
              {installAvailable ? (
                <DropdownMenuItem onSelect={onInstallApp}>
                  <span>
                    <Icon aria-hidden="true" className="settingsMenuIcon" height={16} icon={downloadIcon} width={16} />
                    {t("settings.installApp")}
                  </span>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <a href={githubUrl} rel="noreferrer" target="_blank">
                  <span>
                    <Icon aria-hidden="true" className="settingsMenuIcon" height={16} icon={githubIcon} width={16} />
                    {t("settings.github")}
                  </span>
                  <Icon aria-hidden="true" height={14} icon={externalLinkIcon} width={14} />
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className={device ? "connectionButtonGroup connectionButtonGroupConnected" : "connectionButtonGroup"}>
          <Button className="connectionButtonMain" type="button" disabled={!hidSupported || connecting} onClick={onConnect}>
            {connecting ? t("connection.connecting") : t("connection.connect")}
          </Button>
          {device ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("connection.actions")}
                  className="connectionButtonMenu"
                  disabled={connecting}
                  size="icon"
                  title={t("connection.actions")}
                  type="button"
                >
                  <Icon aria-hidden="true" height={16} icon={chevronDownIcon} width={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onDisconnect}>{t("connection.disconnect")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("connection.conflictHelp")}
                  className="connectionButtonHelp"
                  size="icon"
                  title={t("connection.conflictHelp")}
                  type="button"
                  variant="ghost"
                >
                  <Icon aria-hidden="true" height={16} icon={helpCircleIcon} width={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="connectionHelpMenu">
                <p className="connectionHelpLead">{t("connection.nativeDriverConflict")}</p>
                <ol className="connectionHelpList">
                  <li>{t("connection.conflictStepQuit")}</li>
                  <li>{t("connection.conflictStepWindowsService")}</li>
                  <li>{t("connection.conflictStepReplug")}</li>
                  <li>{t("connection.conflictStepPermission")}</li>
                </ol>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="deviceMeta">
          <span className="deviceNameLine">
            <span className="deviceName">{device?.productName ?? t("connection.noDevice")}</span>
            {device && battery ? (
              <span className="deviceBattery" title={`${t("power.battery")} ${battery.percent}%`}>
                <Icon aria-hidden="true" className="deviceBatteryIcon" height={18} icon={batteryIcon} width={18} />
                {battery.percent}%
              </span>
            ) : null}
          </span>
          {device ? (
            <small>
              VID 0x{device.vendorId.toString(16)} / PID 0x{device.productId.toString(16)} /{" "}
              {device.writableReports
                ? t("connection.controlReportsAvailable")
                : device.featureReportProbeAllowed
                  ? t("connection.probingReport")
                  : t("connection.inputOnlyInterface")}
            </small>
          ) : null}
          {error ? <small className="errorText">{error}</small> : null}
        </div>
      </div>
    </header>
  );
}
