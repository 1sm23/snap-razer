import { describe, expect, it } from "vitest";
import type { ProtocolRequest, ProtocolResponse } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";
import { readPollingRate, readPollingRateProfile, setPollingRate } from "./pollingRateAdapter";

function responseFor(request: ProtocolRequest, raw?: Uint8Array): ProtocolResponse {
  return {
    raw: raw ?? new Uint8Array(90),
    status: 0x02,
    transactionId: 0x1f,
    commandClass: request.bytes[6],
    commandId: request.bytes[7],
    value: 0,
    success: true
  };
}

describe("pollingRateAdapter", () => {
  it("reads Viper V3 Pro style polling rate2", async () => {
    const command: TransportCommand = async (request) => {
      expect(request.commandName).toBe("Read polling rate");
      expect(request.bytes[5]).toBe(0x01);
      expect(request.bytes[6]).toBe(0x00);
      expect(request.bytes[7]).toBe(0xc0);

      const raw = new Uint8Array(90);
      raw[9] = 0x08;
      return responseFor(request, raw);
    };

    await expect(readPollingRate(command)).resolves.toBe(1000);
  });

  it("falls back to legacy polling rate when polling rate2 is not supported", async () => {
    const seenCommandIds: number[] = [];
    const command: TransportCommand = async (request) => {
      seenCommandIds.push(request.bytes[7]);

      if (request.bytes[7] === 0xc0) {
        return {
          raw: new Uint8Array(90),
          status: 0x05,
          transactionId: 0x1f,
          commandClass: request.bytes[6],
          commandId: request.bytes[7],
          value: 0,
          success: false
        };
      }

      const raw = new Uint8Array(90);
      raw[8] = 0x01;
      return responseFor(request, raw);
    };

    await expect(readPollingRateProfile(command)).resolves.toEqual({
      pollingRate: 1000,
      supportedRates: [125, 500, 1000]
    });
    expect(seenCommandIds).toEqual([0xc0, 0x85]);
  });

  it("writes polling rate2 with active argument 0 and confirms readback", async () => {
    const seen: number[] = [];
    const command: TransportCommand = async (request) => {
      expect(request.bytes[6]).toBe(0x00);
      if (request.bytes[7] === 0x40) {
        expect(request.commandName).toBe("Set polling rate");
        expect(request.bytes[5]).toBe(0x02);
        seen.push(request.bytes[8]);
        expect(request.bytes[9]).toBe(0x02);
        return responseFor(request);
      }

      expect(request.commandName).toBe("Read polling rate");
      expect(request.bytes[5]).toBe(0x01);
      expect(request.bytes[7]).toBe(0xc0);
      const raw = new Uint8Array(90);
      raw[9] = 0x02;
      return responseFor(request, raw);
    };

    await expect(setPollingRate(command, 4000)).resolves.toBe(4000);
    expect(seen).toEqual([0x00]);
  });

  it("tries double-write variants and 8K receiver transaction fallback when readback does not change", async () => {
    const seenWrites: Array<{ argument: number; transactionId: number }> = [];
    let readCount = 0;
    const command: TransportCommand = async (request) => {
      if (request.bytes[7] === 0x40) {
        seenWrites.push({ argument: request.bytes[8], transactionId: request.bytes[1] });
        expect(request.bytes[9]).toBe(0x04);
        return responseFor(request);
      }

      expect(request.bytes[7]).toBe(0xc0);
      readCount += 1;
      const raw = new Uint8Array(90);
      raw[9] = readCount < 3 ? 0x08 : 0x04;
      return responseFor(request, raw);
    };

    await expect(setPollingRate(command, 2000)).resolves.toBe(2000);
    expect(seenWrites).toEqual([
      { argument: 0x00, transactionId: 0x1f },
      { argument: 0x00, transactionId: 0x1f },
      { argument: 0x01, transactionId: 0x1f },
      { argument: 0x00, transactionId: 0x1f },
      { argument: 0x01, transactionId: 0xff }
    ]);
  });

  it("falls back to legacy polling rate writes when polling rate2 is not supported", async () => {
    const seenCommandIds: number[] = [];
    const command: TransportCommand = async (request) => {
      seenCommandIds.push(request.bytes[7]);

      if (request.bytes[7] === 0x40) {
        return {
          raw: new Uint8Array(90),
          status: 0x05,
          transactionId: 0x1f,
          commandClass: request.bytes[6],
          commandId: request.bytes[7],
          value: 0,
          success: false
        };
      }

      expect(request.commandName).toBe("Set polling rate (legacy)");
      expect(request.bytes[5]).toBe(0x01);
      expect(request.bytes[6]).toBe(0x00);
      expect(request.bytes[7]).toBe(0x05);
      expect(request.bytes[8]).toBe(0x02);
      return responseFor(request);
    };

    await expect(setPollingRate(command, 500)).resolves.toBe(500);
    expect(seenCommandIds).toEqual([0x40, 0x05]);
  });

  it("rejects unsupported polling rates", async () => {
    const command: TransportCommand = async () => {
      throw new Error("command should not be called");
    };

    await expect(setPollingRate(command, 250)).rejects.toThrow("Unsupported polling rate");
  });
});
