import { describe, expect, it } from "vitest";
import {
  BATTERY_COMMAND_ID,
  RAZER_COMMAND_CLASS_DEVICE,
  buildRazerReport,
  bytesToHex,
  calculateRazerCrc,
  parseRazerResponse
} from "./razerProtocol";

describe("razerProtocol", () => {
  it("builds a 90-byte battery feature report with crc", () => {
    const report = buildRazerReport({
      commandClass: RAZER_COMMAND_CLASS_DEVICE,
      commandId: BATTERY_COMMAND_ID,
      dataSize: 0x02,
      transactionId: 0x1f
    });

    expect(report).toHaveLength(90);
    expect(report[0]).toBe(0x00);
    expect(report[1]).toBe(0x1f);
    expect(report[5]).toBe(0x02);
    expect(report[6]).toBe(0x07);
    expect(report[7]).toBe(0x80);
    expect(report[88]).toBe(0x85);
    expect(report[88]).toBe(calculateRazerCrc(report));
  });

  it("copies payload at offset 8 and includes it in crc", () => {
    const report = buildRazerReport({
      commandClass: RAZER_COMMAND_CLASS_DEVICE,
      commandId: BATTERY_COMMAND_ID,
      dataSize: 0x04,
      transactionId: 0x1f,
      payload: new Uint8Array([0xaa, 0x55])
    });

    expect(report[8]).toBe(0xaa);
    expect(report[9]).toBe(0x55);
    expect(report[10]).toBe(0x00);
    expect(report[88]).toBe(0x7c);
    expect(report[88]).toBe(calculateRazerCrc(report));
  });

  it.each([
    ["commandClass", { commandClass: -1 }],
    ["commandId", { commandId: 256 }],
    ["dataSize", { dataSize: 1.5 }],
    ["transactionId", { transactionId: Number.NaN }]
  ])("rejects invalid byte field %s", (fieldName, override) => {
    expect(() =>
      buildRazerReport({
        commandClass: RAZER_COMMAND_CLASS_DEVICE,
        commandId: BATTERY_COMMAND_ID,
        dataSize: 0x02,
        transactionId: 0x1f,
        ...override
      })
    ).toThrow(`${fieldName} must be an integer between 0 and 255`);
  });

  it("rejects payloads longer than the report payload area", () => {
    expect(() =>
      buildRazerReport({
        commandClass: RAZER_COMMAND_CLASS_DEVICE,
        commandId: BATTERY_COMMAND_ID,
        dataSize: 0x50,
        payload: new Uint8Array(81)
      })
    ).toThrow("payload must be 80 bytes or less");
  });

  it("rejects dataSize values larger than the report payload area", () => {
    expect(() =>
      buildRazerReport({
        commandClass: RAZER_COMMAND_CLASS_DEVICE,
        commandId: BATTERY_COMMAND_ID,
        dataSize: 0x51
      })
    ).toThrow("dataSize must be 80 or less");
  });

  it("rejects payloads longer than declared dataSize", () => {
    expect(() =>
      buildRazerReport({
        commandClass: RAZER_COMMAND_CLASS_DEVICE,
        commandId: BATTERY_COMMAND_ID,
        dataSize: 0x01,
        payload: new Uint8Array([0x01, 0x02])
      })
    ).toThrow("payload length must not exceed dataSize");
  });

  it("converts bytes to lowercase padded hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe("00 01 0f 10 ff");
  });

  it("parses status and value fields from a response", () => {
    const response = new Uint8Array(90);
    response[0] = 0x02;
    response[1] = 0x1f;
    response[6] = 0x07;
    response[7] = 0x80;
    response[9] = 0x80;

    expect(parseRazerResponse(response)).toEqual({
      raw: response,
      status: 0x02,
      transactionId: 0x1f,
      commandClass: 0x07,
      commandId: 0x80,
      value: 0x80,
      success: true
    });
  });

  it("parses responses that include a leading report id byte", () => {
    const response = new Uint8Array(91);
    response[0] = 0x00;
    response[1] = 0x02;
    response[2] = 0x1f;
    response[7] = 0x07;
    response[8] = 0x80;
    response[10] = 0x80;

    const parsed = parseRazerResponse(response);

    expect(parsed.status).toBe(0x02);
    expect(parsed.commandClass).toBe(0x07);
    expect(parsed.commandId).toBe(0x80);
    expect(parsed.value).toBe(0x80);
    expect(parsed.raw).toHaveLength(90);
  });

  it("parses report-zero responses shifted by a Windows leading report id byte", () => {
    const response = new Uint8Array(90);
    response[0] = 0x00;
    response[1] = 0x02;
    response[2] = 0x1f;
    response[7] = 0x07;
    response[8] = 0x80;
    response[10] = 0x80;

    const parsed = parseRazerResponse(response);

    expect(parsed.status).toBe(0x02);
    expect(parsed.transactionId).toBe(0x1f);
    expect(parsed.commandClass).toBe(0x07);
    expect(parsed.commandId).toBe(0x80);
    expect(parsed.value).toBe(0x80);
    expect(parsed.raw).toHaveLength(90);
  });

  it("rejects truncated responses", () => {
    expect(() => parseRazerResponse(new Uint8Array(89))).toThrow(
      "Razer response must be exactly 90 bytes"
    );
  });

  it("rejects oversized responses", () => {
    const response = new Uint8Array(91);
    response[0] = 0x01;

    expect(() => parseRazerResponse(response)).toThrow(
      "Razer response must be exactly 90 bytes"
    );
  });
});
