import { describe, expect, it } from "vitest";
import type { ProtocolRequest } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";
import { readIdleTime, readLowBatteryThreshold, setIdleTime, setLowBatteryThreshold } from "./powerAdapter";

function makeRawResponse(commandId: number, payload: number[]): TransportCommand {
  return async (request: ProtocolRequest) => {
    expect(request.bytes[6]).toBe(0x07);
    expect(request.bytes[7]).toBe(commandId);

    const raw = new Uint8Array(90);
    payload.forEach((value, index) => {
      raw[8 + index] = value;
    });

    return {
      raw,
      status: 0x02,
      transactionId: 0x1f,
      commandClass: 0x07,
      commandId,
      value: raw[9],
      success: true
    };
  };
}

describe("powerAdapter", () => {
  it("reads idle time from OpenRazer two-byte seconds payload", async () => {
    await expect(readIdleTime(makeRawResponse(0x83, [0x01, 0x2c]))).resolves.toEqual({
      seconds: 300,
      minutes: 5
    });
  });

  it("writes idle time as seconds", async () => {
    const command: TransportCommand = async (request) => {
      expect(request.commandName).toBe("Set idle time");
      expect(request.bytes[7]).toBe(0x03);
      expect(request.bytes[8]).toBe(0x01);
      expect(request.bytes[9]).toBe(0x2c);

      return {
        raw: new Uint8Array(90),
        status: 0x02,
        transactionId: 0x1f,
        commandClass: 0x07,
        commandId: 0x03,
        value: 0,
        success: true
      };
    };

    await expect(setIdleTime(command, 5)).resolves.toEqual({ seconds: 300, minutes: 5 });
  });

  it("reads low battery threshold as a percent", async () => {
    await expect(readLowBatteryThreshold(makeRawResponse(0x81, [0x3f]))).resolves.toEqual({
      rawThreshold: 0x3f,
      percent: 25
    });
  });

  it("writes low battery threshold using OpenRazer raw scaling", async () => {
    const command: TransportCommand = async (request) => {
      expect(request.commandName).toBe("Set low battery threshold");
      expect(request.bytes[7]).toBe(0x01);
      expect(request.bytes[8]).toBe(0x4d);

      return {
        raw: new Uint8Array(90),
        status: 0x02,
        transactionId: 0x1f,
        commandClass: 0x07,
        commandId: 0x01,
        value: 0,
        success: true
      };
    };

    await expect(setLowBatteryThreshold(command, 30)).resolves.toEqual({
      rawThreshold: 0x4d,
      percent: 30
    });
  });

  it("rejects malformed responses and out-of-range writes", async () => {
    await expect(readIdleTime(makeRawResponse(0x83, [0x00, 0x3b]))).rejects.toThrow("Idle time must be between");
    await expect(readLowBatteryThreshold(makeRawResponse(0x81, [0x0b]))).rejects.toThrow(
      "Low battery threshold must be between"
    );
    await expect(setIdleTime(makeRawResponse(0x03, []), 16)).rejects.toThrow("Idle time must be between");
    await expect(setLowBatteryThreshold(makeRawResponse(0x01, []), 4)).rejects.toThrow(
      "Low battery threshold must be between"
    );
  });
});
