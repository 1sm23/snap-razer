import {
  RAZER_COMMAND_CLASS_DEVICE,
  RAZER_REPORT_ID,
  WORKING_TRANSACTION_ID,
  buildRazerReport,
  formatRazerStatus
} from "../domain/razerProtocol";
import type { ProtocolRequest, ProtocolResponse } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";

const IDLE_TIME_GET_COMMAND_ID = 0x83;
const IDLE_TIME_SET_COMMAND_ID = 0x03;
const LOW_BATTERY_THRESHOLD_GET_COMMAND_ID = 0x81;
const LOW_BATTERY_THRESHOLD_SET_COMMAND_ID = 0x01;
const IDLE_TIME_DATA_SIZE = 0x02;
const LOW_BATTERY_THRESHOLD_DATA_SIZE = 0x01;
const IDLE_TIME_MIN_SECONDS = 60;
const IDLE_TIME_MAX_SECONDS = 900;
const LOW_BATTERY_THRESHOLD_MIN_RAW = 0x0c;
const LOW_BATTERY_THRESHOLD_MAX_RAW = 0xff;

export interface IdleTimeResult {
  seconds: number;
  minutes: number;
}

export interface LowBatteryThresholdResult {
  rawThreshold: number;
  percent: number;
}

export async function readIdleTime(command: TransportCommand): Promise<IdleTimeResult> {
  const response = await command(
    buildPowerRequest("Read idle time", IDLE_TIME_GET_COMMAND_ID, IDLE_TIME_DATA_SIZE)
  );
  assertPowerResponse(response, IDLE_TIME_GET_COMMAND_ID, "Idle time");

  return normalizeIdleTime(readUint16(response.raw, 8));
}

export async function setIdleTime(command: TransportCommand, minutes: number): Promise<IdleTimeResult> {
  assertIdleTimeMinutes(minutes);
  const seconds = minutes * 60;
  const payload = new Uint8Array([(seconds >> 8) & 0xff, seconds & 0xff]);

  const response = await command(
    buildPowerRequest("Set idle time", IDLE_TIME_SET_COMMAND_ID, IDLE_TIME_DATA_SIZE, payload)
  );
  assertPowerResponse(response, IDLE_TIME_SET_COMMAND_ID, "Set idle time");

  return { seconds, minutes };
}

export async function readLowBatteryThreshold(command: TransportCommand): Promise<LowBatteryThresholdResult> {
  const response = await command(
    buildPowerRequest(
      "Read low battery threshold",
      LOW_BATTERY_THRESHOLD_GET_COMMAND_ID,
      LOW_BATTERY_THRESHOLD_DATA_SIZE
    )
  );
  assertPowerResponse(response, LOW_BATTERY_THRESHOLD_GET_COMMAND_ID, "Low battery threshold");

  return normalizeLowBatteryThreshold(response.raw[8]);
}

export async function setLowBatteryThreshold(
  command: TransportCommand,
  percent: number
): Promise<LowBatteryThresholdResult> {
  assertLowBatteryThresholdPercent(percent);
  const rawThreshold = percentToRawThreshold(percent);
  const payload = new Uint8Array([rawThreshold]);

  const response = await command(
    buildPowerRequest(
      "Set low battery threshold",
      LOW_BATTERY_THRESHOLD_SET_COMMAND_ID,
      LOW_BATTERY_THRESHOLD_DATA_SIZE,
      payload
    )
  );
  assertPowerResponse(response, LOW_BATTERY_THRESHOLD_SET_COMMAND_ID, "Set low battery threshold");

  return { rawThreshold, percent };
}

function buildPowerRequest(
  commandName: string,
  commandId: number,
  dataSize: number,
  payload?: Uint8Array
): ProtocolRequest {
  return {
    reportId: RAZER_REPORT_ID,
    commandName,
    bytes: buildRazerReport({
      commandClass: RAZER_COMMAND_CLASS_DEVICE,
      commandId,
      dataSize,
      transactionId: WORKING_TRANSACTION_ID,
      payload
    })
  };
}

function assertPowerResponse(response: ProtocolResponse, expectedCommandId: number, label: string): void {
  if (!response.success) {
    throw new Error(`${label} command failed with status ${response.status} (${formatRazerStatus(response.status)})`);
  }

  if (response.commandClass !== RAZER_COMMAND_CLASS_DEVICE || response.commandId !== expectedCommandId) {
    throw new Error(
      `${label} command response mismatch: expected 0x${RAZER_COMMAND_CLASS_DEVICE.toString(
        16
      )}/0x${expectedCommandId.toString(16)}, got 0x${response.commandClass.toString(
        16
      )}/0x${response.commandId.toString(16)}`
    );
  }
}

function normalizeIdleTime(seconds: number): IdleTimeResult {
  if (!Number.isInteger(seconds) || seconds < IDLE_TIME_MIN_SECONDS || seconds > IDLE_TIME_MAX_SECONDS) {
    throw new RangeError(`Idle time must be between ${IDLE_TIME_MIN_SECONDS} and ${IDLE_TIME_MAX_SECONDS} seconds`);
  }

  return {
    seconds,
    minutes: Math.round(seconds / 60)
  };
}

function normalizeLowBatteryThreshold(rawThreshold: number): LowBatteryThresholdResult {
  if (
    !Number.isInteger(rawThreshold) ||
    rawThreshold < LOW_BATTERY_THRESHOLD_MIN_RAW ||
    rawThreshold > LOW_BATTERY_THRESHOLD_MAX_RAW
  ) {
    throw new RangeError(
      `Low battery threshold must be between ${LOW_BATTERY_THRESHOLD_MIN_RAW} and ${LOW_BATTERY_THRESHOLD_MAX_RAW}`
    );
  }

  return {
    rawThreshold,
    percent: rawThresholdToPercent(rawThreshold)
  };
}

function assertIdleTimeMinutes(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 15) {
    throw new RangeError("Idle time must be between 1 and 15 minutes");
  }
}

function assertLowBatteryThresholdPercent(percent: number): void {
  if (!Number.isInteger(percent) || percent < 5 || percent > 100) {
    throw new RangeError("Low battery threshold must be between 5 and 100 percent");
  }
}

function rawThresholdToPercent(rawThreshold: number): number {
  return Math.round((rawThreshold * 100) / 255);
}

function percentToRawThreshold(percent: number): number {
  return Math.round((percent * 255) / 100);
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}
