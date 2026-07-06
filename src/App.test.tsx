import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHARGING_BATTERY_REFRESH_INTERVAL_MS,
  mergeDpiStagesWithDefaults,
  readAutoConnectBlocked,
  readStoredDpiStagesLayout,
  storeAutoConnectBlocked,
  storeDpiStagesLayout,
  syncActiveDpiStageFromHardware
} from "./App";
import App from "./App";
import { createInitialCapabilities } from "./domain/capabilities";
import { runCapabilityProbe } from "./domain/capabilityProbe";
import type { ConnectedDevice, ProtocolRequest, ProtocolResponse } from "./domain/types";

const commandMock = vi.fn<(request: ProtocolRequest) => Promise<ProtocolResponse>>();

const connectedDevice: ConnectedDevice = {
  productName: "Razer Charging Mouse",
  vendorId: 0x1532,
  productId: 0x00de,
  opened: true,
  writableReports: true,
  featureReportProbeAllowed: true,
  descriptorSummary: "feature report 0"
};

vi.mock("./hid/hidTransport", () => ({
  HidTransport: vi.fn().mockImplementation(function HidTransport() {
    return {
      clear: vi.fn(),
      clearLogs: vi.fn(),
      command: commandMock,
      disconnect: vi.fn(),
      isSupported: () => true,
      openAuthorized: vi.fn(async () => connectedDevice),
      requestAndOpen: vi.fn(async () => connectedDevice),
      snapshot: vi.fn(() => ({ device: connectedDevice, logs: [] }))
    };
  })
}));

vi.mock("./domain/capabilityProbe", () => ({
  runCapabilityProbe: vi.fn(async (initialCapabilities) => ({
    advancedSettings: null,
    battery: { rawBattery: 204, percent: 80 },
    buttonMappings: null,
    buttonProtocol: "official-obm",
    capabilities: initialCapabilities,
    charging: { rawCharging: 1, isCharging: true },
    dpi: null,
    dpiStages: null,
    idleTime: null,
    lowBatteryThreshold: null,
    pollingRate: null,
    supportedPollingRates: []
  }))
}));

beforeEach(() => {
  const values = new Map<string, string>();
  commandMock.mockReset();
  commandMock.mockResolvedValue({
    commandClass: 0x07,
    commandId: 0x80,
    raw: new Uint8Array(),
    status: 0,
    success: true,
    transactionId: 1,
    value: 230
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn()
    }))
  });

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
      setItem: (key: string, value: string) => {
        values.set(key, value);
      }
    }
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("charging battery refresh", () => {
  it("refreshes battery every 30 seconds while the connected device is charging", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    let root: Root | null = null;

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    commandMock.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHARGING_BATTERY_REFRESH_INTERVAL_MS);
    });

    expect(commandMock).toHaveBeenCalledTimes(1);
    expect(commandMock.mock.calls[0]?.[0].commandName).toBe("Read battery");

    await act(async () => {
      root?.unmount();
    });
  });

  it("does not refresh battery every 30 seconds when the connected device is not charging", async () => {
    vi.mocked(runCapabilityProbe).mockResolvedValueOnce({
      advancedSettings: null,
      battery: { rawBattery: 204, percent: 80 },
      buttonMappings: null,
      buttonProtocol: "official-obm",
      capabilities: createInitialCapabilities(),
      charging: { rawCharging: 0, isCharging: false },
      dpi: null,
      dpiStages: null,
      idleTime: null,
      lowBatteryThreshold: null,
      pollingRate: null,
      supportedPollingRates: []
    });
    vi.useFakeTimers();
    const container = document.createElement("div");
    let root: Root | null = null;

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    commandMock.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHARGING_BATTERY_REFRESH_INTERVAL_MS);
    });

    expect(commandMock).not.toHaveBeenCalled();

    await act(async () => {
      root?.unmount();
    });
  });
});

describe("auto connect preference", () => {
  it("defaults to allowing automatic reconnects", () => {
    expect(readAutoConnectBlocked()).toBe(false);
  });

  it("persists and clears the manual disconnect block", () => {
    storeAutoConnectBlocked(true);

    expect(readAutoConnectBlocked()).toBe(true);

    storeAutoConnectBlocked(false);

    expect(readAutoConnectBlocked()).toBe(false);
  });
});

describe("dpi stage layout persistence", () => {
  it("restores disabled stage positions instead of pushing them to the end after a refresh", () => {
    const storedLayout = {
      activeStage: 2,
      stages: [
        { enabled: false, id: 1, x: 400, y: 400 },
        { enabled: true, id: 2, x: 800, y: 800 },
        { enabled: true, id: 3, x: 1600, y: 1600 },
        { enabled: true, id: 4, x: 3200, y: 3200 },
        { enabled: true, id: 5, x: 6400, y: 6400 }
      ]
    };

    storeDpiStagesLayout(storedLayout);

    expect(readStoredDpiStagesLayout()).toEqual(storedLayout);

    expect(
      mergeDpiStagesWithDefaults({
        activeStage: 1,
        stages: [
          { id: 1, x: 800, y: 800 },
          { id: 2, x: 1600, y: 1600 },
          { id: 3, x: 3200, y: 3200 },
          { id: 4, x: 6400, y: 6400 }
        ]
      })
    ).toEqual({
      activeStage: 2,
      stages: [
        { enabled: false, id: 1, x: 400, y: 400 },
        { enabled: true, id: 2, x: 800, y: 800 },
        { enabled: true, id: 3, x: 1600, y: 1600 },
        { enabled: true, id: 4, x: 3200, y: 3200 },
        { enabled: true, id: 5, x: 6400, y: 6400 }
      ]
    });
  });
});

describe("hardware dpi stage sync", () => {
  it("updates only the active stage when the mouse cycles DPI in hardware", () => {
    const currentStages = {
      activeStage: 1,
      stages: [
        { enabled: true, id: 1, x: 400, y: 400 },
        { enabled: true, id: 2, x: 800, y: 800 },
        { enabled: true, id: 3, x: 1600, y: 1600 }
      ]
    };

    expect(
      syncActiveDpiStageFromHardware(currentStages, {
        activeStage: 3,
        stages: [
          { enabled: true, id: 1, x: 450, y: 450 },
          { enabled: true, id: 2, x: 850, y: 850 },
          { enabled: true, id: 3, x: 1650, y: 1650 }
        ]
      })
    ).toEqual({
      activeStage: 3,
      stages: currentStages.stages
    });
  });

  it("ignores hardware active stages that are disabled in the local layout", () => {
    const currentStages = {
      activeStage: 2,
      stages: [
        { enabled: false, id: 1, x: 400, y: 400 },
        { enabled: true, id: 2, x: 800, y: 800 }
      ]
    };

    expect(
      syncActiveDpiStageFromHardware(currentStages, {
        activeStage: 1,
        stages: [
          { enabled: true, id: 1, x: 400, y: 400 },
          { enabled: true, id: 2, x: 800, y: 800 }
        ]
      })
    ).toBe(currentStages);
  });
});
