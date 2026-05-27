import { beforeEach, describe, expect, it } from "vitest";
import { readAutoConnectBlocked, storeAutoConnectBlocked } from "./App";

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
