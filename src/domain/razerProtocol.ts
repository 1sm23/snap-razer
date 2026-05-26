import type { ProtocolResponse } from "./types";

export const RAZER_VENDOR_ID = 0x1532;
export const RAZER_REPORT_ID = 0;
export const RAZER_REPORT_LENGTH = 90;
export const RAZER_COMMAND_CLASS_DEVICE = 0x07;
export const WORKING_TRANSACTION_ID = 0x1f;
export const BATTERY_COMMAND_ID = 0x80;
export const CHARGING_COMMAND_ID = 0x84;
export const RAZER_STATUS_SUCCESS = 0x02;
export const RAZER_STATUS_NOT_SUPPORTED = 0x05;
const RAZER_STATUS_BUSY = 0x01;
export const RAZER_PAYLOAD_MAX_LENGTH = 80;

export interface BuildRazerReportOptions {
  commandClass: number;
  commandId: number;
  dataSize: number;
  transactionId?: number;
  payload?: Uint8Array;
}

export function calculateRazerCrc(report: Uint8Array): number {
  let value = 0;
  for (let index = 2; index < 88; index += 1) {
    value ^= report[index];
  }
  return value;
}

function assertByteField(fieldName: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${fieldName} must be an integer between 0 and 255`);
  }
}

export function buildRazerReport(options: BuildRazerReportOptions): Uint8Array {
  const transactionId = options.transactionId ?? WORKING_TRANSACTION_ID;

  assertByteField("commandClass", options.commandClass);
  assertByteField("commandId", options.commandId);
  assertByteField("dataSize", options.dataSize);
  assertByteField("transactionId", transactionId);

  if (options.dataSize > RAZER_PAYLOAD_MAX_LENGTH) {
    throw new RangeError(`dataSize must be ${RAZER_PAYLOAD_MAX_LENGTH} or less`);
  }

  if (options.payload && options.payload.length > RAZER_PAYLOAD_MAX_LENGTH) {
    throw new RangeError(`payload must be ${RAZER_PAYLOAD_MAX_LENGTH} bytes or less`);
  }

  if (options.payload && options.payload.length > options.dataSize) {
    throw new RangeError("payload length must not exceed dataSize");
  }

  const report = new Uint8Array(RAZER_REPORT_LENGTH);

  report[0] = 0x00;
  report[1] = transactionId;
  report[4] = 0x00;
  report[5] = options.dataSize;
  report[6] = options.commandClass;
  report[7] = options.commandId;

  if (options.payload) {
    report.set(options.payload, 8);
  }

  report[88] = calculateRazerCrc(report);
  return report;
}

export function parseRazerResponse(raw: Uint8Array): ProtocolResponse {
  const response = normalizeRazerResponse(raw);

  if (response.length !== RAZER_REPORT_LENGTH) {
    throw new RangeError(`Razer response must be exactly ${RAZER_REPORT_LENGTH} bytes`);
  }

  return {
    raw: response,
    status: response[0],
    transactionId: response[1],
    commandClass: response[6],
    commandId: response[7],
    value: response[9],
    success: response[0] === RAZER_STATUS_SUCCESS
  };
}

function normalizeRazerResponse(raw: Uint8Array): Uint8Array {
  if (raw.length === RAZER_REPORT_LENGTH + 1 && raw[0] === RAZER_REPORT_ID) {
    return raw.slice(1);
  }

  if (raw.length === RAZER_REPORT_LENGTH && raw[0] === RAZER_REPORT_ID && looksLikeShiftedRazerResponse(raw)) {
    const response = new Uint8Array(RAZER_REPORT_LENGTH);
    response.set(raw.slice(1));
    return response;
  }

  return raw;
}

function looksLikeShiftedRazerResponse(raw: Uint8Array): boolean {
  return isKnownRazerStatus(raw[1]) && raw[7] !== 0 && raw[8] !== 0;
}

function isKnownRazerStatus(value: number): boolean {
  return value === RAZER_STATUS_SUCCESS || value === RAZER_STATUS_BUSY;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(" ");
}

export function formatRazerStatus(status: number): string {
  switch (status) {
    case RAZER_STATUS_BUSY:
      return "busy";
    case RAZER_STATUS_SUCCESS:
      return "success";
    case 0x03:
      return "failure";
    case 0x04:
      return "timeout";
    case RAZER_STATUS_NOT_SUPPORTED:
      return "not supported";
    default:
      return `unknown status 0x${status.toString(16)}`;
  }
}
