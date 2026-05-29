import {
  RAZER_REPORT_ID,
  WORKING_TRANSACTION_ID,
  buildRazerReport,
  formatRazerStatus
} from "../domain/razerProtocol";
import type { ProtocolRequest, ProtocolResponse } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";

const ADVANCED_COMMAND_CLASS = 0x0b;
const DYNAMIC_SENSITIVITY_STATE_GET_COMMAND_ID = 0x90;
const DYNAMIC_SENSITIVITY_STATE_SET_COMMAND_ID = 0x10;
const DYNAMIC_SENSITIVITY_MODE_GET_COMMAND_ID = 0x91;
const DYNAMIC_SENSITIVITY_MODE_SET_COMMAND_ID = 0x11;
const ROTATION_GET_COMMAND_ID = 0x94;
const ROTATION_SET_COMMAND_ID = 0x14;
const DYNAMIC_SENSITIVITY_DATA_SIZE = 0x02;
const ROTATION_DATA_SIZE = 0x03;
const DEFAULT_PROFILE_ID = 0x01;

export const DYNAMIC_SENSITIVITY_MODES = ["classic", "natural", "jump", "custom"] as const;
export type DynamicSensitivityMode = (typeof DYNAMIC_SENSITIVITY_MODES)[number];

const dynamicSensitivityModeToCode: Record<DynamicSensitivityMode, number> = {
  classic: 0x00,
  natural: 0x01,
  jump: 0x02,
  custom: 0x03
};

const codeToDynamicSensitivityMode = new Map<number, DynamicSensitivityMode>(
  Object.entries(dynamicSensitivityModeToCode).map(([mode, code]) => [code, mode as DynamicSensitivityMode])
);

export interface DynamicSensitivitySettings {
  enabled: boolean;
  mode: DynamicSensitivityMode;
  profileId: number;
}

export interface RotationSettings {
  angle: number;
  enabled: boolean;
  profileId: number;
}

export interface AdvancedSettings {
  dynamicSensitivity: DynamicSensitivitySettings;
  rotation: RotationSettings;
}

export async function readAdvancedSettings(command: TransportCommand): Promise<AdvancedSettings> {
  const dynamicSensitivity = await readDynamicSensitivity(command);
  const rotation = await readRotation(command);

  return { dynamicSensitivity, rotation };
}

export async function readDynamicSensitivity(command: TransportCommand): Promise<DynamicSensitivitySettings> {
  const stateResponse = await command(
    buildAdvancedRequest(
      "Read dynamic sensitivity state",
      DYNAMIC_SENSITIVITY_STATE_GET_COMMAND_ID,
      DYNAMIC_SENSITIVITY_DATA_SIZE,
      new Uint8Array([DEFAULT_PROFILE_ID])
    )
  );
  assertAdvancedResponse(stateResponse, DYNAMIC_SENSITIVITY_STATE_GET_COMMAND_ID, "Dynamic sensitivity state");

  const modeResponse = await command(
    buildAdvancedRequest(
      "Read dynamic sensitivity mode",
      DYNAMIC_SENSITIVITY_MODE_GET_COMMAND_ID,
      DYNAMIC_SENSITIVITY_DATA_SIZE,
      new Uint8Array([stateResponse.raw[8] || DEFAULT_PROFILE_ID])
    )
  );
  assertAdvancedResponse(modeResponse, DYNAMIC_SENSITIVITY_MODE_GET_COMMAND_ID, "Dynamic sensitivity mode");

  const mode = codeToDynamicSensitivityMode.get(modeResponse.raw[9]);
  if (!mode) {
    throw new Error(`Unsupported dynamic sensitivity mode code 0x${modeResponse.raw[9].toString(16)}`);
  }

  return {
    enabled: stateResponse.raw[9] !== 0x00,
    mode,
    profileId: stateResponse.raw[8] || DEFAULT_PROFILE_ID
  };
}

export async function setDynamicSensitivity(
  command: TransportCommand,
  settings: DynamicSensitivitySettings
): Promise<DynamicSensitivitySettings> {
  assertProfileId(settings.profileId);

  const stateResponse = await command(
    buildAdvancedRequest(
      "Set dynamic sensitivity state",
      DYNAMIC_SENSITIVITY_STATE_SET_COMMAND_ID,
      DYNAMIC_SENSITIVITY_DATA_SIZE,
      new Uint8Array([settings.profileId, settings.enabled ? 0x01 : 0x00])
    )
  );
  assertAdvancedResponse(stateResponse, DYNAMIC_SENSITIVITY_STATE_SET_COMMAND_ID, "Set dynamic sensitivity state");

  if (settings.enabled) {
    const modeResponse = await command(
      buildAdvancedRequest(
        "Set dynamic sensitivity mode",
        DYNAMIC_SENSITIVITY_MODE_SET_COMMAND_ID,
        DYNAMIC_SENSITIVITY_DATA_SIZE,
        new Uint8Array([settings.profileId, dynamicSensitivityModeToCode[settings.mode]])
      )
    );
    assertAdvancedResponse(modeResponse, DYNAMIC_SENSITIVITY_MODE_SET_COMMAND_ID, "Set dynamic sensitivity mode");
  }

  return settings;
}

export async function readRotation(command: TransportCommand): Promise<RotationSettings> {
  const response = await command(
    buildAdvancedRequest(
      "Read rotation",
      ROTATION_GET_COMMAND_ID,
      ROTATION_DATA_SIZE,
      new Uint8Array([DEFAULT_PROFILE_ID])
    )
  );
  assertAdvancedResponse(response, ROTATION_GET_COMMAND_ID, "Rotation");

  return {
    angle: decodeSignedByte(response.raw[10]),
    enabled: response.raw[9] !== 0x00,
    profileId: response.raw[8] || DEFAULT_PROFILE_ID
  };
}

export async function setRotation(command: TransportCommand, settings: RotationSettings): Promise<RotationSettings> {
  assertProfileId(settings.profileId);
  assertRotationAngle(settings.angle);

  const response = await command(
    buildAdvancedRequest(
      "Set rotation",
      ROTATION_SET_COMMAND_ID,
      ROTATION_DATA_SIZE,
      new Uint8Array([settings.profileId, settings.enabled ? 0x01 : 0x00, encodeSignedByte(settings.angle)])
    )
  );
  assertAdvancedResponse(response, ROTATION_SET_COMMAND_ID, "Set rotation");

  return settings;
}

function buildAdvancedRequest(
  commandName: string,
  commandId: number,
  dataSize: number,
  payload: Uint8Array
): ProtocolRequest {
  return {
    reportId: RAZER_REPORT_ID,
    commandName,
    bytes: buildRazerReport({
      commandClass: ADVANCED_COMMAND_CLASS,
      commandId,
      dataSize,
      transactionId: WORKING_TRANSACTION_ID,
      payload
    })
  };
}

function assertAdvancedResponse(response: ProtocolResponse, expectedCommandId: number, label: string): void {
  if (!response.success) {
    throw new Error(`${label} command failed with status ${response.status} (${formatRazerStatus(response.status)})`);
  }

  if (response.commandClass !== ADVANCED_COMMAND_CLASS || response.commandId !== expectedCommandId) {
    throw new Error(
      `${label} command response mismatch: expected 0x${ADVANCED_COMMAND_CLASS.toString(
        16
      )}/0x${expectedCommandId.toString(16)}, got 0x${response.commandClass.toString(
        16
      )}/0x${response.commandId.toString(16)}`
    );
  }
}

function assertProfileId(profileId: number): void {
  if (!Number.isInteger(profileId) || profileId < 0 || profileId > 0xff) {
    throw new Error("Profile id must be a byte");
  }
}

function assertRotationAngle(angle: number): void {
  if (!Number.isInteger(angle) || angle < -44 || angle > 44) {
    throw new Error("Rotation angle must be between -44 and 44");
  }
}

function decodeSignedByte(value: number): number {
  return value >= 0x80 ? value - 0x100 : value;
}

function encodeSignedByte(value: number): number {
  return value < 0 ? value + 0x100 : value;
}
