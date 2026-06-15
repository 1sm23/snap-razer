import { describe, expect, it } from "vitest";
import type { ProtocolRequest, ProtocolResponse } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";
import {
  createDefaultButtonMappings,
  getButtonProtocol,
  readButtonMappings,
  writeButtonMappings,
  type ButtonMapping
} from "./buttonAdapter";

function responseFor(request: ProtocolRequest, raw = new Uint8Array(90)): ProtocolResponse {
  return {
    raw,
    status: 0x02,
    transactionId: 0x1f,
    commandClass: request.bytes[6],
    commandId: request.bytes[7],
    value: 0,
    success: true
  };
}

function readResponse(request: ProtocolRequest, functionId: number, data: number[]): ProtocolResponse {
  const raw = new Uint8Array(90);
  raw[8] = request.bytes[8];
  raw[9] = request.bytes[9];
  raw[10] = request.bytes[10];
  raw[11] = functionId;
  raw[12] = data.length;
  raw.set(data, 13);
  return responseFor(request, raw);
}

describe("buttonAdapter", () => {
  it("selects legacy REP4 only for the verified Viper V3 product ids", () => {
    expect(getButtonProtocol(0x00c0)).toBe("legacy-rep4");
    expect(getButtonProtocol(0x00c1)).toBe("legacy-rep4");
    expect(getButtonProtocol(0x00e5)).toBe("official-obm");
  });

  it("reads official onboard button assignments", async () => {
    const assignments = [
      [0x01, [0x01]],
      [0x01, [0x02]],
      [0x01, [0x03]],
      [0x01, [0x04]],
      [0x01, [0x05]],
      [0x06, [0x06]]
    ] as const;
    let index = 0;
    const command: TransportCommand = async (request) => {
      expect(request.bytes[5]).toBe(0x50);
      expect(request.bytes[6]).toBe(0x02);
      expect(request.bytes[7]).toBe(0x8c);
      const [functionId, data] = assignments[index++];
      return readResponse(request, functionId, [...data]);
    };

    await expect(readButtonMappings(command)).resolves.toEqual(createDefaultButtonMappings());
  });

  it("writes keyboard shortcuts and verifies the readback", async () => {
    const mappings: ButtonMapping[] = [
      { action: "custom", actionKind: "keyboard", buttonId: "left", customKeys: "Ctrl+Shift+S" },
      ...createDefaultButtonMappings().slice(1)
    ];
    const assignments = new Map<number, { functionId: number; data: number[] }>([
      [0x01, { functionId: 0x01, data: [0x01] }],
      [0x02, { functionId: 0x01, data: [0x02] }],
      [0x03, { functionId: 0x01, data: [0x03] }],
      [0x04, { functionId: 0x01, data: [0x04] }],
      [0x05, { functionId: 0x01, data: [0x05] }],
      [0x60, { functionId: 0x06, data: [0x06] }]
    ]);
    let writeCount = 0;
    const command: TransportCommand = async (request) => {
      if (request.bytes[7] === 0x0c) {
        const assignment = {
          functionId: request.bytes[11],
          data: [...request.bytes.slice(13, 13 + request.bytes[12])]
        };
        expect(assignment).toEqual({ functionId: 0x02, data: [0x03, 0x16] });
        assignments.set(request.bytes[9], assignment);
        writeCount += 1;
        return responseFor(request);
      }

      const assignment = assignments.get(request.bytes[9]);
      if (!assignment) throw new Error("missing assignment");
      return readResponse(request, assignment.functionId, assignment.data);
    };

    await expect(writeButtonMappings(command, mappings)).resolves.toEqual(mappings);
    expect(writeCount).toBe(1);
  });

  it("rejects unsupported multi-key custom shortcuts before writing", async () => {
    const command: TransportCommand = async () => {
      throw new Error("command should not be called");
    };
    const mappings = createDefaultButtonMappings();
    mappings[5] = { action: "custom", actionKind: "keyboard", buttonId: "dpi", customKeys: "A+B" };

    await expect(writeButtonMappings(command, mappings)).rejects.toThrow(
      "Custom shortcuts can contain only one non-modifier key"
    );
  });

  it("reads and writes legacy REP4 mappings with stable readback", async () => {
    const quadlets = new Map<number, number[]>([
      [0x01, [0x01, 0x01, 0x01, 0x00]],
      [0x02, [0x01, 0x01, 0x02, 0x00]],
      [0x03, [0x01, 0x01, 0x03, 0x00]],
      [0x04, [0x01, 0x01, 0x04, 0x00]],
      [0x05, [0x01, 0x01, 0x05, 0x00]],
      [0x60, [0x06, 0x01, 0x06, 0x00]]
    ]);
    const command: TransportCommand = async (request) => {
      expect(request.bytes[5]).toBe(0x0a);
      const source = request.bytes[9] | (request.bytes[10] << 8);

      if (request.bytes[7] === 0x0c) {
        quadlets.set(source, [...request.bytes.slice(11, 15)]);
        return responseFor(request);
      }

      const raw = new Uint8Array(90);
      raw.set([0x01, source & 0xff, (source >> 8) & 0xff, ...(quadlets.get(source) ?? [])], 8);
      return responseFor(request, raw);
    };

    await expect(readButtonMappings(command, "legacy-rep4")).resolves.toEqual(createDefaultButtonMappings());

    const mappings = createDefaultButtonMappings();
    mappings[3] = { action: "copy", actionKind: "keyboard", buttonId: "back" };
    await expect(writeButtonMappings(command, mappings, "legacy-rep4")).resolves.toEqual(mappings);
    expect(quadlets.get(0x04)).toEqual([0x02, 0x02, 0x01, 0x06]);
  });
});
