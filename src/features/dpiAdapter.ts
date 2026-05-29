import {
  RAZER_REPORT_ID,
  WORKING_TRANSACTION_ID,
  buildRazerReport,
  formatRazerStatus
} from "../domain/razerProtocol";
import type { ProtocolRequest, ProtocolResponse } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";

const DPI_COMMAND_CLASS = 0x04;
const DPI_SET_COMMAND_ID = 0x05;
const DPI_GET_COMMAND_ID = 0x85;
const DPI_STAGES_SET_COMMAND_ID = 0x06;
const DPI_STAGES_GET_COMMAND_ID = 0x86;
const DPI_DATA_SIZE = 0x07;
const DPI_STAGES_DATA_SIZE = 0x26;
const NOSTORE = 0x00;
const VARSTORE = 0x01;
const DPI_MIN = 100;
const DPI_MAX = 45000;
const DPI_STAGE_MAX_COUNT = 5;

export interface DpiValue {
  x: number;
  y: number;
}

export interface DpiStage extends DpiValue {
  enabled?: boolean;
  id: number;
}

export interface DpiStages {
  activeStage: number;
  stages: DpiStage[];
}

interface DpiReadOptions {
  commandName?: string;
  log?: boolean;
}

export async function readDpi(command: TransportCommand): Promise<DpiValue> {
  const response = await command(buildDpiRequest("Read DPI", DPI_GET_COMMAND_ID, DPI_DATA_SIZE, new Uint8Array([NOSTORE])));
  assertDpiResponse(response, DPI_GET_COMMAND_ID, "DPI");

  const dpi = {
    x: readUint16(response.raw, 9),
    y: readUint16(response.raw, 11)
  };

  assertDpiValue(dpi.x);
  assertDpiValue(dpi.y);
  return dpi;
}

export async function setDpi(command: TransportCommand, dpi: DpiValue): Promise<DpiValue> {
  assertDpiValue(dpi.x);
  assertDpiValue(dpi.y);

  const payload = new Uint8Array([
    NOSTORE,
    (dpi.x >> 8) & 0xff,
    dpi.x & 0xff,
    (dpi.y >> 8) & 0xff,
    dpi.y & 0xff,
    0x00,
    0x00
  ]);

  const response = await command(buildDpiRequest("Set DPI", DPI_SET_COMMAND_ID, DPI_DATA_SIZE, payload));
  assertDpiResponse(response, DPI_SET_COMMAND_ID, "Set DPI");

  return dpi;
}

export async function readDpiStages(command: TransportCommand, options: DpiReadOptions = {}): Promise<DpiStages> {
  const response = await command(
    buildDpiRequest(
      options.commandName ?? "Read DPI stages",
      DPI_STAGES_GET_COMMAND_ID,
      DPI_STAGES_DATA_SIZE,
      new Uint8Array([VARSTORE]),
      options.log
    )
  );
  assertDpiResponse(response, DPI_STAGES_GET_COMMAND_ID, "DPI stages");

  const activeStage = response.raw[9];
  const stageCount = response.raw[10];
  const stages: DpiStage[] = [];

  if (!Number.isInteger(stageCount) || stageCount < 1 || stageCount > DPI_STAGE_MAX_COUNT) {
    throw new Error("DPI stage count must be between 1 and 5");
  }

  for (let index = 0; index < stageCount; index += 1) {
    const offset = 11 + index * 7;
    const stage = {
      enabled: true,
      id: index + 1,
      x: readUint16(response.raw, offset + 1),
      y: readUint16(response.raw, offset + 3)
    };

    assertDpiValue(stage.x);
    assertDpiValue(stage.y);
    stages.push(stage);
  }

  return { activeStage, stages };
}

export async function writeDpiStages(command: TransportCommand, dpiStages: DpiStages): Promise<DpiStages> {
  assertDpiStages(dpiStages);

  const enabledStages = getEnabledStages(dpiStages);
  const activeEnabledStageIndex = enabledStages.findIndex((stage) => stage.id === dpiStages.activeStage);
  const deviceActiveStage = activeEnabledStageIndex >= 0 ? activeEnabledStageIndex + 1 : 1;
  const payload = new Uint8Array(DPI_STAGES_DATA_SIZE);
  payload[0] = VARSTORE;
  payload[1] = deviceActiveStage;
  payload[2] = enabledStages.length;

  enabledStages.forEach((stage, index) => {
    const offset = 3 + index * 7;
    payload[offset] = index;
    payload[offset + 1] = (stage.x >> 8) & 0xff;
    payload[offset + 2] = stage.x & 0xff;
    payload[offset + 3] = (stage.y >> 8) & 0xff;
    payload[offset + 4] = stage.y & 0xff;
    payload[offset + 5] = 0x00;
    payload[offset + 6] = 0x00;
  });

  const response = await command(buildDpiRequest("Set DPI stages", DPI_STAGES_SET_COMMAND_ID, DPI_STAGES_DATA_SIZE, payload));
  assertDpiResponse(response, DPI_STAGES_SET_COMMAND_ID, "Set DPI stages");

  return dpiStages;
}

function buildDpiRequest(
  commandName: string,
  commandId: number,
  dataSize: number,
  payload: Uint8Array,
  log?: boolean
): ProtocolRequest {
  return {
    reportId: RAZER_REPORT_ID,
    commandName,
    log,
    bytes: buildRazerReport({
      commandClass: DPI_COMMAND_CLASS,
      commandId,
      dataSize,
      transactionId: WORKING_TRANSACTION_ID,
      payload
    })
  };
}

function assertDpiResponse(response: ProtocolResponse, expectedCommandId: number, label: string): void {
  if (!response.success) {
    throw new Error(`${label} command failed with status ${response.status} (${formatRazerStatus(response.status)})`);
  }

  if (response.commandClass !== DPI_COMMAND_CLASS || response.commandId !== expectedCommandId) {
    throw new Error(
      `${label} command response mismatch: expected 0x${DPI_COMMAND_CLASS.toString(16)}/0x${expectedCommandId.toString(
        16
      )}, got 0x${response.commandClass.toString(16)}/0x${response.commandId.toString(16)}`
    );
  }
}

function assertDpiValue(value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error("DPI must be an integer");
  }

  if (value < DPI_MIN || value > DPI_MAX) {
    throw new Error(`DPI must be between ${DPI_MIN} and ${DPI_MAX}`);
  }
}

function assertDpiStages(dpiStages: DpiStages): void {
  if (!Number.isInteger(dpiStages.activeStage) || dpiStages.activeStage < 1) {
    throw new Error("Active DPI stage must be a positive integer");
  }

  if (dpiStages.stages.length < 1 || dpiStages.stages.length > DPI_STAGE_MAX_COUNT) {
    throw new Error("DPI stage count must be between 1 and 5");
  }

  const enabledStages = getEnabledStages(dpiStages);

  if (enabledStages.length < 1) {
    throw new Error("At least one DPI stage must be enabled");
  }

  if (dpiStages.activeStage > dpiStages.stages.length) {
    throw new Error("Active DPI stage cannot exceed stage count");
  }

  if (!enabledStages.some((stage) => stage.id === dpiStages.activeStage)) {
    throw new Error("Active DPI stage must be enabled");
  }

  for (const stage of dpiStages.stages) {
    if (stage.enabled !== undefined && typeof stage.enabled !== "boolean") {
      throw new Error("DPI stage enabled state must be a boolean");
    }

    assertDpiValue(stage.x);
    assertDpiValue(stage.y);
  }
}

function isDpiStageEnabled(stage: DpiStage): boolean {
  return stage.enabled ?? true;
}

function getEnabledStages(dpiStages: DpiStages): DpiStage[] {
  return dpiStages.stages.filter(isDpiStageEnabled);
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}
