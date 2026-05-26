import type { CapabilityKey, CapabilityMap, CapabilityStatus, LocalizedMessage } from "./types";

const labelKeys: Record<CapabilityKey, CapabilityStatus["labelKey"]> = {
  battery: "capability.battery",
  charging: "capability.charging",
  dpi: "capability.dpi",
  pollingRate: "capability.pollingRate",
  lighting: "capability.lighting",
  buttons: "capability.buttons"
};

export function createInitialCapabilities(): CapabilityMap {
  return {
    battery: {
      key: "battery",
      labelKey: labelKeys.battery,
      state: "unsupported",
      detail: { key: "capability.detail.battery.unsupported" }
    },
    charging: {
      key: "charging",
      labelKey: labelKeys.charging,
      state: "unsupported",
      detail: { key: "capability.detail.charging.unsupported" }
    },
    dpi: {
      key: "dpi",
      labelKey: labelKeys.dpi,
      state: "notImplemented",
      detail: { key: "capability.detail.dpi.notImplemented" }
    },
    pollingRate: {
      key: "pollingRate",
      labelKey: labelKeys.pollingRate,
      state: "notImplemented",
      detail: { key: "capability.detail.pollingRate.notImplemented" }
    },
    lighting: {
      key: "lighting",
      labelKey: labelKeys.lighting,
      state: "notImplemented",
      detail: { key: "capability.detail.lighting.notImplemented" }
    },
    buttons: {
      key: "buttons",
      labelKey: labelKeys.buttons,
      state: "browserLimited",
      detail: { key: "capability.detail.buttons.browserLimited" }
    }
  };
}

export function updateCapability(
  map: CapabilityMap,
  key: CapabilityKey,
  patch: Pick<CapabilityStatus, "state" | "detail">
): CapabilityMap {
  return {
    ...map,
    [key]: {
      ...map[key],
      ...patch
    }
  };
}

export function markWritableInterfaceUnavailable(map: CapabilityMap, detail: string | LocalizedMessage): CapabilityMap {
  return {
    battery: {
      ...map.battery,
      state: "browserLimited",
      detail
    },
    charging: {
      ...map.charging,
      state: "browserLimited",
      detail
    },
    dpi: {
      ...map.dpi,
      state: "browserLimited",
      detail
    },
    pollingRate: {
      ...map.pollingRate,
      state: "browserLimited",
      detail
    },
    lighting: {
      ...map.lighting,
      state: "browserLimited",
      detail
    },
    buttons: map.buttons
  };
}

export function didAllActiveProbesFail(map: CapabilityMap): boolean {
  return (
    map.battery.state === "probeFailed" &&
    map.charging.state === "probeFailed" &&
    map.dpi.state === "probeFailed" &&
    map.pollingRate.state === "probeFailed"
  );
}
