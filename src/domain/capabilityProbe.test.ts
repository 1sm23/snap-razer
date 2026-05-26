import { describe, expect, it } from "vitest";
import { createInitialCapabilities } from "./capabilities";
import { runCapabilityProbe } from "./capabilityProbe";
import type { TransportCommand } from "../hid/hidTransport";

describe("capabilityProbe", () => {
  it("marks battery and charging available when both probes pass", async () => {
    const command: TransportCommand = async (request) => ({
      raw: new Uint8Array(90),
      status: 0x02,
      transactionId: 0x1f,
      commandClass: request.bytes[6],
      commandId: request.bytes[7],
      value: request.bytes[7] === 0x80 ? 128 : 1,
      success: true
    });

    const result = await runCapabilityProbe(createInitialCapabilities(), command);

    expect(result.capabilities.battery.state).toBe("available");
    expect(result.capabilities.charging.state).toBe("available");
    expect(result.capabilities.dpi.state).toBe("probeFailed");
    expect(result.battery?.percent).toBe(50);
    expect(result.charging?.isCharging).toBe(true);
  });

  it("marks DPI available when the Viper V3 Pro style DPI probe passes", async () => {
    const command: TransportCommand = async (request) => {
      const raw = new Uint8Array(90);

      if (request.bytes[7] === 0x85) {
        raw[9] = 0x06;
        raw[10] = 0x40;
        raw[11] = 0x06;
        raw[12] = 0x40;
      }

      if (request.bytes[7] === 0x86) {
        raw[9] = 0x02;
        raw[10] = 0x02;
        raw.set([0x01, 0x03, 0x20, 0x03, 0x20, 0x00, 0x00], 12);
        raw.set([0x02, 0x06, 0x40, 0x06, 0x40, 0x00, 0x00], 19);
      }

      if (request.bytes[7] === 0xc0) {
        raw[9] = 0x08;
      }

      return {
        raw,
        status: 0x02,
        transactionId: 0x1f,
        commandClass: request.bytes[6],
        commandId: request.bytes[7],
        value: request.bytes[7] === 0x80 ? 128 : 1,
        success: true
      };
    };

    const result = await runCapabilityProbe(createInitialCapabilities(), command);

    expect(result.capabilities.dpi.state).toBe("available");
    expect(result.capabilities.dpi.detail).toEqual({
      key: "capability.detail.dpi.available",
      params: { x: 1600, y: 1600 }
    });
    expect(result.dpi).toEqual({ x: 1600, y: 1600 });
    expect(result.dpiStages?.activeStage).toBe(2);
    expect(result.pollingRate).toBe(1000);
    expect(result.supportedPollingRates).toEqual([125, 500, 1000, 2000, 4000, 8000]);
  });

  it("isolates failed battery probe from successful charging probe and static browser-limited button state", async () => {
    const command: TransportCommand = async (request) => {
      if (request.bytes[7] === 0x80) {
        throw new Error("battery timeout");
      }

      return {
        raw: new Uint8Array(90),
        status: 0x02,
        transactionId: 0x1f,
        commandClass: request.bytes[6],
        commandId: request.bytes[7],
        value: 0,
        success: true
      };
    };

    const result = await runCapabilityProbe(createInitialCapabilities(), command);

    expect(result.capabilities.battery.state).toBe("probeFailed");
    expect(result.capabilities.charging.state).toBe("available");
    expect(result.capabilities.buttons.state).toBe("browserLimited");
    expect(result.battery).toBeNull();
    expect(result.charging?.isCharging).toBe(false);
  });

  it("isolates failed charging probe from successful battery probe and static browser-limited button state", async () => {
    const command: TransportCommand = async (request) => {
      if (request.bytes[7] === 0x84) {
        throw new Error("charging timeout");
      }

      return {
        raw: new Uint8Array(90),
        status: 0x02,
        transactionId: 0x1f,
        commandClass: request.bytes[6],
        commandId: request.bytes[7],
        value: 255,
        success: true
      };
    };

    const result = await runCapabilityProbe(createInitialCapabilities(), command);

    expect(result.capabilities.battery.state).toBe("available");
    expect(result.capabilities.charging.state).toBe("probeFailed");
    expect(result.capabilities.buttons.state).toBe("browserLimited");
    expect(result.battery?.percent).toBe(100);
    expect(result.charging).toBeNull();
  });

  it("isolates battery validation failure from successful charging probe", async () => {
    const command: TransportCommand = async (request) => ({
      raw: new Uint8Array(90),
      status: 0x02,
      transactionId: 0x1f,
      commandClass: request.bytes[6],
      commandId: request.bytes[7] === 0x80 ? 0x84 : request.bytes[7],
      value: request.bytes[7] === 0x80 ? 128 : 1,
      success: true
    });

    const result = await runCapabilityProbe(createInitialCapabilities(), command);

    expect(result.capabilities.battery.state).toBe("probeFailed");
    expect(result.capabilities.battery.detail).toContain("Battery command response mismatch");
    expect(result.capabilities.charging.state).toBe("available");
    expect(result.capabilities.buttons.state).toBe("browserLimited");
    expect(result.battery).toBeNull();
    expect(result.charging?.isCharging).toBe(true);
  });
});
