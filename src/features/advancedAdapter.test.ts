import { describe, expect, it, vi } from "vitest";
import type { ProtocolResponse } from "../domain/types";
import {
  readDynamicSensitivity,
  readRotation,
  setDynamicSensitivity,
  setRotation
} from "./advancedAdapter";

function makeResponse(commandId: number, payload: readonly number[]): ProtocolResponse {
  const raw = new Uint8Array(90);
  raw[0] = 0x02;
  raw[1] = 0x1f;
  raw[6] = 0x0b;
  raw[7] = commandId;
  raw.set(payload, 8);

  return {
    commandClass: 0x0b,
    commandId,
    raw,
    status: 0x02,
    success: true,
    transactionId: 0x1f,
    value: raw[9]
  };
}

describe("advancedAdapter", () => {
  it("reads dynamic sensitivity state and mode", async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(0x90, [0x01, 0x01]))
      .mockResolvedValueOnce(makeResponse(0x91, [0x01, 0x02]));

    await expect(readDynamicSensitivity(command)).resolves.toEqual({
      enabled: true,
      mode: "jump",
      profileId: 1
    });
    expect(command.mock.calls[0][0].bytes[5]).toBe(0x02);
    expect(command.mock.calls[0][0].bytes[6]).toBe(0x0b);
    expect(command.mock.calls[0][0].bytes[7]).toBe(0x90);
    expect(command.mock.calls[0][0].bytes[8]).toBe(0x01);
  });

  it("writes dynamic sensitivity state and mode when enabled", async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(0x10, [0x01, 0x01]))
      .mockResolvedValueOnce(makeResponse(0x11, [0x01, 0x01]));

    await expect(
      setDynamicSensitivity(command, { enabled: true, mode: "natural", profileId: 1 })
    ).resolves.toEqual({
      enabled: true,
      mode: "natural",
      profileId: 1
    });
    expect(command.mock.calls.map(([request]) => request.bytes[7])).toEqual([0x10, 0x11]);
    expect([...command.mock.calls[1][0].bytes.slice(8, 10)]).toEqual([0x01, 0x01]);
  });

  it("writes only dynamic sensitivity state when disabled", async () => {
    const command = vi.fn().mockResolvedValueOnce(makeResponse(0x10, [0x01, 0x00]));

    await setDynamicSensitivity(command, { enabled: false, mode: "classic", profileId: 1 });

    expect(command).toHaveBeenCalledTimes(1);
    expect([...command.mock.calls[0][0].bytes.slice(8, 10)]).toEqual([0x01, 0x00]);
  });

  it("reads rotation with signed angle values", async () => {
    const command = vi.fn().mockResolvedValueOnce(makeResponse(0x94, [0x01, 0x01, 0xff]));

    await expect(readRotation(command)).resolves.toEqual({
      angle: -1,
      enabled: true,
      profileId: 1
    });
  });

  it("writes rotation with signed angle values", async () => {
    const command = vi.fn().mockResolvedValueOnce(makeResponse(0x14, [0x01, 0x01, 0xd4]));

    await expect(setRotation(command, { angle: -44, enabled: true, profileId: 1 })).resolves.toEqual({
      angle: -44,
      enabled: true,
      profileId: 1
    });
    expect(command.mock.calls[0][0].bytes[5]).toBe(0x03);
    expect(command.mock.calls[0][0].bytes[7]).toBe(0x14);
    expect([...command.mock.calls[0][0].bytes.slice(8, 11)]).toEqual([0x01, 0x01, 0xd4]);
  });
});
