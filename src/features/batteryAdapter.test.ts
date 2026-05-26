import { describe, expect, it } from "vitest";
import type { ProtocolRequest } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";
import { readBattery, readCharging } from "./batteryAdapter";

function makeCommand(value: number, expectedCommandId: number): TransportCommand {
  return async (request: ProtocolRequest) => {
    expect(request.bytes[6]).toBe(0x07);
    expect(request.bytes[7]).toBe(expectedCommandId);

    return {
      raw: new Uint8Array(90),
      status: 0x02,
      transactionId: 0x1f,
      commandClass: 0x07,
      commandId: expectedCommandId,
      value,
      success: true
    };
  };
}

describe("batteryAdapter", () => {
  it("converts raw battery value to a percentage", async () => {
    await expect(readBattery(makeCommand(128, 0x80))).resolves.toEqual({
      rawBattery: 128,
      percent: 50
    });
  });

  it("converts charging value to boolean", async () => {
    await expect(readCharging(makeCommand(1, 0x84))).resolves.toEqual({
      rawCharging: 1,
      isCharging: true
    });
  });

  it("throws when the transport reports protocol failure", async () => {
    const command: TransportCommand = async () => ({
      raw: new Uint8Array(90),
      status: 0x01,
      transactionId: 0x1f,
      commandClass: 0x07,
      commandId: 0x80,
      value: 0,
      success: false
    });

    await expect(readBattery(command)).rejects.toThrow("Battery command failed");
  });

  it("rejects a battery response with the wrong command id", async () => {
    const command: TransportCommand = async () => ({
      raw: new Uint8Array(90),
      status: 0x02,
      transactionId: 0x1f,
      commandClass: 0x07,
      commandId: 0x84,
      value: 128,
      success: true
    });

    await expect(readBattery(command)).rejects.toThrow("Battery command response mismatch");
  });

  it("rejects a charging response with the wrong command id", async () => {
    const command: TransportCommand = async () => ({
      raw: new Uint8Array(90),
      status: 0x02,
      transactionId: 0x1f,
      commandClass: 0x07,
      commandId: 0x80,
      value: 1,
      success: true
    });

    await expect(readCharging(command)).rejects.toThrow("Charging command response mismatch");
  });

  it("rejects out-of-range battery values", async () => {
    await expect(readBattery(makeCommand(256, 0x80))).rejects.toThrow("Battery value must be a byte");
    await expect(readBattery(makeCommand(-1, 0x80))).rejects.toThrow("Battery value must be a byte");
  });

  it("rejects non-integer battery values", async () => {
    await expect(readBattery(makeCommand(1.5, 0x80))).rejects.toThrow("Battery value must be a byte");
  });
});
