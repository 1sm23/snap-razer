import rotateCcwIcon from "@iconify-icons/lucide/rotate-ccw";
import { Icon } from "@iconify/react";
import { flushSync } from "react-dom";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  DYNAMIC_SENSITIVITY_MODES,
  type AdvancedSettings,
  type DynamicSensitivityMode,
  type DynamicSensitivitySettings,
  type RotationSettings
} from "../features/advancedAdapter";
import type { BatteryResult, ChargingResult } from "../features/batteryAdapter";
import {
  BUTTON_ACTION_OPTIONS,
  BUTTON_DEFINITIONS,
  type ButtonMapping
} from "../features/buttonAdapter";
import type { DpiStage, DpiStages, DpiValue } from "../features/dpiAdapter";
import type { PollingRate } from "../features/pollingRateAdapter";
import type { IdleTimeResult, LowBatteryThresholdResult } from "../features/powerAdapter";
import { useI18n, type MessageKey } from "../i18n";
import { cn } from "../lib/utils";
import rotationMouseIcon from "../assets/rotation-mouse.svg";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type ControlTab = "customize" | "performance" | "power" | "advanced";
type DpiAxis = "x" | "y";

const tabs: Array<{ id: ControlTab; labelKey: MessageKey }> = [
  { id: "customize", labelKey: "controls.customize" },
  { id: "performance", labelKey: "controls.performance" },
  { id: "power", labelKey: "controls.power" },
  { id: "advanced", labelKey: "controls.advanced" }
];

const DPI_MIN = 100;
const DPI_MAX = 45000;
const DPI_SLIDER_MAX = 35000;
const DPI_STAGE_SWATCHES = [
  "#ff1a1a",
  "#24ff00",
  "#006fff",
  "#00edff",
  "#fff700"
] as const;
const MOUSE_TEST_WINDOW_MS = 1000;
const MOUSE_TEST_HISTORY_MAX = 80;
const MOUSE_TEST_MAX_DOTS = 50;
const ROTATION_MIN = -44;
const ROTATION_MAX = 44;
const DYNAMIC_CURVE_X_MAX = 70;
const DYNAMIC_CURVE_Y_MIN = 0.98;
const DYNAMIC_CURVE_Y_MAX = 1.62;
interface DynamicSensitivityCurvePoint {
  x: number;
  y: number;
}

const DYNAMIC_SENSITIVITY_CURVES: Record<DynamicSensitivityMode, DynamicSensitivityCurvePoint[]> = {
  classic: [
    { x: 0, y: 1 },
    { x: 10, y: 1.04 },
    { x: 20, y: 1.09 },
    { x: 30, y: 1.14 },
    { x: 40, y: 1.19 },
    { x: 50, y: 1.24 },
    { x: 60, y: 1.29 },
    { x: 70, y: 1.35 }
  ],
  natural: [
    { x: 0, y: 1 },
    { x: 3, y: 1.14 },
    { x: 6, y: 1.29 },
    { x: 9, y: 1.41 },
    { x: 12, y: 1.46 },
    { x: 16, y: 1.49 },
    { x: 20, y: 1.5 },
    { x: 70, y: 1.5 }
  ],
  jump: [
    { x: 0, y: 1 },
    { x: 10, y: 1 },
    { x: 12, y: 1.04 },
    { x: 14, y: 1.15 },
    { x: 16, y: 1.3 },
    { x: 18, y: 1.43 },
    { x: 20, y: 1.5 },
    { x: 70, y: 1.5 }
  ],
  custom: [
    { x: 0, y: 1 },
    { x: 10, y: 1.04 },
    { x: 20, y: 1.09 },
    { x: 30, y: 1.14 },
    { x: 40, y: 1.19 },
    { x: 50, y: 1.24 },
    { x: 60, y: 1.29 },
    { x: 70, y: 1.35 }
  ]
};
const DYNAMIC_SENSITIVITY_TEMPLATE_OPTIONS = ["classic", "natural", "jump", "none"] as const;
type DynamicSensitivityTemplate = (typeof DYNAMIC_SENSITIVITY_TEMPLATE_OPTIONS)[number];
const DYNAMIC_SENSITIVITY_TEMPLATE_CURVES: Record<DynamicSensitivityTemplate, DynamicSensitivityCurvePoint[]> = {
  classic: DYNAMIC_SENSITIVITY_CURVES.classic,
  natural: DYNAMIC_SENSITIVITY_CURVES.natural,
  jump: DYNAMIC_SENSITIVITY_CURVES.jump,
  none: [
    { x: 0, y: 1 },
    { x: 70, y: 1 }
  ]
};

interface MouseTestStats {
  intervalUs: number | null;
  jitter: number | null;
  peak: number | null;
  rate: number | null;
  speed: number;
  x: number;
  y: number;
}

interface FeaturePanelsProps {
  advancedSettings?: AdvancedSettings | null;
  battery: BatteryResult | null;
  buttonMappings?: readonly ButtonMapping[];
  charging: ChargingResult | null;
  dpi: DpiValue | null;
  dpiStages: DpiStages | null;
  dpiStagesDraft: DpiStages;
  pollingRate: PollingRate | null;
  supportedPollingRates: readonly PollingRate[];
  applyingDpi: boolean;
  applyingDynamicSensitivity?: boolean;
  applyingIdleTime?: boolean;
  applyingLowBatteryThreshold?: boolean;
  applyingPollingRate: boolean;
  applyingRotation?: boolean;
  initialTab?: ControlTab;
  idleTime?: IdleTimeResult | null;
  lowBatteryThreshold?: LowBatteryThresholdResult | null;
  onDpiStagesDraftChange: (dpiStages: DpiStages) => void;
  onApplyDpiStages: (dpiStages: DpiStages, mode?: "immediate" | "debounced") => void;
  onApplyDynamicSensitivity?: (settings: DynamicSensitivitySettings) => void;
  onApplyIdleTime?: (minutes: number) => void;
  onApplyLowBatteryThreshold?: (percent: number) => void;
  onApplyPollingRate: (pollingRate: PollingRate) => void;
  onApplyRotation?: (settings: RotationSettings) => void;
  onButtonMappingChange?: (buttonId: string, action: ButtonMapping["action"]) => void;
  onButtonMappingCustomKeysChange?: (buttonId: string, customKeys: string) => void;
  onResetButtonMappings?: () => void;
}

export function FeaturePanels({
  advancedSettings = null,
  battery,
  buttonMappings = BUTTON_DEFINITIONS.map((definition) => definition.defaultMapping),
  charging,
  dpi,
  dpiStages,
  dpiStagesDraft,
  pollingRate,
  supportedPollingRates,
  applyingDpi,
  applyingDynamicSensitivity = false,
  applyingIdleTime = false,
  applyingLowBatteryThreshold = false,
  applyingPollingRate,
  applyingRotation = false,
  initialTab = "performance",
  idleTime = null,
  lowBatteryThreshold = null,
  onDpiStagesDraftChange,
  onApplyDpiStages,
  onApplyDynamicSensitivity = () => undefined,
  onApplyIdleTime = () => undefined,
  onApplyLowBatteryThreshold = () => undefined,
  onApplyPollingRate,
  onApplyRotation = () => undefined,
  onButtonMappingChange = () => undefined,
  onButtonMappingCustomKeysChange = () => undefined,
  onResetButtonMappings = () => undefined
}: FeaturePanelsProps) {
  const [activeTab, setActiveTab] = useState<ControlTab>(initialTab);
  const dpiStagesDraftRef = useRef(dpiStagesDraft);
  const { t } = useI18n();

  useEffect(() => {
    dpiStagesDraftRef.current = dpiStagesDraft;
  }, [dpiStagesDraft]);

  const setDpiStagesDraft = (nextStages: DpiStages) => {
    dpiStagesDraftRef.current = nextStages;
    onDpiStagesDraftChange(nextStages);
  };

  const updateDpiStageValue = (stageId: number, axis: DpiAxis, value: number, splitAxes: boolean): DpiStages => ({
    ...dpiStagesDraftRef.current,
    activeStage: stageId,
    stages: dpiStagesDraftRef.current.stages.map((item) =>
      item.id === stageId
        ? splitAxes
          ? { ...enableDpiStage(item), [axis]: value }
          : { ...enableDpiStage(item), x: value, y: value }
        : item
    )
  });

  const setDpiStageSplitAxes = (stageId: number, enabled: boolean): void => {
    if (enabled) {
      return;
    }

    const nextStages = {
      ...dpiStagesDraftRef.current,
      activeStage: stageId,
      stages: dpiStagesDraftRef.current.stages.map((item) =>
        item.id === stageId ? { ...enableDpiStage(item), y: item.x } : item
      )
    };

    setDpiStagesDraft(nextStages);
    onApplyDpiStages(nextStages);
  };

  const activateDpiStage = (stageId: number) => {
    const stage = findDpiStage(dpiStagesDraftRef.current, stageId);

    if (!stage || !isDpiStageEnabled(stage) || dpiStagesDraftRef.current.activeStage === stageId) {
      return;
    }

    const nextStages = { ...dpiStagesDraftRef.current, activeStage: stageId };
    setDpiStagesDraft(nextStages);
    onApplyDpiStages(nextStages);
  };

  const setDpiStageEnabled = (stageId: number, enabled: boolean): void => {
    const currentStages = dpiStagesDraftRef.current;
    const targetStage = findDpiStage(currentStages, stageId);

    if (!targetStage || isDpiStageEnabled(targetStage) === enabled) {
      return;
    }

    if (!enabled && enabledDpiStages(currentStages).length <= 1) {
      return;
    }

    const stages = currentStages.stages.map((stage) => (stage.id === stageId ? { ...stage, enabled } : stage));
    const activeStage =
      enabled || currentStages.activeStage !== stageId
        ? currentStages.activeStage
        : stages.find(isDpiStageEnabled)?.id ?? stageId;
    const nextStages = { ...currentStages, activeStage, stages };

    setDpiStagesDraft(nextStages);
    onApplyDpiStages(nextStages);
  };

  const enabledStagesInDraft = enabledDpiStages(dpiStagesDraft);

  return (
    <Card className="featurePanel">
      <CardHeader>
        <CardTitle>{t("controls.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ControlTab)}>
          <TabsList aria-label={t("controls.sections")}>
            {tabs.map((tab) => (
              <TabsTrigger id={`${tab.id}-tab`} key={tab.id} value={tab.id}>
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent
            aria-labelledby="customize-tab"
            className="controlSections"
            id="customize-panel"
            value="customize"
          >
            <ControlTile className="buttonMappingPanel" eyebrow={t("customize.buttons")}>
              <div className="buttonMappingHeader">
                <div>
                  <div className="buttonMappingTitleLine">
                    <strong>{t("buttonMap.title")}</strong>
                    <span className="buttonMappingMode">{t("buttonMap.localDraft")}</span>
                  </div>
                  <p>{t("buttonMap.description")}</p>
                </div>
                <div className="buttonMappingActions">
                  <Button type="button" variant="outline" onClick={onResetButtonMappings}>
                    {t("buttonMap.reset")}
                  </Button>
                  <Button disabled type="button">
                    {t("buttonMap.applyUnavailable")}
                  </Button>
                </div>
              </div>
              <div className="buttonMappingNotice">{t("buttonMap.firmwareNotice")}</div>
              <div className="buttonMappingList">
                {BUTTON_DEFINITIONS.map((definition) => {
                  const mapping =
                    buttonMappings.find((item) => item.buttonId === definition.id) ?? definition.defaultMapping;

                  return (
                    <ButtonMappingRow
                      buttonLabel={t(definition.labelKey)}
                      key={definition.id}
                      mapping={mapping}
                      onActionChange={(action) => onButtonMappingChange(definition.id, action)}
                      onCustomKeysChange={(customKeys) =>
                        onButtonMappingCustomKeysChange(definition.id, customKeys)
                      }
                    />
                  );
                })}
              </div>
            </ControlTile>
          </TabsContent>

          <TabsContent
            aria-labelledby="performance-tab"
            className="controlSections"
            id="performance-panel"
            value="performance"
          >
            <div className="performanceStack">
              <ControlTile className="sensitivityPanel" disabled={!dpiStages} eyebrow={t("performance.sensitivity")}>
                <div className="panelHeaderLine">
                  <div>
                    <p>{t("performance.sensitivityDescription")}</p>
                  </div>
                </div>
                <div aria-busy={applyingDpi} className="dpiStageList">
                  {dpiStagesDraft.stages.map((stage) => {
                    const stageEnabled = isDpiStageEnabled(stage);
                    const enabledStageCount = enabledStagesInDraft.length;
                    const stageColorIndex = stageEnabled
                      ? enabledStagesInDraft.findIndex((enabledStage) => enabledStage.id === stage.id)
                      : null;

                    return (
                      <DpiStageRow
                        controlsDisabled={!dpiStages || !stageEnabled}
                        isActive={dpiStagesDraft.activeStage === stage.id}
                        key={stage.id}
                        stage={stage}
                        stageColorIndex={stageColorIndex}
                        switchDisabled={!dpiStages || (stageEnabled && enabledStageCount <= 1)}
                        onActivate={() => activateDpiStage(stage.id)}
                        onChange={(axis, value, splitAxes) => {
                          const nextStages = updateDpiStageValue(stage.id, axis, value, splitAxes);
                          setDpiStagesDraft(nextStages);
                          onApplyDpiStages(nextStages, "debounced");
                        }}
                        onCommit={(axis, value, splitAxes) => {
                          const nextStages = updateDpiStageValue(stage.id, axis, value, splitAxes);
                          setDpiStagesDraft(nextStages);
                          onApplyDpiStages(nextStages);
                        }}
                        onEnabledChange={(enabled) => setDpiStageEnabled(stage.id, enabled)}
                        onSplitAxesChange={(enabled) => setDpiStageSplitAxes(stage.id, enabled)}
                      />
                    );
                  })}
                </div>
                <p>{dpi ? t("performance.currentDpi", { x: dpi.x, y: dpi.y }) : t("performance.dpiProbeFailed")}</p>
              </ControlTile>

              <ControlTile disabled={!pollingRate} eyebrow={t("performance.pollingRate")}>
                <p>{t("performance.pollingRateDescription")}</p>
                <div className="rateGrid">
                  {supportedPollingRates.map((rate) => (
                    <Button
                      aria-pressed={pollingRate === rate}
                      className={pollingRate === rate ? "rateButton active" : "rateButton"}
                      disabled={!pollingRate || applyingPollingRate}
                      key={rate}
                      type="button"
                      variant="outline"
                      onClick={() => onApplyPollingRate(rate)}
                    >
                      {rate} Hz
                    </Button>
                  ))}
                </div>
                <div className="gamePolling">
                  <strong>{t("performance.inGamePollingRate")}</strong>
                  <Switch aria-disabled="true" aria-label={t("performance.inGamePollingRate")} tabIndex={-1} />
                </div>
                <p>
                  {pollingRate
                    ? t("performance.pollingFullscreenUnavailable")
                    : t("performance.pollingProbeFailed")}
                </p>
              </ControlTile>

              <ControlTile disabled eyebrow={t("performance.mouseProperties")} title={t("performance.systemSetting")}>
                {t("performance.mousePropertiesDescription")}
              </ControlTile>

              <MouseTestPanel />
            </div>
          </TabsContent>

          <TabsContent aria-labelledby="power-tab" className="controlSections" id="power-panel" value="power">
            <div className="controlGrid">
              <ControlTile
                eyebrow={t("power.battery")}
                title={battery ? `${battery.percent}%` : t("power.notAvailable")}
              >
                {battery ? t("power.rawValue", { value: battery.rawBattery }) : t("power.connectWirelessDevice")}
              </ControlTile>
              <ControlTile
                eyebrow={t("power.charging")}
                title={
                  charging
                    ? charging.isCharging
                      ? t("power.isCharging")
                      : t("power.notCharging")
                    : t("power.notAvailable")
                }
              >
                {charging ? t("power.rawValue", { value: charging.rawCharging }) : t("power.chargingNotConfirmed")}
              </ControlTile>
              <ControlTile disabled={!idleTime} eyebrow={t("power.wirelessPowerSaving")}>
                <PowerSlider
                  ariaLabel={t("power.wirelessPowerSaving")}
                  disabled={!idleTime || applyingIdleTime}
                  max={15}
                  min={1}
                  step={1}
                  unit={t("power.minutesUnit")}
                  value={idleTime?.minutes ?? 5}
                  onCommit={onApplyIdleTime}
                />
                <p>{idleTime ? t("power.wirelessPowerSavingDescription") : t("power.wirelessPowerSavingProbeFailed")}</p>
              </ControlTile>
              <ControlTile disabled={!lowBatteryThreshold} eyebrow={t("power.lowPowerMode")}>
                <PowerSlider
                  ariaLabel={t("power.lowPowerMode")}
                  disabled={!lowBatteryThreshold || applyingLowBatteryThreshold}
                  max={100}
                  min={5}
                  step={1}
                  unit="%"
                  value={lowBatteryThreshold?.percent ?? 30}
                  onCommit={onApplyLowBatteryThreshold}
                />
                <p>{lowBatteryThreshold ? t("power.lowPowerModeDescription") : t("power.lowPowerModeProbeFailed")}</p>
              </ControlTile>
            </div>
          </TabsContent>

          <TabsContent
            aria-labelledby="advanced-tab"
            className="controlSections"
            id="advanced-panel"
            value="advanced"
          >
            <div className="advancedStack">
              <DynamicSensitivityPanel
                applying={applyingDynamicSensitivity}
                settings={advancedSettings?.dynamicSensitivity ?? null}
                onApply={onApplyDynamicSensitivity}
              />
              <RotationPanel
                applying={applyingRotation}
                settings={advancedSettings?.rotation ?? null}
                onApply={onApplyRotation}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DynamicSensitivityPanel({
  applying,
  settings,
  onApply
}: {
  applying: boolean;
  settings: DynamicSensitivitySettings | null;
  onApply: (settings: DynamicSensitivitySettings) => void;
}) {
  const { t } = useI18n();
  const [customTemplate, setCustomTemplate] = useState<DynamicSensitivityTemplate>("classic");
  const disabled = !settings || applying;
  const selectedMode = settings?.mode ?? "classic";
  const curveValues =
    selectedMode === "custom"
      ? DYNAMIC_SENSITIVITY_TEMPLATE_CURVES[customTemplate]
      : DYNAMIC_SENSITIVITY_CURVES[selectedMode];

  const applySettings = (patch: Partial<DynamicSensitivitySettings>) => {
    if (!settings) {
      return;
    }

    onApply({ ...settings, ...patch });
  };

  return (
    <ControlTile
      className="dynamicSensitivityPanel"
      disabled={!settings}
      eyebrow={t("advanced.dynamicSensitivity")}
    >
      <div className="advancedHeader">
        <p>{settings ? t("advanced.dynamicSensitivityDescription") : t("advanced.probeFailed")}</p>
        <Switch
          aria-label={t("advanced.dynamicSensitivity")}
          checked={settings?.enabled ?? false}
          disabled={disabled}
          onClick={() => applySettings({ enabled: !settings?.enabled })}
        />
      </div>
      <div className="dynamicModeGrid">
        {DYNAMIC_SENSITIVITY_MODES.map((mode) => (
          <Button
            aria-pressed={selectedMode === mode}
            className={selectedMode === mode ? "dynamicModeButton active" : "dynamicModeButton"}
            disabled={disabled || !settings?.enabled}
            key={mode}
            type="button"
            variant="outline"
            onClick={() => applySettings({ enabled: true, mode })}
          >
            {t(`advanced.dynamicSensitivity.${mode}` as MessageKey)}
          </Button>
        ))}
      </div>
      {selectedMode === "custom" ? (
        <label className="dynamicTemplateSelect">
          <span>{t("advanced.dynamicSensitivity.template")}</span>
          <Select
            disabled={disabled || !settings?.enabled}
            value={customTemplate}
            onValueChange={(value) => setCustomTemplate(value as DynamicSensitivityTemplate)}
          >
            <SelectTrigger aria-label={t("advanced.dynamicSensitivity.template")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DYNAMIC_SENSITIVITY_TEMPLATE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "none"
                    ? t("advanced.dynamicSensitivity.template.none")
                    : t(`advanced.dynamicSensitivity.${option}` as MessageKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}
      <DynamicSensitivityCurve values={curveValues} />
    </ControlTile>
  );
}

function DynamicSensitivityCurve({ values }: { values: readonly DynamicSensitivityCurvePoint[] }) {
  const { t } = useI18n();
  const svgPoints = values
    .map((point) => {
      const x = (clampNumber(point.x, 0, DYNAMIC_CURVE_X_MAX) / DYNAMIC_CURVE_X_MAX) * 100;
      const y =
        ((DYNAMIC_CURVE_Y_MAX - clampCurveValue(point.y)) / (DYNAMIC_CURVE_Y_MAX - DYNAMIC_CURVE_Y_MIN)) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `0,100 ${svgPoints} 100,100`;

  return (
    <div className="dynamicCurve" role="img" aria-label={t("advanced.dynamicSensitivity.curvePreview")}>
      <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points={areaPoints} />
        <polyline points={svgPoints} />
      </svg>
    </div>
  );
}

function RotationPanel({
  applying,
  settings,
  onApply
}: {
  applying: boolean;
  settings: RotationSettings | null;
  onApply: (settings: RotationSettings) => void;
}) {
  const { t } = useI18n();
  const [draftAngle, setDraftAngle] = useState(settings?.angle ?? 0);
  const disabled = !settings || applying;

  useEffect(() => {
    setDraftAngle(settings?.angle ?? 0);
  }, [settings?.angle]);

  const applySettings = (patch: Partial<RotationSettings>) => {
    if (!settings) {
      return;
    }

    onApply({ ...settings, ...patch });
  };

  const commitAngle = () => {
    if (!settings) {
      return;
    }

    const nextAngle = clampNumber(draftAngle, ROTATION_MIN, ROTATION_MAX);
    setDraftAngle(nextAngle);
    if (nextAngle !== settings.angle) {
      applySettings({ angle: nextAngle });
    }
  };

  const sliderProgress = `${((draftAngle - ROTATION_MIN) / (ROTATION_MAX - ROTATION_MIN)) * 100}%`;
  const rotationStyle = {
    "--rotation-angle": `${draftAngle}deg`,
    "--slider-progress": sliderProgress
  } as CSSProperties;

  return (
    <Card className={cn("controlTile", !settings && "disabledTile", "rotationPanel")}>
      <div className="rotationTitleRow">
        <span className="rotationTitle">{t("advanced.rotation")}</span>
        <Switch
          aria-label={t("advanced.rotation")}
          checked={settings?.enabled ?? false}
          disabled={disabled}
          onClick={() => applySettings({ enabled: !settings?.enabled })}
        />
      </div>
      <p className="rotationDescription">
        {settings ? (
          <>
            {t("advanced.rotationDescription")} {t("advanced.rotationDetails")}{" "}
            <a
              className="rotationToolLink"
              href="https://www.razer.com/technology/mouse-rotation-tool"
              rel="noreferrer"
              target="_blank"
            >
              {t("advanced.rotationToolLink")}
            </a>
          </>
        ) : (
          t("advanced.probeFailed")
        )}
      </p>
      <div
        className="rotationPreview"
        style={rotationStyle}
        role="img"
        aria-label={t("advanced.rotationPreview", { angle: draftAngle })}
      >
        <div className="rotationAxis rotationAxisHorizontal" />
        <div className="rotationAxis rotationAxisVertical" />
        <img className="rotationMousePreview" src={rotationMouseIcon} alt="" />
      </div>
      <div className="rotationControl" style={rotationStyle}>
        <div className="rotationSliderWrap">
          <output className="rotationSliderValue">{draftAngle}&deg;</output>
          <Slider
            aria-label={t("advanced.rotationAngle")}
            disabled={disabled || !settings?.enabled}
            min={ROTATION_MIN}
            max={ROTATION_MAX}
            step={1}
            value={draftAngle}
            onBlur={commitAngle}
            onChange={(event) => setDraftAngle(Number(event.target.value))}
            onKeyUp={commitAngle}
            onMouseUp={commitAngle}
            onPointerUp={commitAngle}
          />
        </div>
        <div className="rotationRange" aria-hidden="true">
          <span>{ROTATION_MIN}&deg;</span>
          <span>{draftAngle}&deg;</span>
          <span>{ROTATION_MAX}&deg;</span>
        </div>
      </div>
    </Card>
  );
}

function MouseTestPanel() {
  const { t } = useI18n();
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const timestampsRef = useRef<number[]>([]);
  const hzHistoryRef = useRef<number[]>([]);
  const dotRefs = useRef<HTMLDivElement[]>([]);
  const peakHzRef = useRef(0);
  const lastPointRef = useRef({ t: 0, x: 0, y: 0 });
  const speedSmoothRef = useRef(0);
  const [stats, setStats] = useState<MouseTestStats>({
    intervalUs: null,
    jitter: null,
    peak: null,
    rate: null,
    speed: 0,
    x: 0,
    y: 0
  });

  useEffect(() => {
    const intervalId = window.setInterval(calculateStats, 100);

    return () => {
      window.clearInterval(intervalId);
      clearTrail();
    };
  }, []);

  function resetTest() {
    timestampsRef.current = [];
    hzHistoryRef.current = [];
    peakHzRef.current = 0;
    lastPointRef.current = { t: 0, x: 0, y: 0 };
    speedSmoothRef.current = 0;
    clearTrail();
    clearSparkline();
    setStats({
      intervalUs: null,
      jitter: null,
      peak: null,
      rate: null,
      speed: 0,
      x: 0,
      y: 0
    });
  }

  function calculateStats() {
    const cutoff = performance.now() - MOUSE_TEST_WINDOW_MS;
    timestampsRef.current = timestampsRef.current.filter((timestamp) => timestamp > cutoff);

    if (timestampsRef.current.length < 3) {
      return;
    }

    const intervals = [];
    for (let index = 1; index < timestampsRef.current.length; index += 1) {
      intervals.push(timestampsRef.current[index] - timestampsRef.current[index - 1]);
    }

    const medianInterval = median(intervals);
    const intervalHz = medianInterval > 0 ? Math.round(1000 / medianInterval) : 0;
    const countHz = timestampsRef.current.length;
    const bestHz = Math.max(intervalHz, countHz);
    peakHzRef.current = Math.max(peakHzRef.current, bestHz);

    const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const variance = intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
    const jitter = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0;

    hzHistoryRef.current = [...hzHistoryRef.current, bestHz].slice(-MOUSE_TEST_HISTORY_MAX);
    drawSparkline();
    setStats((currentStats) => ({
      ...currentStats,
      intervalUs: Math.round(medianInterval * 1000),
      jitter,
      peak: peakHzRef.current,
      rate: bestHz
    }));
  }

  function drawSparkline() {
    const canvas = canvasRef.current;
    const history = hzHistoryRef.current;

    if (!canvas || history.length < 2) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const width = Math.max(1, Math.floor(canvas.offsetWidth * window.devicePixelRatio));
    const height = Math.max(1, Math.floor(canvas.offsetHeight * window.devicePixelRatio));
    canvas.width = width;
    canvas.height = height;

    context.clearRect(0, 0, width, height);

    const maxValue = Math.max(...history, 1000) * 1.1;
    const step = width / (MOUSE_TEST_HISTORY_MAX - 1);
    const startIndex = MOUSE_TEST_HISTORY_MAX - history.length;

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(69, 200, 59, 0.18)");
    gradient.addColorStop(1, "rgba(69, 200, 59, 0)");

    context.beginPath();
    context.moveTo(startIndex * step, height);
    history.forEach((value, index) => {
      const x = (startIndex + index) * step;
      const y = height - (value / maxValue) * (height - 4);
      context.lineTo(x, y);
    });
    context.lineTo(width, height);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    history.forEach((value, index) => {
      const x = (startIndex + index) * step;
      const y = height - (value / maxValue) * (height - 4);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#45c83b";
    context.lineWidth = Math.max(2, window.devicePixelRatio * 1.2);
    context.stroke();

    const lastValue = history[history.length - 1];
    const lastX = (startIndex + history.length - 1) * step;
    const lastY = height - (lastValue / maxValue) * (height - 4);
    context.beginPath();
    context.arc(lastX, lastY, 3 * window.devicePixelRatio, 0, Math.PI * 2);
    context.fillStyle = context.strokeStyle;
    context.fill();
  }

  function clearSparkline() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const area = areaRef.current;
    if (!area) {
      return;
    }

    const nativeEvent = event.nativeEvent as PointerEvent & {
      getCoalescedEvents?: () => PointerEvent[];
    };
    const reportedCoalescedEvents = nativeEvent.getCoalescedEvents?.();
    const coalescedEvents = reportedCoalescedEvents && reportedCoalescedEvents.length > 0
      ? reportedCoalescedEvents
      : [nativeEvent];
    const rect = area.getBoundingClientRect();
    const timestamp = performance.now();
    const lastEvent = coalescedEvents[coalescedEvents.length - 1] ?? nativeEvent;
    const x = lastEvent.clientX - rect.left;
    const y = lastEvent.clientY - rect.top;

    for (const pointerEvent of coalescedEvents) {
      timestampsRef.current.push(pointerEvent.timeStamp || timestamp);
      addTrailDot(pointerEvent.clientX - rect.left, pointerEvent.clientY - rect.top);
    }

    if (crosshairRef.current) {
      crosshairRef.current.style.left = `${x}px`;
      crosshairRef.current.style.top = `${y}px`;
      crosshairRef.current.style.opacity = "1";
    }

    const lastPoint = lastPointRef.current;
    if (lastPoint.t > 0) {
      const seconds = (timestamp - lastPoint.t) / 1000;
      if (seconds > 0) {
        const distance = Math.hypot(x - lastPoint.x, y - lastPoint.y);
        speedSmoothRef.current = speedSmoothRef.current * 0.7 + (distance / seconds) * 0.3;
      }
    }

    lastPointRef.current = { t: timestamp, x, y };
    setStats((currentStats) => ({
      ...currentStats,
      speed: Math.round(speedSmoothRef.current),
      x: Math.round(x),
      y: Math.round(y)
    }));
  }

  function handlePointerLeave() {
    speedSmoothRef.current = 0;
    if (crosshairRef.current) {
      crosshairRef.current.style.opacity = "0";
    }
    setStats((currentStats) => ({ ...currentStats, speed: 0 }));
  }

  function addTrailDot(x: number, y: number) {
    const trail = trailRef.current;
    if (!trail) {
      return;
    }

    const dot = document.createElement("div");
    dot.className = "mouseTestDot";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    trail.append(dot);
    dotRefs.current.push(dot);

    while (dotRefs.current.length > MOUSE_TEST_MAX_DOTS) {
      dotRefs.current.shift()?.remove();
    }

    dotRefs.current.forEach((item, index) => {
      item.style.opacity = String(0.2 + (0.8 * index) / Math.max(dotRefs.current.length, 1));
    });
  }

  function clearTrail() {
    dotRefs.current.forEach((dot) => dot.remove());
    dotRefs.current = [];
  }

  const statsLabel = t("mouseTest.statsLabel", {
    rate: stats.rate === null ? t("mouseTest.waiting") : t("mouseTest.rateValue", { rate: stats.rate }),
    peak: stats.peak === null ? "-- Hz" : `${stats.peak} Hz`,
    jitter: stats.jitter === null ? "--%" : `${stats.jitter.toFixed(1)}%`,
    interval: stats.intervalUs === null ? "-- us" : `${stats.intervalUs} us`,
    speed: `${stats.speed} px/s`,
    position: `${stats.x}, ${stats.y}`
  });

  return (
    <ControlTile className="mouseTestPanel" eyebrow={t("mouseTest.title")}>
      <div className="mouseTestHeader">
        <div>
          <strong>{stats.rate === null ? t("mouseTest.waiting") : t("mouseTest.rateValue", { rate: stats.rate })}</strong>
        </div>
        <Button
          aria-label={t("mouseTest.reset")}
          className="mouseTestReset"
          size="icon"
          title={t("mouseTest.reset")}
          type="button"
          variant="outline"
          onClick={resetTest}
        >
          <Icon icon={rotateCcwIcon} />
        </Button>
      </div>
      <div
        aria-label={t("mouseTest.areaLabel")}
        className="mouseTestArea"
        ref={areaRef}
        role="application"
        tabIndex={0}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
      >
        <div className="mouseTestCrosshair" ref={crosshairRef} />
        <div className="mouseTestTrail" ref={trailRef} />
      </div>
      <div className="mouseTestChart">
        <canvas aria-label={t("mouseTest.chartLabel")} ref={canvasRef} />
      </div>
      <div className="mouseTestStats" role="status" aria-live="polite" aria-label={statsLabel}>
        <MouseTestStat label={t("mouseTest.peak")} unit="Hz" value={stats.peak ?? "--"} />
        <MouseTestStat label={t("mouseTest.jitter")} unit="%" value={stats.jitter === null ? "--" : stats.jitter.toFixed(1)} />
        <MouseTestStat label={t("mouseTest.interval")} unit="us" value={stats.intervalUs ?? "--"} />
        <MouseTestStat label={t("mouseTest.speed")} unit="px/s" value={stats.speed} />
        <MouseTestStat label={t("mouseTest.position")} value={`${stats.x}, ${stats.y}`} />
      </div>
    </ControlTile>
  );
}

function MouseTestStat({ label, unit, value }: { label: string; unit?: string; value: ReactNode }) {
  return (
    <div className="mouseTestStat">
      <span>{label}</span>
      <strong>{value}</strong>
      {unit ? <small>{unit}</small> : null}
    </div>
  );
}

interface ButtonMappingRowProps {
  buttonLabel: string;
  mapping: ButtonMapping;
  onActionChange: (action: ButtonMapping["action"]) => void;
  onCustomKeysChange: (customKeys: string) => void;
}

function ButtonMappingRow({ buttonLabel, mapping, onActionChange, onCustomKeysChange }: ButtonMappingRowProps) {
  const { t } = useI18n();

  return (
    <div className="buttonMappingRow">
      <div className="buttonMappingButton">
        <span>{t("buttonMap.buttonLabel")}</span>
        <strong>{buttonLabel}</strong>
      </div>
      <label className="buttonMappingSelect">
        <span>{t("buttonMap.assignment")}</span>
        <Select
          value={mapping.action}
          onValueChange={(value) => onActionChange(value as ButtonMapping["action"])}
        >
          <SelectTrigger aria-label={`${buttonLabel} ${t("buttonMap.assignment")}`} className="buttonMappingSelectTrigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="buttonMappingSelectContent">
            {BUTTON_ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.action} value={option.action}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {mapping.action === "custom" ? (
        <label className="buttonMappingCustomKeys">
          <span>{t("buttonMap.customKeys")}</span>
          <Input
            aria-label={`${buttonLabel} ${t("buttonMap.customKeys")}`}
            maxLength={40}
            placeholder={t("buttonMap.customPlaceholder")}
            value={mapping.customKeys ?? ""}
            onChange={(event) => onCustomKeysChange(event.target.value)}
          />
        </label>
      ) : (
        <div className="buttonMappingKind">
          <span>{t("buttonMap.type")}</span>
          <strong>{t(mapping.actionKind === "mouse" ? "buttonMap.type.mouse" : mapping.actionKind === "keyboard" ? "buttonMap.type.keyboard" : "buttonMap.type.disabled")}</strong>
        </div>
      )}
    </div>
  );
}

interface PowerSliderProps {
  ariaLabel: string;
  disabled: boolean;
  max: number;
  min: number;
  step: number;
  unit: string;
  value: number;
  onCommit: (value: number) => void;
}

function PowerSlider({ ariaLabel, disabled, max, min, step, unit, value, onCommit }: PowerSliderProps) {
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);

  useEffect(() => {
    setDraftValue(value);
    draftValueRef.current = value;
  }, [value]);

  const commitValue = () => {
    const nextValue = clampNumber(draftValueRef.current, min, max);
    setDraftValue(nextValue);
    draftValueRef.current = nextValue;
    if (nextValue !== value) {
      onCommit(nextValue);
    }
  };

  return (
    <div className="powerSliderControl">
      <div className="powerSliderTrackWrap">
        <output className="powerSliderValue" style={{ "--slider-progress": `${((draftValue - min) / (max - min)) * 100}%` } as CSSProperties}>
          {draftValue}
          {unit}
        </output>
        <Slider
          aria-label={ariaLabel}
          className="powerSlider"
          disabled={disabled}
          max={max}
          min={min}
          step={step}
          value={draftValue}
          style={
            {
              "--slider-progress": `${((draftValue - min) / (max - min)) * 100}%`
            } as CSSProperties
          }
          onBlur={commitValue}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            draftValueRef.current = nextValue;
            setDraftValue(nextValue);
          }}
          onKeyUp={(event) => {
            if (event.key === "Enter" || event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
              commitValue();
            }
          }}
          onMouseUp={commitValue}
          onPointerUp={commitValue}
        />
      </div>
      <div className="powerSliderRange" aria-hidden="true">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

interface ControlTileProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  eyebrow: string;
  title?: string;
}

function ControlTile({ children, className, disabled = false, eyebrow, title }: ControlTileProps) {
  return (
    <Card className={cn("controlTile", disabled && "disabledTile", className)}>
      <span>{eyebrow}</span>
      {title ? <strong>{title}</strong> : null}
      {typeof children === "string" ? <p>{children}</p> : children}
    </Card>
  );
}

interface DpiStageRowProps {
  controlsDisabled: boolean;
  isActive: boolean;
  stage: DpiStage;
  stageColorIndex: number | null;
  switchDisabled: boolean;
  onActivate: () => void;
  onChange: (axis: DpiAxis, value: number, splitAxes: boolean) => void;
  onCommit: (axis: DpiAxis, value: number, splitAxes: boolean) => void;
  onEnabledChange: (enabled: boolean) => void;
  onSplitAxesChange: (enabled: boolean) => void;
}

function DpiStageRow({
  controlsDisabled,
  isActive,
  stage,
  stageColorIndex,
  switchDisabled,
  onActivate,
  onChange,
  onCommit,
  onEnabledChange,
  onSplitAxesChange
}: DpiStageRowProps) {
  const { t } = useI18n();
  const [splitAxes, setSplitAxes] = useState(stage.x !== stage.y);
  const [numberText, setNumberText] = useState<Record<DpiAxis, string>>({ x: String(stage.x), y: String(stage.y) });
  const xNumberInputRef = useRef<HTMLInputElement>(null);
  const yNumberInputRef = useRef<HTMLInputElement>(null);
  const draftValueRef = useRef<Record<DpiAxis, number>>({ x: stage.x, y: stage.y });
  const numberTextRef = useRef<Record<DpiAxis, string>>({ x: String(stage.x), y: String(stage.y) });
  const numberFocusedRef = useRef<Record<DpiAxis, boolean>>({ x: false, y: false });
  const numberDirtyRef = useRef<Record<DpiAxis, boolean>>({ x: false, y: false });
  const focusActivationLockRef = useRef<number | null>(null);
  const stageSwatch = stageColorIndex === null ? null : DPI_STAGE_SWATCHES[stageColorIndex];
  const stageEnabled = isDpiStageEnabled(stage);
  const stageValueLabel = formatDpiStageValue(stage, t);
  const stageStateLabel = isActive ? t("performance.dpiStageActive") : t("performance.dpiStageInactive");
  const stageGroupLabel = t("performance.dpiStageGroup", {
    stage: stage.id,
    state: stageStateLabel,
    value: stageValueLabel
  });
  const stageActivateLabel = t("performance.activateDpiStage", {
    stage: stage.id,
    value: stageValueLabel
  });
  const stageStyle = {
    "--dpi-stage-color": stageSwatch ?? "var(--field-border)"
  } as CSSProperties;

  useEffect(() => {
    draftValueRef.current = { x: stage.x, y: stage.y };

    if (!numberFocusedRef.current.x) {
      setNumberTextValue("x", String(stage.x));
    }

    if (!numberFocusedRef.current.y) {
      setNumberTextValue("y", String(stage.y));
    }

    if (stage.x !== stage.y) {
      setSplitAxes(true);
    }
  }, [stage.x, stage.y]);

  const setNumberTextValue = (axis: DpiAxis, value: string) => {
    numberTextRef.current = { ...numberTextRef.current, [axis]: value };
    setNumberText((current) => ({ ...current, [axis]: value }));
  };

  const commitValue = (axis: DpiAxis, rawValue: number) => {
    const value = clampDpi(rawValue);
    draftValueRef.current = { ...draftValueRef.current, [axis]: value };
    numberDirtyRef.current[axis] = false;
    setNumberTextValue(axis, String(value));
    onCommit(axis, value, splitAxes);
  };

  const activateStage = () => {
    flushSync(() => {
      onActivate();
    });
  };

  const commitNumberText = (axis: DpiAxis) => {
    const parsedValue = Number(numberTextRef.current[axis]);
    if (!Number.isInteger(parsedValue)) {
      setNumberTextValue(axis, String(stage[axis]));
      numberDirtyRef.current[axis] = false;
      return;
    }

    if (!numberDirtyRef.current[axis] && parsedValue === stage[axis]) {
      return;
    }

    commitValue(axis, parsedValue);
  };

  const toggleSplitAxes = () => {
    const nextSplitAxes = !splitAxes;
    setSplitAxes(nextSplitAxes);
    onSplitAxesChange(nextSplitAxes);

    if (!nextSplitAxes) {
      draftValueRef.current = { x: stage.x, y: stage.x };
      setNumberTextValue("y", String(stage.x));
      numberDirtyRef.current.y = false;
    }
  };

  const renderAxisControl = (axis: DpiAxis) => {
    const axisValue = stage[axis];
    const axisLabel = axis === "x" ? t("performance.xAxis") : t("performance.yAxis");
    const inputRef = axis === "x" ? xNumberInputRef : yNumberInputRef;

    return (
      <div className={splitAxes ? "axisDpiControl split" : "axisDpiControl"} key={axis}>
        {splitAxes ? <span className="axisLabel">{axisLabel}</span> : null}
        <Input
          aria-label={t("performance.stageAxisNumber", { stage: stage.id, axis: axisLabel })}
          className="stageNumber"
          ref={inputRef}
          disabled={controlsDisabled}
          inputMode="numeric"
          min={100}
          max={DPI_MAX}
          step={50}
          type="number"
          value={numberText[axis]}
          onBlur={() => {
            numberFocusedRef.current[axis] = false;
            commitNumberText(axis);
          }}
          onChange={(event) => {
            const nextText = event.target.value;

            setNumberTextValue(axis, nextText);
            numberDirtyRef.current[axis] = true;
          }}
          onFocus={() => {
            numberFocusedRef.current[axis] = true;
            if (focusActivationLockRef.current === stage.id) {
              focusActivationLockRef.current = null;
              return;
            }

            activateStage();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
        <Slider
          aria-label={t("performance.stageAxisSlider", { stage: stage.id, axis: axisLabel })}
          className="stageSlider"
          disabled={controlsDisabled}
          min={DPI_MIN}
          max={DPI_SLIDER_MAX}
          step={50}
          value={Math.min(axisValue, DPI_SLIDER_MAX)}
          style={
            {
              "--slider-progress": `${((Math.min(axisValue, DPI_SLIDER_MAX) - DPI_MIN) / (DPI_SLIDER_MAX - DPI_MIN)) * 100}%`
            } as CSSProperties
          }
          onBlur={() => commitValue(axis, draftValueRef.current[axis])}
          onChange={(event) => {
            const value = Number(event.target.value);
            draftValueRef.current = { ...draftValueRef.current, [axis]: value };
            setNumberTextValue(axis, String(value));
            onChange(axis, value, splitAxes);
          }}
          onKeyUp={(event) => commitValue(axis, Number(event.currentTarget.value))}
          onMouseDown={(event) => {
            if (event.button === 0) {
              activateStage();
            }
          }}
          onMouseUp={() => commitValue(axis, draftValueRef.current[axis])}
          onPointerUp={() => commitValue(axis, draftValueRef.current[axis])}
        />
        <span className="stageValue">{axisValue}</span>
      </div>
    );
  };

  return (
    <div
      className={cn("dpiStageRow", isActive && "active", !stageEnabled && "disabled")}
      style={stageStyle}
      role="group"
      aria-label={stageGroupLabel}
    >
      <Button
        aria-current={isActive ? "true" : undefined}
        aria-label={stageActivateLabel}
        className="stageBadge"
        disabled={controlsDisabled}
        size="icon"
        type="button"
        variant="secondary"
        onClick={() => {
          activateStage();
          focusActivationLockRef.current = stage.id;
          xNumberInputRef.current?.focus();
        }}
        onMouseDown={(event) => {
          if (event.button === 0) {
            activateStage();
          }
        }}
      >
        {stage.id}
      </Button>
      <div className={splitAxes ? "stageAxisStack split" : "stageAxisStack"}>{["x", "y"].map((axis) =>
        axis === "x" || splitAxes ? renderAxisControl(axis as DpiAxis) : null
      )}</div>
      <Button
        aria-label={splitAxes ? t("performance.disableSeparateAxes") : t("performance.enableSeparateAxes")}
        aria-pressed={splitAxes}
        className={splitAxes ? "axisModeButton active" : "axisModeButton"}
        disabled={controlsDisabled}
        size="icon"
        title={splitAxes ? t("performance.disableSeparateAxes") : t("performance.enableSeparateAxes")}
        type="button"
        variant="outline"
        onClick={toggleSplitAxes}
      >
        X/Y
      </Button>
      <Switch
        aria-label={
          stageEnabled
            ? t("performance.disableDpiStage", { stage: stage.id })
            : t("performance.enableDpiStage", { stage: stage.id })
        }
        checked={stageEnabled}
        className="stageEnableSwitch"
        disabled={switchDisabled}
        title={
          stageEnabled
            ? t("performance.disableDpiStage", { stage: stage.id })
            : t("performance.enableDpiStage", { stage: stage.id })
        }
        onClick={() => onEnabledChange(!stageEnabled)}
      />
    </div>
  );
}

function enabledDpiStages(dpiStages: DpiStages): DpiStage[] {
  return dpiStages.stages.filter(isDpiStageEnabled);
}

function findDpiStage(dpiStages: DpiStages, stageId: number): DpiStage | null {
  return dpiStages.stages.find((stage) => stage.id === stageId) ?? null;
}

function isDpiStageEnabled(stage: DpiStage): boolean {
  return stage.enabled ?? true;
}

function enableDpiStage(stage: DpiStage): DpiStage {
  return isDpiStageEnabled(stage) ? stage : { ...stage, enabled: true };
}

function clampDpi(value: number): number {
  if (!Number.isInteger(value)) {
    return DPI_MIN;
  }

  return Math.min(Math.max(value, DPI_MIN), DPI_MAX);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isInteger(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function clampCurveValue(value: number): number {
  return Math.min(Math.max(value, DYNAMIC_CURVE_Y_MIN), DYNAMIC_CURVE_Y_MAX);
}

function formatDpiStageValue(
  stage: DpiStage,
  translate: (key: MessageKey, params?: Record<string, string | number | boolean | null | undefined>) => string
): string {
  return stage.x === stage.y
    ? translate("performance.dpiStageValue", { value: stage.x })
    : translate("performance.dpiStageSplitValue", { x: stage.x, y: stage.y });
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  return sortedValues.length % 2 === 0
    ? (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
    : sortedValues[middleIndex];
}
