import { readBattery, readCharging, type BatteryResult, type ChargingResult } from "../features/batteryAdapter";
import { readDpi, readDpiStages, type DpiStages, type DpiValue } from "../features/dpiAdapter";
import { readPollingRateProfile, type PollingRate } from "../features/pollingRateAdapter";
import { readIdleTime, readLowBatteryThreshold, type IdleTimeResult, type LowBatteryThresholdResult } from "../features/powerAdapter";
import { readAdvancedSettings, type AdvancedSettings } from "../features/advancedAdapter";
import { readButtonMappings, type ButtonMapping, type ButtonProtocol } from "../features/buttonAdapter";
import type { TransportCommand } from "../hid/hidTransport";
import { updateCapability } from "./capabilities";
import type { CapabilityMap } from "./types";

export interface CapabilityProbeResult {
  capabilities: CapabilityMap;
  battery: BatteryResult | null;
  charging: ChargingResult | null;
  dpi: DpiValue | null;
  dpiStages: DpiStages | null;
  pollingRate: PollingRate | null;
  supportedPollingRates: readonly PollingRate[];
  idleTime: IdleTimeResult | null;
  lowBatteryThreshold: LowBatteryThresholdResult | null;
  advancedSettings: AdvancedSettings | null;
  buttonMappings: ButtonMapping[] | null;
  buttonProtocol: ButtonProtocol;
}

export async function runCapabilityProbe(
  initialCapabilities: CapabilityMap,
  command: TransportCommand,
  buttonProtocol: ButtonProtocol = "official-obm"
): Promise<CapabilityProbeResult> {
  let capabilities = initialCapabilities;
  let battery: BatteryResult | null = null;
  let charging: ChargingResult | null = null;
  let dpi: DpiValue | null = null;
  let dpiStages: DpiStages | null = null;
  let pollingRate: PollingRate | null = null;
  let supportedPollingRates: readonly PollingRate[] = [];
  let idleTime: IdleTimeResult | null = null;
  let lowBatteryThreshold: LowBatteryThresholdResult | null = null;
  let advancedSettings: AdvancedSettings | null = null;
  let buttonMappings: ButtonMapping[] | null = null;

  try {
    battery = await readBattery(command);
    capabilities = updateCapability(capabilities, "battery", {
      state: "available",
      detail: { key: "capability.detail.battery.available", params: { percent: battery.percent } }
    });
  } catch (error) {
    capabilities = updateCapability(capabilities, "battery", {
      state: "probeFailed",
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    charging = await readCharging(command);
    capabilities = updateCapability(capabilities, "charging", {
      state: "available",
      detail: {
        key: charging.isCharging
          ? "capability.detail.charging.availableCharging"
          : "capability.detail.charging.availableNotCharging"
      }
    });
  } catch (error) {
    capabilities = updateCapability(capabilities, "charging", {
      state: "probeFailed",
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    dpi = await readDpi(command);
    dpiStages = await readDpiStages(command);
    capabilities = updateCapability(capabilities, "dpi", {
      state: "available",
      detail: { key: "capability.detail.dpi.available", params: { x: dpi.x, y: dpi.y } }
    });
  } catch (error) {
    capabilities = updateCapability(capabilities, "dpi", {
      state: "probeFailed",
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    const pollingRateProfile = await readPollingRateProfile(command);
    pollingRate = pollingRateProfile.pollingRate;
    supportedPollingRates = pollingRateProfile.supportedRates;
    capabilities = updateCapability(capabilities, "pollingRate", {
      state: "available",
      detail: { key: "capability.detail.pollingRate.available", params: { rate: pollingRate } }
    });
  } catch (error) {
    capabilities = updateCapability(capabilities, "pollingRate", {
      state: "probeFailed",
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    idleTime = await readIdleTime(command);
  } catch {
    idleTime = null;
  }

  try {
    lowBatteryThreshold = await readLowBatteryThreshold(command);
  } catch {
    lowBatteryThreshold = null;
  }

  try {
    advancedSettings = await readAdvancedSettings(command);
  } catch {
    advancedSettings = null;
  }

  try {
    buttonMappings = await readButtonMappings(command, buttonProtocol);
    capabilities = updateCapability(capabilities, "buttons", {
      state: "available",
      detail: { key: "capability.detail.buttons.available" }
    });
  } catch (error) {
    capabilities = updateCapability(capabilities, "buttons", {
      state: "probeFailed",
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    advancedSettings,
    buttonMappings,
    buttonProtocol,
    capabilities,
    battery,
    charging,
    dpi,
    dpiStages,
    pollingRate,
    supportedPollingRates,
    idleTime,
    lowBatteryThreshold
  };
}
