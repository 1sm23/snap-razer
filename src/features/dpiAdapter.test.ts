import { describe, expect, it } from "vitest";
import type { ProtocolRequest, ProtocolResponse } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";
import { readDpi, readDpiStages, setDpi, writeDpiStages } from "./dpiAdapter";

function responseFor(request: ProtocolRequest, value: number, raw?: Uint8Array): ProtocolResponse {
  return {
    raw: raw ?? new Uint8Array(90),
    status: 0x02,
    transactionId: 0x1f,
    commandClass: request.bytes[6],
    commandId: request.bytes[7],
    value,
    success: true
  };
}

describe("dpiAdapter", () => {
  it("reads Viper V3 Pro style DPI from command 0x04/0x85", async () => {
    const command: TransportCommand = async (request) => {
      expect(request.reportId).toBe(0);
      expect(request.commandName).toBe("Read DPI");
      expect(request.bytes[1]).toBe(0x1f);
      expect(request.bytes[5]).toBe(0x07);
      expect(request.bytes[6]).toBe(0x04);
      expect(request.bytes[7]).toBe(0x85);
      expect(request.bytes[8]).toBe(0x00);

      const raw = new Uint8Array(90);
      raw[8] = 0x00;
      raw[9] = 0x03;
      raw[10] = 0x20;
      raw[11] = 0x03;
      raw[12] = 0x20;

      return responseFor(request, 0, raw);
    };

    await expect(readDpi(command)).resolves.toEqual({
      x: 800,
      y: 800
    });
  });

  it("writes symmetric DPI with command 0x04/0x05", async () => {
    const command: TransportCommand = async (request) => {
      expect(request.commandName).toBe("Set DPI");
      expect(request.bytes[1]).toBe(0x1f);
      expect(request.bytes[5]).toBe(0x07);
      expect(request.bytes[6]).toBe(0x04);
      expect(request.bytes[7]).toBe(0x05);
      expect([...request.bytes.slice(8, 15)]).toEqual([0x00, 0x06, 0x40, 0x06, 0x40, 0x00, 0x00]);

      return responseFor(request, 0);
    };

    await expect(setDpi(command, { x: 1600, y: 1600 })).resolves.toEqual({
      x: 1600,
      y: 1600
    });
  });

  it("rejects DPI response command mismatches", async () => {
    const command: TransportCommand = async (request) => ({
      ...responseFor(request, 0, new Uint8Array(90)),
      commandId: 0x05
    });

    await expect(readDpi(command)).rejects.toThrow("DPI command response mismatch");
  });

  it("rejects out-of-range DPI values from read responses", async () => {
    const command: TransportCommand = async (request) => responseFor(request, 0, new Uint8Array(90));

    await expect(readDpi(command)).rejects.toThrow("DPI must be between 100 and 45000");
  });

  it("rejects invalid DPI values before writing", async () => {
    const command: TransportCommand = async () => {
      throw new Error("command should not be called");
    };

    await expect(setDpi(command, { x: 99, y: 800 })).rejects.toThrow("DPI must be between 100 and 45000");
    await expect(setDpi(command, { x: 800.5, y: 800 })).rejects.toThrow("DPI must be an integer");
  });

  it("reads DPI stages with active stage and stage values", async () => {
    const command: TransportCommand = async (request) => {
      expect(request.commandName).toBe("Read DPI stages");
      expect(request.bytes[5]).toBe(0x26);
      expect(request.bytes[6]).toBe(0x04);
      expect(request.bytes[7]).toBe(0x86);
      expect(request.bytes[8]).toBe(0x01);

      const raw = new Uint8Array(90);
      raw[9] = 0x02;
      raw[10] = 0x03;
      raw.set([0x01, 0x01, 0x90, 0x01, 0x90, 0x00, 0x00], 11);
      raw.set([0x02, 0x03, 0x20, 0x03, 0x20, 0x00, 0x00], 18);
      raw.set([0x03, 0x06, 0x40, 0x06, 0x40, 0x00, 0x00], 25);

      return responseFor(request, 0, raw);
    };

    await expect(readDpiStages(command)).resolves.toEqual({
      activeStage: 2,
      stages: [
        { enabled: true, id: 1, x: 400, y: 400 },
        { enabled: true, id: 2, x: 800, y: 800 },
        { enabled: true, id: 3, x: 1600, y: 1600 }
      ]
    });
  });

  it("reads DPI stages from the payload layout returned by real devices", async () => {
    const command: TransportCommand = async (request) => {
      const raw = new Uint8Array(90);
      raw.set(
        [
          0x02, 0x1f, 0x00, 0x00, 0x00, 0x26, 0x04, 0x86, 0x01, 0x03, 0x05,
          0x01, 0x01, 0x90, 0x01, 0x90, 0x00, 0x00,
          0x02, 0x03, 0x20, 0x03, 0x20, 0x00, 0x00,
          0x03, 0x06, 0x40, 0x06, 0x40, 0x00, 0x00,
          0x04, 0x0c, 0x80, 0x0c, 0x80, 0x00, 0x00,
          0x05, 0x19, 0x00, 0x19, 0x00, 0x00, 0x00
        ],
        0
      );

      return responseFor(request, 0, raw);
    };

    await expect(readDpiStages(command)).resolves.toEqual({
      activeStage: 3,
      stages: [
        { enabled: true, id: 1, x: 400, y: 400 },
        { enabled: true, id: 2, x: 800, y: 800 },
        { enabled: true, id: 3, x: 1600, y: 1600 },
        { enabled: true, id: 4, x: 3200, y: 3200 },
        { enabled: true, id: 5, x: 6400, y: 6400 }
      ]
    });
  });

  it("writes DPI stages with OpenRazer stage payload format", async () => {
    const command: TransportCommand = async (request) => {
      expect(request.commandName).toBe("Set DPI stages");
      expect(request.bytes[5]).toBe(0x26);
      expect(request.bytes[6]).toBe(0x04);
      expect(request.bytes[7]).toBe(0x06);
      expect([...request.bytes.slice(8, 8 + 24)]).toEqual([
        0x01,
        0x02,
        0x03,
        0x00,
        0x01,
        0x90,
        0x01,
        0x90,
        0x00,
        0x00,
        0x01,
        0x03,
        0x20,
        0x03,
        0x20,
        0x00,
        0x00,
        0x02,
        0x06,
        0x40,
        0x06,
        0x40,
        0x00,
        0x00
      ]);

      return responseFor(request, 0);
    };

    await expect(
      writeDpiStages(command, {
        activeStage: 2,
        stages: [
          { id: 1, x: 400, y: 400 },
          { id: 2, x: 800, y: 800 },
          { id: 3, x: 1600, y: 1600 }
        ]
      })
    ).resolves.toEqual({
      activeStage: 2,
      stages: [
        { id: 1, x: 400, y: 400 },
        { id: 2, x: 800, y: 800 },
        { id: 3, x: 1600, y: 1600 }
      ]
    });
  });

  it("writes only enabled DPI stages and remaps the active stage for the device payload", async () => {
    const command: TransportCommand = async (request) => {
      expect(request.commandName).toBe("Set DPI stages");
      expect([...request.bytes.slice(8, 8 + 24)]).toEqual([
        0x01,
        0x02,
        0x03,
        0x00,
        0x01,
        0x90,
        0x01,
        0x90,
        0x00,
        0x00,
        0x01,
        0x06,
        0x40,
        0x06,
        0x40,
        0x00,
        0x00,
        0x02,
        0x0c,
        0x80,
        0x0c,
        0x80,
        0x00,
        0x00
      ]);

      return responseFor(request, 0);
    };

    await expect(
      writeDpiStages(command, {
        activeStage: 3,
        stages: [
          { enabled: true, id: 1, x: 400, y: 400 },
          { enabled: false, id: 2, x: 800, y: 800 },
          { enabled: true, id: 3, x: 1600, y: 1600 },
          { enabled: true, id: 4, x: 3200, y: 3200 }
        ]
      })
    ).resolves.toEqual({
      activeStage: 3,
      stages: [
        { enabled: true, id: 1, x: 400, y: 400 },
        { enabled: false, id: 2, x: 800, y: 800 },
        { enabled: true, id: 3, x: 1600, y: 1600 },
        { enabled: true, id: 4, x: 3200, y: 3200 }
      ]
    });
  });

  it("rejects writing with no enabled DPI stages", async () => {
    const command: TransportCommand = async () => {
      throw new Error("command should not be called");
    };

    await expect(
      writeDpiStages(command, {
        activeStage: 1,
        stages: [{ enabled: false, id: 1, x: 800, y: 800 }]
      })
    ).rejects.toThrow("At least one DPI stage must be enabled");
  });
});
