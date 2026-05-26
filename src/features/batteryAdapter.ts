import {
  BATTERY_COMMAND_ID,
  CHARGING_COMMAND_ID,
  RAZER_COMMAND_CLASS_DEVICE,
  RAZER_REPORT_ID,
  buildRazerReport,
  formatRazerStatus
} from "../domain/razerProtocol";
import type { ProtocolRequest } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";

export interface BatteryResult {
  rawBattery: number;
  percent: number;
}

export interface ChargingResult {
  rawCharging: number;
  isCharging: boolean;
}

function buildDeviceRequest(commandName: string, commandId: number): ProtocolRequest {
  return {
    reportId: RAZER_REPORT_ID,
    commandName,
    bytes: buildRazerReport({
      commandClass: RAZER_COMMAND_CLASS_DEVICE,
      commandId,
      dataSize: 0x02
    })
  };
}

function assertDeviceResponse(commandName: string, commandId: number, responseCommandClass: number, responseCommandId: number): void {
  if (responseCommandClass !== RAZER_COMMAND_CLASS_DEVICE || responseCommandId !== commandId) {
    throw new Error(
      `${commandName} command response mismatch: expected class ${RAZER_COMMAND_CLASS_DEVICE} id ${commandId}, got class ${responseCommandClass} id ${responseCommandId}`
    );
  }
}

function assertBatteryByte(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`Battery value must be a byte, got ${value}`);
  }
}

export async function readBattery(command: TransportCommand): Promise<BatteryResult> {
  const response = await command(buildDeviceRequest("Read battery", BATTERY_COMMAND_ID));

  if (!response.success) {
    throw new Error(`Battery command failed with status ${response.status} (${formatRazerStatus(response.status)})`);
  }

  assertDeviceResponse("Battery", BATTERY_COMMAND_ID, response.commandClass, response.commandId);
  assertBatteryByte(response.value);

  return {
    rawBattery: response.value,
    percent: Math.round((response.value * 100) / 255)
  };
}

export async function readCharging(command: TransportCommand): Promise<ChargingResult> {
  const response = await command(buildDeviceRequest("Read charging", CHARGING_COMMAND_ID));

  if (!response.success) {
    throw new Error(`Charging command failed with status ${response.status} (${formatRazerStatus(response.status)})`);
  }

  assertDeviceResponse("Charging", CHARGING_COMMAND_ID, response.commandClass, response.commandId);

  return {
    rawCharging: response.value,
    isCharging: response.value !== 0
  };
}
