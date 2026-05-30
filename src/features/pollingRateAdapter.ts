import {
  RAZER_STATUS_NOT_SUPPORTED,
  RAZER_REPORT_ID,
  WORKING_TRANSACTION_ID,
  buildRazerReport,
  formatRazerStatus
} from "../domain/razerProtocol";
import type { ProtocolRequest, ProtocolResponse } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";

const POLLING_COMMAND_CLASS = 0x00;
const POLLING_GET_COMMAND_ID = 0x85;
const POLLING_SET_COMMAND_ID = 0x05;
const POLLING_GET_COMMAND_ID_2 = 0xc0;
const POLLING_SET_COMMAND_ID_2 = 0x40;
const RATE2_WRITE_SEQUENCES: readonly (readonly PollingRate2WriteStep[])[] = [
  [{ argument: 0x00 }],
  [{ argument: 0x00 }, { argument: 0x01 }],
  [{ argument: 0x00 }, { argument: 0x01, transactionId: 0xff }],
  [{ argument: 0x01 }, { argument: 0x00 }]
];

export const POLLING_RATE2_RATES = [125, 500, 1000, 2000, 4000, 8000] as const;
export const LEGACY_POLLING_RATES = [125, 500, 1000] as const;
export const POLLING_RATES = POLLING_RATE2_RATES;
export type PollingRate = (typeof POLLING_RATE2_RATES)[number];

export interface PollingRateResult {
  pollingRate: PollingRate;
  supportedRates: readonly PollingRate[];
}

const pollingRateToCode: Record<PollingRate, number> = {
  125: 0x40,
  500: 0x10,
  1000: 0x08,
  2000: 0x04,
  4000: 0x02,
  8000: 0x01
};

const codeToPollingRate = new Map<number, PollingRate>(
  Object.entries(pollingRateToCode).map(([rate, code]) => [code, Number(rate) as PollingRate])
);

const legacyPollingRateToCode: Record<Extract<PollingRate, 125 | 500 | 1000>, number> = {
  125: 0x08,
  500: 0x02,
  1000: 0x01
};

const legacyCodeToPollingRate = new Map<number, PollingRate>(
  Object.entries(legacyPollingRateToCode).map(([rate, code]) => [code, Number(rate) as PollingRate])
);

interface PollingRate2WriteStep {
  argument: number;
  transactionId?: number;
}

export async function readPollingRate(command: TransportCommand): Promise<PollingRate> {
  const result = await readPollingRateProfile(command);
  return result.pollingRate;
}

export async function readPollingRateProfile(command: TransportCommand): Promise<PollingRateResult> {
  const pollingRate2Response = await command(
    buildPollingRequest("Read polling rate", POLLING_GET_COMMAND_ID_2, 0x01, new Uint8Array())
  );

  if (pollingRate2Response.status !== RAZER_STATUS_NOT_SUPPORTED) {
    assertPollingResponse(pollingRate2Response, POLLING_GET_COMMAND_ID_2, "Polling rate");

    const pollingRate = codeToPollingRate.get(pollingRate2Response.raw[9]);
    if (!pollingRate) {
      throw new Error(`Unsupported polling rate2 code 0x${pollingRate2Response.raw[9].toString(16)}`);
    }

    return {
      pollingRate,
      supportedRates: POLLING_RATE2_RATES
    };
  }

  const legacyResponse = await command(buildPollingRequest("Read polling rate (legacy)", POLLING_GET_COMMAND_ID, 0x01, new Uint8Array()));
  assertPollingResponse(legacyResponse, POLLING_GET_COMMAND_ID, "Legacy polling rate");

  const pollingRate = legacyCodeToPollingRate.get(legacyResponse.raw[8]);
  if (!pollingRate) {
    throw new Error(`Unsupported legacy polling rate code 0x${legacyResponse.raw[8].toString(16)}`);
  }

  return {
    pollingRate,
    supportedRates: LEGACY_POLLING_RATES
  };
}

export async function setPollingRate(command: TransportCommand, pollingRate: number): Promise<PollingRate> {
  assertPollingRate(pollingRate);

  const pollingRate2Code = pollingRateToCode[pollingRate];
  const legacyCode = legacyPollingRateToCode[pollingRate as keyof typeof legacyPollingRateToCode];
  let shouldTryLegacy = false;
  let lastReadback: PollingRate | null = null;
  let lastReadbackError: unknown = null;

  for (const sequence of RATE2_WRITE_SEQUENCES) {
    const writeResult = await writePollingRate2Sequence(command, pollingRate2Code, sequence);
    if (writeResult === "notSupported") {
      shouldTryLegacy = true;
      break;
    }

    try {
      const confirmedPollingRate = await readPollingRate(command);
      lastReadback = confirmedPollingRate;
      if (confirmedPollingRate === pollingRate) {
        return pollingRate;
      }
    } catch (caught) {
      lastReadbackError = caught;
    }
  }

  if (shouldTryLegacy) {
    if (legacyCode === undefined) {
      throw new Error(`${pollingRate} Hz is only available through polling rate2, but this device reports not supported.`);
    }

    const response = await command(
      buildPollingRequest("Set polling rate (legacy)", POLLING_SET_COMMAND_ID, 0x01, new Uint8Array([legacyCode]))
    );
    assertPollingResponse(response, POLLING_SET_COMMAND_ID, "Legacy set polling rate");
    return pollingRate;
  }

  if (lastReadback !== null) {
    throw new Error(`Set polling rate was acknowledged, but device still reports ${lastReadback} Hz.`);
  }

  throw new Error(
    `Set polling rate was acknowledged, but readback failed: ${
      lastReadbackError instanceof Error ? lastReadbackError.message : String(lastReadbackError)
    }`
  );
}

async function writePollingRate2Sequence(
  command: TransportCommand,
  pollingRate2Code: number,
  sequence: readonly PollingRate2WriteStep[]
): Promise<"ok" | "notSupported"> {
  for (const step of sequence) {
    const response = await command(
      buildPollingRequest(
        "Set polling rate",
        POLLING_SET_COMMAND_ID_2,
        0x02,
        new Uint8Array([step.argument, pollingRate2Code]),
        step.transactionId
      )
    );

    if (response.status === RAZER_STATUS_NOT_SUPPORTED) {
      return "notSupported";
    }

    assertPollingResponse(response, POLLING_SET_COMMAND_ID_2, "Set polling rate");
  }

  return "ok";
}

function buildPollingRequest(
  commandName: string,
  commandId: number,
  dataSize: number,
  payload: Uint8Array,
  transactionId?: number
): ProtocolRequest {
  return {
    reportId: RAZER_REPORT_ID,
    commandName,
    bytes: buildRazerReport({
      commandClass: POLLING_COMMAND_CLASS,
      commandId,
      dataSize,
      transactionId: transactionId ?? WORKING_TRANSACTION_ID,
      payload
    })
  };
}

function assertPollingResponse(response: ProtocolResponse, expectedCommandId: number, label: string): void {
  if (!response.success) {
    throw new Error(`${label} command failed with status ${response.status} (${formatRazerStatus(response.status)})`);
  }

  if (response.commandClass !== POLLING_COMMAND_CLASS || response.commandId !== expectedCommandId) {
    throw new Error(
      `${label} command response mismatch: expected 0x${POLLING_COMMAND_CLASS.toString(16)}/0x${expectedCommandId.toString(
        16
      )}, got 0x${response.commandClass.toString(16)}/0x${response.commandId.toString(16)}`
    );
  }
}

function assertPollingRate(value: number): asserts value is PollingRate {
  if (!POLLING_RATES.includes(value as PollingRate)) {
    throw new Error("Unsupported polling rate");
  }
}
