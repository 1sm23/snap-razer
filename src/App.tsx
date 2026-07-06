import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import "./App.css";
import { CapabilityMatrix } from "./components/CapabilityMatrix";
import { DebugLog } from "./components/DebugLog";
import { FeaturePanels } from "./components/FeaturePanels";
import { Header } from "./components/Header";
import { toast } from "./components/ui/use-toast";
import {
  createInitialCapabilities,
  didAllActiveProbesFail,
  markWritableInterfaceUnavailable,
  updateCapability
} from "./domain/capabilities";
import { runCapabilityProbe } from "./domain/capabilityProbe";
import type { CapabilityMap, ConnectedDevice, HidLogEntry, LocalizedMessage } from "./domain/types";
import { readBattery, type BatteryResult, type ChargingResult } from "./features/batteryAdapter";
import {
  createDefaultButtonMappings,
  getButtonProtocol,
  writeButtonMappings,
  sanitizeButtonMappings,
  updateButtonMapping,
  updateButtonMappingCustomKeys,
  type ButtonMapping,
  type ButtonProtocol
} from "./features/buttonAdapter";
import { readDpiStages, writeDpiStages, type DpiStages, type DpiValue } from "./features/dpiAdapter";
import { setPollingRate, type PollingRate } from "./features/pollingRateAdapter";
import {
  setDynamicSensitivity,
  setRotation,
  type AdvancedSettings,
  type DynamicSensitivitySettings,
  type RotationSettings
} from "./features/advancedAdapter";
import {
  setIdleTime,
  setLowBatteryThreshold,
  type IdleTimeResult,
  type LowBatteryThresholdResult
} from "./features/powerAdapter";
import { HidTransport } from "./hid/hidTransport";
import { useI18n } from "./i18n";
import type { MessageKey } from "./i18n";
import { isStandaloneApp, type BeforeInstallPromptEvent } from "./pwa";
import {
  readSystemThemeMode,
  readThemeMode,
  resolveThemeMode,
  storeThemeMode,
  type ResolvedThemeMode,
  type ThemeMode
} from "./theme";

const DEFAULT_DPI: DpiValue = { x: 800, y: 800 };
const DEFAULT_DPI_STAGES: DpiStages = {
  activeStage: 2,
  stages: [
    { enabled: true, id: 1, x: 400, y: 400 },
    { enabled: true, id: 2, x: 800, y: 800 },
    { enabled: true, id: 3, x: 1600, y: 1600 },
    { enabled: true, id: 4, x: 3200, y: 3200 },
    { enabled: true, id: 5, x: 6400, y: 6400 }
  ]
};
export const CHARGING_BATTERY_REFRESH_INTERVAL_MS = 30000;
const DPI_APPLY_DEBOUNCE_MS = 120;
const DPI_HARDWARE_SYNC_INTERVAL_MS = 750;
const AUTO_CONNECT_BLOCKED_STORAGE_KEY = "snap-razer-auto-connect-blocked";
const BUTTON_MAPPINGS_STORAGE_KEY = "snap-razer-button-mappings";
const DPI_STAGES_LAYOUT_STORAGE_KEY = "snap-razer-dpi-stages-layout";
type DpiApplyMode = "immediate" | "debounced";

export default function App() {
  const { t } = useI18n();
  const transport = useMemo(() => new HidTransport(), []);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeMode());
  const [systemThemeMode, setSystemThemeMode] = useState<ResolvedThemeMode>(() => readSystemThemeMode());
  const [device, setDevice] = useState<ConnectedDevice | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityMap>(() => createInitialCapabilities());
  const [battery, setBattery] = useState<BatteryResult | null>(null);
  const [charging, setCharging] = useState<ChargingResult | null>(null);
  const [dpi, setDpiValue] = useState<DpiValue | null>(null);
  const [dpiStages, setDpiStages] = useState<DpiStages | null>(null);
  const [dpiStagesDraft, setDpiStagesDraft] = useState<DpiStages>(DEFAULT_DPI_STAGES);
  const [pollingRate, setPollingRateValue] = useState<PollingRate | null>(null);
  const [supportedPollingRates, setSupportedPollingRates] = useState<readonly PollingRate[]>([]);
  const [idleTime, setIdleTimeValue] = useState<IdleTimeResult | null>(null);
  const [lowBatteryThreshold, setLowBatteryThresholdValue] = useState<LowBatteryThresholdResult | null>(null);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings | null>(null);
  const [buttonMappings, setButtonMappings] = useState<ButtonMapping[]>(() => readStoredButtonMappings());
  const [buttonProtocol, setButtonProtocol] = useState<ButtonProtocol>("official-obm");
  const [logs, setLogs] = useState<HidLogEntry[]>([]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => (typeof window === "undefined" ? false : isStandaloneApp()));
  const [connecting, setConnecting] = useState(false);
  const [applyingDpi, setApplyingDpi] = useState(false);
  const [applyingPollingRate, setApplyingPollingRate] = useState(false);
  const [applyingIdleTime, setApplyingIdleTime] = useState(false);
  const [applyingLowBatteryThreshold, setApplyingLowBatteryThreshold] = useState(false);
  const [applyingDynamicSensitivity, setApplyingDynamicSensitivity] = useState(false);
  const [applyingRotation, setApplyingRotation] = useState(false);
  const [applyingButtons, setApplyingButtons] = useState(false);
  const [error, setError] = useState<string | LocalizedMessage | null>(null);
  const autoConnectAttemptedRef = useRef(false);
  const currentDeviceRef = useRef<ConnectedDevice | null>(null);
  const dpiStagesRef = useRef<DpiStages | null>(null);
  const dpiStagesDraftRef = useRef<DpiStages>(DEFAULT_DPI_STAGES);
  const manualCommandInProgressRef = useRef(false);
  const pendingDpiAppliesRef = useRef(0);
  const dpiApplyQueueRef = useRef<Promise<void>>(Promise.resolve());
  const dpiApplyTimerRef = useRef<number | null>(null);
  const pendingDebouncedDpiStagesRef = useRef<DpiStages | null>(null);

  const hidSupported = transport.isSupported();
  const resolvedThemeMode = resolveThemeMode(themeMode, systemThemeMode);

  useEffect(() => {
    storeThemeMode(themeMode);
    document.documentElement.dataset.theme = resolvedThemeMode;
    document.documentElement.style.colorScheme = resolvedThemeMode;
  }, [resolvedThemeMode, themeMode]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const syncSystemTheme = () => {
      setSystemThemeMode(mediaQuery.matches ? "light" : "dark");
    };

    syncSystemTheme();
    mediaQuery.addEventListener("change", syncSystemTheme);

    return () => {
      mediaQuery.removeEventListener("change", syncSystemTheme);
    };
  }, []);

  useEffect(() => {
    currentDeviceRef.current = device;
  }, [device]);

  useEffect(() => {
    dpiStagesRef.current = dpiStages;
  }, [dpiStages]);

  useEffect(() => {
    dpiStagesDraftRef.current = dpiStagesDraft;
  }, [dpiStagesDraft]);

  useEffect(() => {
    manualCommandInProgressRef.current =
      connecting ||
      applyingDpi ||
      applyingPollingRate ||
      applyingIdleTime ||
      applyingLowBatteryThreshold ||
      applyingDynamicSensitivity ||
      applyingRotation ||
      applyingButtons;
  }, [
    applyingDpi,
    applyingDynamicSensitivity,
    applyingIdleTime,
    applyingLowBatteryThreshold,
    applyingPollingRate,
    applyingRotation,
    applyingButtons,
    connecting
  ]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!device?.featureReportProbeAllowed) {
      return;
    }

    let stopped = false;
    let syncInFlight = false;

    const syncDpiStageFromHardware = async () => {
      if (
        stopped ||
        syncInFlight ||
        !dpiStagesRef.current ||
        manualCommandInProgressRef.current ||
        pendingDpiAppliesRef.current > 0
      ) {
        return;
      }

      syncInFlight = true;

      try {
        const hardwareStages = mergeDpiStagesWithDefaults(
          await readDpiStages(transport.command, {
            commandName: "Sync DPI stage",
            log: false
          })
        );

        if (stopped) {
          return;
        }

        const nextDpiStages = syncActiveDpiStageFromHardware(dpiStagesRef.current, hardwareStages);
        const nextDpiStagesDraft = syncActiveDpiStageFromHardware(dpiStagesDraftRef.current, hardwareStages);

        if (nextDpiStages && nextDpiStages !== dpiStagesRef.current) {
          dpiStagesRef.current = nextDpiStages;
          setDpiStages(nextDpiStages);
        }

        if (nextDpiStagesDraft && nextDpiStagesDraft !== dpiStagesDraftRef.current) {
          dpiStagesDraftRef.current = nextDpiStagesDraft;
          setDpiStagesDraft(nextDpiStagesDraft);

          const activeStage = findDpiStageById(nextDpiStagesDraft, nextDpiStagesDraft.activeStage);
          if (activeStage) {
            const activeDpi = { x: activeStage.x, y: activeStage.y };
            setDpiValue(activeDpi);
            setCapabilities((currentCapabilities) =>
              updateCapability(currentCapabilities, "dpi", {
                state: "available",
                detail: { key: "capability.detail.dpi.available", params: activeDpi }
              })
            );
          }
        }
      } catch {
        // Hardware DPI switching is opportunistic. Keep the existing connected state if a background refresh misses.
      } finally {
        syncInFlight = false;
      }
    };

    const intervalId = window.setInterval(syncDpiStageFromHardware, DPI_HARDWARE_SYNC_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [device, transport]);

  useEffect(() => {
    if (!device?.featureReportProbeAllowed || charging?.isCharging !== true) {
      return;
    }

    let stopped = false;
    let refreshInFlight = false;

    const refreshBatteryWhileCharging = async () => {
      if (stopped || refreshInFlight || manualCommandInProgressRef.current) {
        return;
      }

      refreshInFlight = true;

      try {
        const refreshedBattery = await readBattery(transport.command);

        if (stopped) {
          return;
        }

        setBattery(refreshedBattery);
        setLogs(transport.snapshot().logs);
      } catch {
        // Charging refresh is opportunistic. Keep the last known battery value if a background read misses.
      } finally {
        refreshInFlight = false;
      }
    };

    const intervalId = window.setInterval(refreshBatteryWhileCharging, CHARGING_BATTERY_REFRESH_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [charging?.isCharging, device, transport]);

  const connect = useCallback(async (mode: "authorized" | "request"): Promise<boolean> => {
    const hasCurrentDevice = currentDeviceRef.current !== null;

    setConnecting(true);
    setError(null);

    try {
      const connected =
        mode === "authorized" ? await transport.openAuthorized() : await transport.requestAndOpen();

      if (!connected) {
        if (!hasCurrentDevice) {
          transport.clear();
          resetDeviceState(createInitialCapabilities());
        }
        if (mode === "request") {
          setDebugEnabled(true);
          setDebugPanelOpen(true);
        }
        return false;
      }

      const initialCapabilities = createInitialCapabilities();
      resetDeviceState(initialCapabilities);
      setDevice(connected);

      if (!connected.featureReportProbeAllowed) {
        const detail = { key: "error.inputOnlyInterface" } satisfies LocalizedMessage;
        setCapabilities(markWritableInterfaceUnavailable(initialCapabilities, detail));
        setError(detail);
        setDebugEnabled(true);
        setDebugPanelOpen(true);
        return true;
      }

      const connectedButtonProtocol = getButtonProtocol(connected.productId);
      const probeResult = await runCapabilityProbe(initialCapabilities, transport.command, connectedButtonProtocol);
      setButtonProtocol(connectedButtonProtocol);
      setCapabilities(probeResult.capabilities);
      if (didAllActiveProbesFail(probeResult.capabilities)) {
        setError({ key: "error.allActiveProbesFailed" });
        setDebugEnabled(true);
        setDebugPanelOpen(true);
      }
      setBattery(probeResult.battery);
      setCharging(probeResult.charging);
      setDpiValue(probeResult.dpi);
      const dpiStagesWithDefaults = probeResult.dpiStages ? mergeDpiStagesWithDefaults(probeResult.dpiStages) : null;
      setDpiStages(dpiStagesWithDefaults);
      setDpiStagesDraft(dpiStagesWithDefaults ?? DEFAULT_DPI_STAGES);
      setPollingRateValue(probeResult.pollingRate);
      setSupportedPollingRates(probeResult.supportedPollingRates);
      setIdleTimeValue(probeResult.idleTime);
      setLowBatteryThresholdValue(probeResult.lowBatteryThreshold);
      setAdvancedSettings(probeResult.advancedSettings);
      if (probeResult.buttonMappings) {
        setButtonMappings(probeResult.buttonMappings);
        storeButtonMappings(probeResult.buttonMappings);
      }
      setLogs(transport.snapshot().logs);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLogs(transport.snapshot().logs);
      setDebugEnabled(true);
      setDebugPanelOpen(true);
      return false;
    } finally {
      setConnecting(false);
    }
  }, [transport]);

  useEffect(() => {
    if (!hidSupported || autoConnectAttemptedRef.current || readAutoConnectBlocked()) {
      return;
    }

    autoConnectAttemptedRef.current = true;
    void connect("authorized");
  }, [connect, hidSupported]);

  async function handleConnect() {
    const connected = await connect("request");
    if (connected) {
      storeAutoConnectBlocked(false);
    }
  }

  async function handleDisconnect() {
    storeAutoConnectBlocked(true);
    setConnecting(false);
    setError(null);

    try {
      await transport.disconnect();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      resetDeviceState(createInitialCapabilities());
    }
  }

  function resetDeviceState(initialCapabilities: CapabilityMap) {
    if (dpiApplyTimerRef.current) {
      window.clearTimeout(dpiApplyTimerRef.current);
      dpiApplyTimerRef.current = null;
    }
    pendingDebouncedDpiStagesRef.current = null;
    setDevice(null);
    setLogs([]);
    setBattery(null);
    setCharging(null);
    setDpiValue(null);
    setDpiStages(null);
    setDpiStagesDraft(DEFAULT_DPI_STAGES);
    setPollingRateValue(null);
    setSupportedPollingRates([]);
    setIdleTimeValue(null);
    setLowBatteryThresholdValue(null);
    setAdvancedSettings(null);
    setButtonProtocol("official-obm");
    setCapabilities(initialCapabilities);
  }

  function handleToggleTheme(origin: { x: number; y: number }) {
    const nextTheme: ThemeMode = resolvedThemeMode === "dark" ? "light" : "dark";
    const applyTheme = () => {
      flushSync(() => setThemeMode(nextTheme));
    };

    if (
      !document.startViewTransition ||
      (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      applyTheme();
      return;
    }

    const transition = document.startViewTransition(() => {
      applyTheme();
    });

    void transition.ready.then(() => {
      const endRadius = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y)
      );

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${endRadius}px at ${origin.x}px ${origin.y}px)`
          ]
        },
        {
          duration: 520,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)"
        }
      );
    });
  }

  function enqueueDpiStagesApply(nextDpiStages: DpiStages) {
    setDpiStagesDraft(nextDpiStages);
    pendingDpiAppliesRef.current += 1;
    setApplyingDpi(true);
    setError(null);

    const runApply = dpiApplyQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const nextStages = await writeDpiStages(transport.command, nextDpiStages);
          const activeStage = findDpiStageById(nextStages, nextStages.activeStage);
          storeDpiStagesLayout(nextStages);
          setDpiStages(nextStages);
          setDpiStagesDraft((currentStages) =>
            areDpiStagesEqual(currentStages, nextDpiStages) ? nextStages : currentStages
          );
          setDpiValue(activeStage ? { x: activeStage.x, y: activeStage.y } : DEFAULT_DPI);
          setLogs(transport.snapshot().logs);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught));
          setLogs(transport.snapshot().logs);
        } finally {
          pendingDpiAppliesRef.current -= 1;
          if (pendingDpiAppliesRef.current === 0) {
            setApplyingDpi(false);
          }
        }
      });

    dpiApplyQueueRef.current = runApply;
  }

  function handleApplyDpiStages(nextDpiStages: DpiStages, mode: DpiApplyMode = "immediate") {
    setDpiStagesDraft(nextDpiStages);

    if (mode === "debounced") {
      pendingDebouncedDpiStagesRef.current = nextDpiStages;
      if (dpiApplyTimerRef.current) {
        window.clearTimeout(dpiApplyTimerRef.current);
      }
      dpiApplyTimerRef.current = window.setTimeout(() => {
        dpiApplyTimerRef.current = null;
        const pendingStages = pendingDebouncedDpiStagesRef.current;
        pendingDebouncedDpiStagesRef.current = null;
        if (pendingStages) {
          enqueueDpiStagesApply(pendingStages);
        }
      }, DPI_APPLY_DEBOUNCE_MS);
      return;
    }

    if (dpiApplyTimerRef.current) {
      window.clearTimeout(dpiApplyTimerRef.current);
      dpiApplyTimerRef.current = null;
    }
    pendingDebouncedDpiStagesRef.current = null;
    enqueueDpiStagesApply(nextDpiStages);
  }

  async function handleApplyPollingRate(nextPollingRate: PollingRate) {
    setApplyingPollingRate(true);
    setError(null);

    try {
      const appliedPollingRate = await setPollingRate(transport.command, nextPollingRate);
      setPollingRateValue(appliedPollingRate);
      setLogs(transport.snapshot().logs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLogs(transport.snapshot().logs);
    } finally {
      setApplyingPollingRate(false);
    }
  }

  async function handleApplyIdleTime(minutes: number) {
    setApplyingIdleTime(true);
    setError(null);

    try {
      const appliedIdleTime = await setIdleTime(transport.command, minutes);
      setIdleTimeValue(appliedIdleTime);
      setLogs(transport.snapshot().logs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLogs(transport.snapshot().logs);
    } finally {
      setApplyingIdleTime(false);
    }
  }

  async function handleApplyLowBatteryThreshold(percent: number) {
    setApplyingLowBatteryThreshold(true);
    setError(null);

    try {
      const appliedLowBatteryThreshold = await setLowBatteryThreshold(transport.command, percent);
      setLowBatteryThresholdValue(appliedLowBatteryThreshold);
      setLogs(transport.snapshot().logs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLogs(transport.snapshot().logs);
    } finally {
      setApplyingLowBatteryThreshold(false);
    }
  }

  async function handleApplyDynamicSensitivity(nextSettings: DynamicSensitivitySettings) {
    setApplyingDynamicSensitivity(true);
    setError(null);

    try {
      const appliedDynamicSensitivity = await setDynamicSensitivity(transport.command, nextSettings);
      setAdvancedSettings((currentSettings) =>
        currentSettings ? { ...currentSettings, dynamicSensitivity: appliedDynamicSensitivity } : null
      );
      setLogs(transport.snapshot().logs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLogs(transport.snapshot().logs);
    } finally {
      setApplyingDynamicSensitivity(false);
    }
  }

  async function handleApplyRotation(nextSettings: RotationSettings) {
    setApplyingRotation(true);
    setError(null);

    try {
      const appliedRotation = await setRotation(transport.command, nextSettings);
      setAdvancedSettings((currentSettings) =>
        currentSettings ? { ...currentSettings, rotation: appliedRotation } : null
      );
      setLogs(transport.snapshot().logs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLogs(transport.snapshot().logs);
    } finally {
      setApplyingRotation(false);
    }
  }

  async function handleApplyButtonMappings() {
    setApplyingButtons(true);
    setError(null);

    try {
      const appliedMappings = await writeButtonMappings(transport.command, buttonMappings, buttonProtocol);
      setButtonMappings(appliedMappings);
      storeButtonMappings(appliedMappings);
      setLogs(transport.snapshot().logs);
      toast({
        description: t("buttonMap.appliedDescription"),
        title: t("buttonMap.applied")
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLogs(transport.snapshot().logs);
      setDebugEnabled(true);
      setDebugPanelOpen(true);
    } finally {
      setApplyingButtons(false);
    }
  }

  function handleDebugEnabledChange(enabled: boolean) {
    setDebugEnabled(enabled);
    setDebugPanelOpen(false);
  }

  function handleClearLogs() {
    transport.clearLogs();
    setLogs([]);
  }

  async function handleInstallApp() {
    if (!installPrompt) {
      toast({
        title: t("settings.installAppUnavailable")
      });
      return;
    }

    const promptEvent = installPrompt;
    setInstallPrompt(null);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
      toast({
        title: t("settings.installAppSuccess")
      });
    }
  }

  function handleButtonMappingChange(buttonId: string, action: ButtonMapping["action"]) {
    setButtonMappings((currentMappings) => {
      const nextMappings = updateButtonMapping(currentMappings, buttonId, action);
      storeButtonMappings(nextMappings);
      return nextMappings;
    });
    toast({
      description: t("buttonMap.savedDraftDescription"),
      title: t("buttonMap.savedDraft")
    });
  }

  function handleButtonMappingCustomKeysChange(buttonId: string, customKeys: string) {
    setButtonMappings((currentMappings) => {
      const nextMappings = updateButtonMappingCustomKeys(currentMappings, buttonId, customKeys);
      storeButtonMappings(nextMappings);
      return nextMappings;
    });
  }

  function handleResetButtonMappings() {
    const nextMappings = createDefaultButtonMappings();
    storeButtonMappings(nextMappings);
    setButtonMappings(nextMappings);
    toast({
      description: t("buttonMap.savedDraftDescription"),
      title: t("buttonMap.resetDraft")
    });
  }

  return (
    <main className="appShell">
      <Header
        battery={battery}
        charging={charging}
        device={device}
        hidSupported={hidSupported}
        connecting={connecting}
        error={formatError(error, t)}
        themeMode={themeMode}
        resolvedThemeMode={resolvedThemeMode}
        debugEnabled={debugEnabled}
        installAvailable={!installed}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onDebugEnabledChange={handleDebugEnabledChange}
        onInstallApp={handleInstallApp}
        onThemeModeChange={setThemeMode}
        onToggleTheme={handleToggleTheme}
      />
      <section className="consoleGrid">
        <CapabilityMatrix capabilities={capabilities} />
        <FeaturePanels
          advancedSettings={advancedSettings}
          applyingDpi={applyingDpi}
          applyingDynamicSensitivity={applyingDynamicSensitivity}
          applyingIdleTime={applyingIdleTime}
          applyingLowBatteryThreshold={applyingLowBatteryThreshold}
          applyingPollingRate={applyingPollingRate}
          applyingRotation={applyingRotation}
          applyingButtons={applyingButtons}
          battery={battery}
          buttonMappings={buttonMappings}
          charging={charging}
          dpi={dpi}
          dpiStages={dpiStages}
          dpiStagesDraft={dpiStagesDraft}
          idleTime={idleTime}
          lowBatteryThreshold={lowBatteryThreshold}
          onApplyDpiStages={handleApplyDpiStages}
          onApplyDynamicSensitivity={handleApplyDynamicSensitivity}
          onApplyIdleTime={handleApplyIdleTime}
          onApplyLowBatteryThreshold={handleApplyLowBatteryThreshold}
          onApplyPollingRate={handleApplyPollingRate}
          onApplyRotation={handleApplyRotation}
          onApplyButtonMappings={handleApplyButtonMappings}
          onButtonMappingChange={handleButtonMappingChange}
          onButtonMappingCustomKeysChange={handleButtonMappingCustomKeysChange}
          onDpiStagesDraftChange={setDpiStagesDraft}
          onResetButtonMappings={handleResetButtonMappings}
          pollingRate={pollingRate}
          buttonsAvailable={capabilities.buttons.state === "available"}
          supportedPollingRates={supportedPollingRates}
        />
      </section>
      {debugEnabled ? (
        <DebugLog logs={logs} open={debugPanelOpen} onClear={handleClearLogs} onOpenChange={setDebugPanelOpen} />
      ) : null}
      <Analytics />
      <SpeedInsights />
    </main>
  );
}

function areDpiStagesEqual(left: DpiStages, right: DpiStages): boolean {
  return (
    left.activeStage === right.activeStage &&
    left.stages.length === right.stages.length &&
    left.stages.every((stage, index) => {
      const other = right.stages[index];
      return (
        other !== undefined &&
        stage.enabled === other.enabled &&
        stage.id === other.id &&
        stage.x === other.x &&
        stage.y === other.y
      );
    })
  );
}

function findDpiStageById(dpiStages: DpiStages, stageId: number) {
  return dpiStages.stages.find((stage) => stage.id === stageId && isDpiStageEnabled(stage)) ?? null;
}

export function mergeDpiStagesWithDefaults(dpiStages: DpiStages, storedLayout = readStoredDpiStagesLayout()): DpiStages {
  const restoredStages = restoreDpiStagesFromStoredLayout(dpiStages, storedLayout);

  if (restoredStages) {
    return restoredStages;
  }

  const probedStagesById = new Map(dpiStages.stages.map((stage) => [stage.id, stage]));
  const stages = DEFAULT_DPI_STAGES.stages.map((defaultStage) =>
    probedStagesById.get(defaultStage.id) ?? {
      ...defaultStage,
      enabled: false
    }
  );
  const activeStage = stages.some((stage) => stage.id === dpiStages.activeStage && isDpiStageEnabled(stage))
    ? dpiStages.activeStage
    : stages.find(isDpiStageEnabled)?.id ?? DEFAULT_DPI_STAGES.activeStage;

  return { activeStage, stages };
}

export function syncActiveDpiStageFromHardware(
  currentStages: DpiStages | null,
  hardwareStages: DpiStages
): DpiStages | null {
  if (!currentStages) {
    return hardwareStages;
  }

  if (currentStages.activeStage === hardwareStages.activeStage) {
    return currentStages;
  }

  const stageExists = currentStages.stages.some(
    (stage) => stage.id === hardwareStages.activeStage && isDpiStageEnabled(stage)
  );

  return stageExists ? { ...currentStages, activeStage: hardwareStages.activeStage } : currentStages;
}

function restoreDpiStagesFromStoredLayout(dpiStages: DpiStages, storedLayout: DpiStages | null): DpiStages | null {
  if (!storedLayout) {
    return null;
  }

  const storedEnabledStages = storedLayout.stages.filter(isDpiStageEnabled);

  if (storedEnabledStages.length !== dpiStages.stages.length) {
    return null;
  }

  let probedStageIndex = 0;
  const stages = storedLayout.stages.map((storedStage) => {
    if (!isDpiStageEnabled(storedStage)) {
      return storedStage;
    }

    const probedStage = dpiStages.stages[probedStageIndex];
    probedStageIndex += 1;

    return {
      ...storedStage,
      enabled: true,
      x: probedStage.x,
      y: probedStage.y
    };
  });
  const activeStage =
    storedEnabledStages[dpiStages.activeStage - 1]?.id ?? stages.find(isDpiStageEnabled)?.id ?? DEFAULT_DPI_STAGES.activeStage;

  return { activeStage, stages };
}

function isDpiStageEnabled(stage: DpiStages["stages"][number]): boolean {
  return stage.enabled ?? true;
}

function formatError(
  error: string | LocalizedMessage | null,
  translate: (key: MessageKey, params?: LocalizedMessage["params"]) => string
): string | null {
  if (!error) {
    return null;
  }

  return typeof error === "string" ? error : translate(error.key, error.params);
}

function readStoredButtonMappings(): ButtonMapping[] {
  if (typeof window === "undefined") {
    return createDefaultButtonMappings();
  }

  try {
    const storedValue = window.localStorage.getItem(BUTTON_MAPPINGS_STORAGE_KEY);
    return sanitizeButtonMappings(storedValue ? JSON.parse(storedValue) : null);
  } catch {
    return createDefaultButtonMappings();
  }
}

export function readStoredDpiStagesLayout(): DpiStages | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(DPI_STAGES_LAYOUT_STORAGE_KEY);
    return storedValue ? sanitizeDpiStagesLayout(JSON.parse(storedValue)) : null;
  } catch {
    return null;
  }
}

export function storeDpiStagesLayout(dpiStages: DpiStages): void {
  if (typeof window === "undefined") {
    return;
  }

  const sanitizedLayout = sanitizeDpiStagesLayout(dpiStages);

  if (!sanitizedLayout) {
    return;
  }

  window.localStorage.setItem(DPI_STAGES_LAYOUT_STORAGE_KEY, JSON.stringify(sanitizedLayout));
}

export function readAutoConnectBlocked(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(AUTO_CONNECT_BLOCKED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function storeAutoConnectBlocked(blocked: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (blocked) {
      window.localStorage.setItem(AUTO_CONNECT_BLOCKED_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(AUTO_CONNECT_BLOCKED_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures; connection controls should still work in private or restricted contexts.
  }
}

function storeButtonMappings(buttonMappings: readonly ButtonMapping[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(BUTTON_MAPPINGS_STORAGE_KEY, JSON.stringify(buttonMappings));
}

function sanitizeDpiStagesLayout(value: unknown): DpiStages | null {
  if (!isRecord(value) || !Array.isArray(value.stages)) {
    return null;
  }

  const stagesById = new Map<number, unknown>();

  for (const stage of value.stages) {
    if (isRecord(stage) && isPositiveInteger(stage.id)) {
      stagesById.set(stage.id, stage);
    }
  }

  const stages: DpiStages["stages"] = [];

  for (const defaultStage of DEFAULT_DPI_STAGES.stages) {
    const storedStage = stagesById.get(defaultStage.id);

    if (!isRecord(storedStage)) {
      return null;
    }

    const enabled = storedStage.enabled === undefined ? true : storedStage.enabled;

    if (typeof enabled !== "boolean" || !isDpiValue(storedStage.x) || !isDpiValue(storedStage.y)) {
      return null;
    }

    stages.push({
      enabled,
      id: defaultStage.id,
      x: storedStage.x,
      y: storedStage.y
    });
  }

  const activeStage = isPositiveInteger(value.activeStage)
    ? value.activeStage
    : DEFAULT_DPI_STAGES.activeStage;
  const resolvedActiveStage = stages.some((stage) => stage.id === activeStage && isDpiStageEnabled(stage))
    ? activeStage
    : stages.find(isDpiStageEnabled)?.id;

  return resolvedActiveStage ? { activeStage: resolvedActiveStage, stages } : null;
}

function isDpiValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 45000;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
