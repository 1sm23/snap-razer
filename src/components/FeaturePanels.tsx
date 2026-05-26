import { flushSync } from "react-dom";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type ControlTab = "customize" | "performance" | "power";
type DpiAxis = "x" | "y";

const tabs: Array<{ id: ControlTab; labelKey: MessageKey }> = [
  { id: "customize", labelKey: "controls.customize" },
  { id: "performance", labelKey: "controls.performance" },
  { id: "power", labelKey: "controls.power" }
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

interface FeaturePanelsProps {
  battery: BatteryResult | null;
  buttonMappings?: readonly ButtonMapping[];
  charging: ChargingResult | null;
  dpi: DpiValue | null;
  dpiStages: DpiStages | null;
  dpiStagesDraft: DpiStages;
  pollingRate: PollingRate | null;
  supportedPollingRates: readonly PollingRate[];
  applyingDpi: boolean;
  applyingIdleTime?: boolean;
  applyingLowBatteryThreshold?: boolean;
  applyingPollingRate: boolean;
  initialTab?: ControlTab;
  idleTime?: IdleTimeResult | null;
  lowBatteryThreshold?: LowBatteryThresholdResult | null;
  onDpiStagesDraftChange: (dpiStages: DpiStages) => void;
  onApplyDpiStages: (dpiStages: DpiStages, mode?: "immediate" | "debounced") => void;
  onApplyIdleTime?: (minutes: number) => void;
  onApplyLowBatteryThreshold?: (percent: number) => void;
  onApplyPollingRate: (pollingRate: PollingRate) => void;
  onButtonMappingChange?: (buttonId: string, action: ButtonMapping["action"]) => void;
  onButtonMappingCustomKeysChange?: (buttonId: string, customKeys: string) => void;
  onResetButtonMappings?: () => void;
}

export function FeaturePanels({
  battery,
  buttonMappings = BUTTON_DEFINITIONS.map((definition) => definition.defaultMapping),
  charging,
  dpi,
  dpiStages,
  dpiStagesDraft,
  pollingRate,
  supportedPollingRates,
  applyingDpi,
  applyingIdleTime = false,
  applyingLowBatteryThreshold = false,
  applyingPollingRate,
  initialTab = "performance",
  idleTime = null,
  lowBatteryThreshold = null,
  onDpiStagesDraftChange,
  onApplyDpiStages,
  onApplyIdleTime = () => undefined,
  onApplyLowBatteryThreshold = () => undefined,
  onApplyPollingRate,
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
                  <strong>{t("buttonMap.title")}</strong>
                  <p>{t("buttonMap.description")}</p>
                </div>
                <Button type="button" variant="outline" onClick={onResetButtonMappings}>
                  {t("buttonMap.reset")}
                </Button>
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
        </Tabs>
      </CardContent>
    </Card>
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
          aria-label={axisLabel}
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
            const parsedValue = Number(nextText);

            setNumberTextValue(axis, nextText);
            numberDirtyRef.current[axis] = true;
            if (nextText !== "" && Number.isInteger(parsedValue) && isDpiInRange(parsedValue)) {
              draftValueRef.current = { ...draftValueRef.current, [axis]: parsedValue };
              onChange(axis, parsedValue, splitAxes);
            }
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
          aria-label={axisLabel}
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
    >
      <Button
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

function isDpiInRange(value: number): boolean {
  return value >= DPI_MIN && value <= DPI_MAX;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isInteger(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
