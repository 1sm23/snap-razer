import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Analytics } from '@vercel/analytics/next';
import "./App.css";
import { CapabilityMatrix } from "./components/CapabilityMatrix";
import { DebugLog } from "./components/DebugLog";
import { FeaturePanels } from "./components/FeaturePanels";
import { Header } from "./components/Header";
import { toast } from "./components/ui/use-toast";
import { createInitialCapabilities, didAllActiveProbesFail, markWritableInterfaceUnavailable } from "./domain/capabilities";
import { runCapabilityProbe } from "./domain/capabilityProbe";
import type { CapabilityMap, ConnectedDevice, HidLogEntry, LocalizedMessage } from "./domain/types";
import type { BatteryResult, ChargingResult } from "./features/batteryAdapter";
import {
  createDefaultButtonMappings,
  sanitizeButtonMappings,
  updateButtonMapping,
  updateButtonMappingCustomKeys,
  type ButtonMapping
} from "./features/buttonAdapter";
import { writeDpiStages, type DpiStages, type DpiValue } from "./features/dpiAdapter";
import { setPollingRate, type PollingRate } from "./features/pollingRateAdapter";
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
const DPI_APPLY_DEBOUNCE_MS = 120;
const AUTO_CONNECT_BLOCKED_STORAGE_KEY = "snap-razer-auto-connect-blocked";
const BUTTON_MAPPINGS_STORAGE_KEY = "snap-razer-button-mappings";
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
  const [buttonMappings, setButtonMappings] = useState<ButtonMapping[]>(() => readStoredButtonMappings());
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
  const [error, setError] = useState<string | LocalizedMessage | null>(null);
  const autoConnectAttemptedRef = useRef(false);
  const currentDeviceRef = useRef<ConnectedDevice | null>(null);
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

  const connect = useCallback(async (mode: "authorized" | "request", options: { forceSelection?: boolean } = {}): Promise<boolean> => {
    const hasCurrentDevice = currentDeviceRef.current !== null;

    setConnecting(true);
    setError(null);

    try {
      const connected =
        mode === "authorized" ? await transport.openAuthorized() : await transport.requestAndOpen(options);

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

      const probeResult = await runCapabilityProbe(initialCapabilities, transport.command);
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
    const connected = await connect("request", { forceSelection: readAutoConnectBlocked() });
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

  function handleDebugEnabledChange(enabled: boolean) {
    setDebugEnabled(enabled);
    setDebugPanelOpen(false);
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
          applyingDpi={applyingDpi}
          applyingIdleTime={applyingIdleTime}
          applyingLowBatteryThreshold={applyingLowBatteryThreshold}
          applyingPollingRate={applyingPollingRate}
          battery={battery}
          buttonMappings={buttonMappings}
          charging={charging}
          dpi={dpi}
          dpiStages={dpiStages}
          dpiStagesDraft={dpiStagesDraft}
          idleTime={idleTime}
          lowBatteryThreshold={lowBatteryThreshold}
          onApplyDpiStages={handleApplyDpiStages}
          onApplyIdleTime={handleApplyIdleTime}
          onApplyLowBatteryThreshold={handleApplyLowBatteryThreshold}
          onApplyPollingRate={handleApplyPollingRate}
          onButtonMappingChange={handleButtonMappingChange}
          onButtonMappingCustomKeysChange={handleButtonMappingCustomKeysChange}
          onDpiStagesDraftChange={setDpiStagesDraft}
          onResetButtonMappings={handleResetButtonMappings}
          pollingRate={pollingRate}
          supportedPollingRates={supportedPollingRates}
        />
      </section>
      {debugEnabled ? (
        <DebugLog logs={logs} open={debugPanelOpen} onOpenChange={setDebugPanelOpen} />
      ) : null}
      <Analytics />
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

function mergeDpiStagesWithDefaults(dpiStages: DpiStages): DpiStages {
  const probedStagesById = new Map(dpiStages.stages.map((stage) => [stage.id, stage]));
  const stages = DEFAULT_DPI_STAGES.stages.map((defaultStage) => probedStagesById.get(defaultStage.id) ?? {
    ...defaultStage,
    enabled: false
  });
      const activeStage = stages.some((stage) => stage.id === dpiStages.activeStage && isDpiStageEnabled(stage))
    ? dpiStages.activeStage
    : stages.find(isDpiStageEnabled)?.id ?? DEFAULT_DPI_STAGES.activeStage;

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
