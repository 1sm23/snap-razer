import { describe, expect, it } from "vitest";
import {
  RAZER_STATUS_NOT_SUPPORTED,
  RAZER_STATUS_SUCCESS,
  parseRazerResponse
} from "./razerProtocol";

function makeShiftedResponse({
  commandClass,
  commandId,
  status,
  transactionId = 0x1f,
  value = 0
}: {
  commandClass: number;
  commandId: number;
  status: number;
  transactionId?: number;
  value?: number;
}): Uint8Array {
  const raw = new Uint8Array(90);
  raw[0] = 0x00;
  raw[1] = status;
  raw[2] = transactionId;
  raw[7] = commandClass;
  raw[8] = commandId;
  raw[10] = value;
  return raw;
}

describe("report-zero response normalization", () => {
  it("normalizes shifted responses whose command class is zero", () => {
    const response = parseRazerResponse(
      makeShiftedResponse({
        commandClass: 0x00,
        commandId: 0xc0,
        status: RAZER_STATUS_SUCCESS,
        value: 0x08
      }),
      {
        expectedCommandClass: 0x00,
        expectedCommandId: 0xc0
      }
    );

    expect(response.status).toBe(RAZER_STATUS_SUCCESS);
    expect(response.transactionId).toBe(0x1f);
    expect(response.commandClass).toBe(0x00);
    expect(response.commandId).toBe(0xc0);
    expect(response.value).toBe(0x08);
  });

  it("normalizes shifted not-supported responses so protocol fallbacks can run", () => {
    const response = parseRazerResponse(
      makeShiftedResponse({
        commandClass: 0x00,
        commandId: 0xc0,
        status: RAZER_STATUS_NOT_SUPPORTED
      }),
      {
        expectedCommandClass: 0x00,
        expectedCommandId: 0xc0
      }
    );

    expect(response.status).toBe(RAZER_STATUS_NOT_SUPPORTED);
    expect(response.success).toBe(false);
    expect(response.commandClass).toBe(0x00);
    expect(response.commandId).toBe(0xc0);
  });
});
