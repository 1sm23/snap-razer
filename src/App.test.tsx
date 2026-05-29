import { beforeEach, describe, expect, it } from "vitest";
import {
  mergeDpiStagesWithDefaults,
  readAutoConnectBlocked,
  readStoredDpiStagesLayout,
  storeAutoConnectBlocked,
  storeDpiStagesLayout,
  syncActiveDpiStageFromHardware
} from "./App";

beforeEach(() => {
  const values = new Map<string, string>();

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
