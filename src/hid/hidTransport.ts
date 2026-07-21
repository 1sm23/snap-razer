import type {
  ConnectedDevice,
  HidLogEntry,
  ProtocolRequest,
  ProtocolRequestKind,
  ProtocolResponse
} from "../domain/types";
import {
  BATTERY_COMMAND_ID,
  RAZER_COMMAND_CLASS_DEVICE,
  RAZER_REPORT_ID,
  RAZER_STATUS_BUSY,
  RAZER_VENDOR_ID,
  buildRazerReport,
  bytesToHex,
  parseRazerResponse
} from "../domain/razerProtocol";

export type TransportCommand = (request: ProtocolRequest) => Promise<ProtocolResponse>;

export interface HidTransportSnapshot {
  device: ConnectedDevice | null;
  logs: HidLogEntry[];
}

const RAZER_REQUEST_FILTERS: HIDDeviceFilter[] = [{ vendorId: RAZER_VENDOR_ID }];
const COMMAND_RESPONSE_INITIAL_DELAY_MS = 100;
const CONTROL_PROBE_RESPONSE_INITIAL_DELAY_MS = 35;
const BUSY_RESPONSE_RETRY_DELAY_MS = 50;
const BUSY_RESPONSE_MAX_RETRIES = 10;
const MAX_LOG_ENTRIES = 250;
const WRITE_COMMAND_NAME_PATTERN = /^(?:set|write|apply|reset)\b/i;

const CONTROL_PROBE_REPORT = buildRazerReport({
  commandClass: RAZER_COMMAND_CLASS_DEVICE,
  commandId: BATTERY_COMMAND_ID,
  dataSize: 0x02
});

type ReportZeroFrameMode = "without-leading-report-byte" | "with-leading-report-byte";

interface DeviceSelection {
  device: HIDDevice;
  frameMode: ReportZeroFrameMode | null;
}

interface SendCandidate {
  label: string;
  bytes: Uint8Array;
  frameMode: ReportZeroFrameMode | null;
}

interface CommandExchangeResult {
  frameMode: ReportZeroFrameMode | null;
  response: ProtocolResponse;
  sendAttempts: string[];
}

class CommandExchangeError extends Error {
  constructor(
    message: string,
    readonly sendAttempts: string[]
  ) {
    super(message);
    this.name = "CommandExchangeError";
  }
}

export class HidSessionChangedError extends Error {
  constructor(commandName: string) {
    super(`The HID session changed before ${commandName} could finish.`);
    this.name = "HidSessionChangedError";
  }
}

export class HidTransport {
  private device: HIDDevice | null = null;
  private logs: HidLogEntry[] = [];
  private operationTail: Promise<void> = Promise.resolve();
  private reportZeroFrameMode: ReportZeroFrameMode | null = null;
  private sessionGeneration = 0;

  isSupported(): boolean {
    return Boolean(navigator.hid);
  }

  snapshot(): HidTransportSnapshot {
    return {
      device: this.device
        ? {
            productName: this.device.productName,
            vendorId: this.device.vendorId,
            productId: this.device.productId,
            opened: this.device.opened,
            writableReports: hasAnyFeatureReport(this.device),
            featureReportProbeAllowed: canTryReportZeroFeatureProbe(this.device),
            descriptorSummary: describeReports(this.device)
          }
        : null,
      logs: this.logs.map(copyLogEntry)
    };
  }

  clear(): void {
    this.invalidateSession();
    this.clearLogs();
  }

  clearLogs(): void {
    this.logs = [];
  }

  async disconnect(): Promise<void> {
    const currentDevice = this.device;
    this.invalidateSession();
    this.clearLogs();

    await this.enqueueExclusive(async () => {
      if (currentDevice?.opened) {
        await currentDevice.close();
      }
    });
  }

  openAuthorized(): Promise<ConnectedDevice | null> {
    if (!navigator.hid) {
      return Promise.reject(new Error("WebHID is not available in this browser."));
    }

    const requestedGeneration = this.sessionGeneration;

    return this.enqueueExclusive(async () => {
      const alreadyAllowed = await navigator.hid!.getDevices();
      const alreadyAllowedRazerDevices = alreadyAllowed.filter((device) => device.vendorId === RAZER_VENDOR_ID);
      const selection = await chooseBestDeviceWithProbe(alreadyAllowedRazerDevices);

      if (!selection) {
        return null;
      }

      return this.activateSelection(selection, requestedGeneration, "Open authorized Razer device");
    });
  }

  requestAndOpen(): Promise<ConnectedDevice | null> {
    if (!navigator.hid) {
      return Promise.reject(new Error("WebHID is not available in this browser."));
    }

    const requestedGeneration = this.sessionGeneration;

    return this.enqueueExclusive(async () => {
      const selectedDevices = await navigator.hid!.requestDevice({
        filters: RAZER_REQUEST_FILTERS
      });
      const selectedRazerDevices = selectedDevices.filter((device) => device.vendorId === RAZER_VENDOR_ID);
      const selection = await chooseBestDeviceWithProbe(selectedRazerDevices);

      if (!selection) {
        throw new Error("No Razer HID device was selected.");
      }

      return this.activateSelection(selection, requestedGeneration, "Open selected Razer device");
    });
  }

  command: TransportCommand = (request) => {
    const device = this.device;
    const generation = this.sessionGeneration;

    if (!device) {
      return Promise.reject(new Error("No HID device is connected."));
    }

    return this.enqueueExclusive(() => this.executeCommand(device, generation, request));
  };

  private async activateSelection(
    selection: DeviceSelection,
    requestedGeneration: number,
    operationName: string
  ): Promise<ConnectedDevice> {
    const selectedDevice = selection.device;

    if (requestedGeneration !== this.sessionGeneration) {
      await closeIfNotCurrent(selectedDevice, this.device);
      throw new HidSessionChangedError(operationName);
    }

    if (!selectedDevice.opened) {
      await selectedDevice.open();
    }

    if (requestedGeneration !== this.sessionGeneration) {
      await closeIfNotCurrent(selectedDevice, this.device);
      throw new HidSessionChangedError(operationName);
    }

    const previousDevice = this.device;
    if (previousDevice && previousDevice !== selectedDevice && previousDevice.opened) {
      try {
        await previousDevice.close();
      } catch (error) {
        console.warn("Snap Razer could not close the previous HID device.", error);
      }
    }

    this.sessionGeneration += 1;
    this.device = selectedDevice;
    this.reportZeroFrameMode = selection.frameMode;
    this.clearLogs();

    const connected = this.snapshot().device;
    if (!connected) {
      throw new Error("The selected HID device could not be activated.");
    }

    return connected;
  }

  private async executeCommand(
    device: HIDDevice,
    generation: number,
    request: ProtocolRequest
  ): Promise<ProtocolResponse> {
    this.assertCurrentSession(device, generation, request.commandName);

    if (!canTryReportZeroFeatureProbe(device)) {
      throw new Error(
        `The selected Razer HID interface exposes only input reports, so WebHID cannot send feature commands to it. In the Windows picker, select a Razer interface with vendor-defined or feature reports. Current descriptors: ${describeReports(
          device
        )}`
      );
    }

    if (!device.opened) {
      await device.open();
      this.assertCurrentSession(device, generation, request.commandName);
    }

    const logBase: HidLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      commandName: request.commandName,
      reportId: request.reportId,
      requestHex: bytesToHex(request.bytes),
      descriptorSummary: describeReports(device)
    };
    const shouldLog = request.log !== false;
    const commandKind = resolveRequestKind(request);

    try {
      const result = await sendFeatureReportAndReceive({
        assertActive: () => this.assertCurrentSession(device, generation, request.commandName),
        bytes: request.bytes,
        device,
        frameMode: this.reportZeroFrameMode,
        kind: commandKind,
        reportId: request.reportId,
        responseDelayMs: COMMAND_RESPONSE_INITIAL_DELAY_MS
      });

      this.assertCurrentSession(device, generation, request.commandName);

      if (request.reportId === RAZER_REPORT_ID && this.reportZeroFrameMode === null && result.frameMode) {
        this.reportZeroFrameMode = result.frameMode;
      }

      if (shouldLog) {
        this.recordLog({
          ...logBase,
          sendAttempts: result.sendAttempts,
          responseHex: bytesToHex(result.response.raw),
          status: result.response.status,
          commandClass: result.response.commandClass,
          commandId: result.response.commandId,
          parsed: {
            value: result.response.value,
            success: result.response.success
          }
        });
      }

      return result.response;
    } catch (error) {
      if (shouldLog && this.isCurrentSession(device, generation)) {
        this.recordLog({
          ...logBase,
          sendAttempts: error instanceof CommandExchangeError ? error.sendAttempts : undefined,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      throw error;
    }
  }

  private assertCurrentSession(device: HIDDevice, generation: number, commandName: string): void {
    if (!this.isCurrentSession(device, generation)) {
      throw new HidSessionChangedError(commandName);
    }
  }

  private isCurrentSession(device: HIDDevice, generation: number): boolean {
    return this.device === device && this.sessionGeneration === generation;
  }

  private invalidateSession(): void {
    this.sessionGeneration += 1;
    this.device = null;
    this.reportZeroFrameMode = null;
  }

  private recordLog(entry: HidLogEntry): void {
    this.logs = [entry, ...this.logs].slice(0, MAX_LOG_ENTRIES);
  }

  private enqueueExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

function hasFeatureReportZero(device: HIDDevice): boolean {
  return device.collections.some((collection) => collection.featureReports?.some((report) => report.reportId === 0));
}

function hasAnyFeatureReport(device: HIDDevice): boolean {
  return device.collections.some((collection) => (collection.featureReports?.length ?? 0) > 0);
}

function canTryReportZeroFeatureProbe(device: HIDDevice): boolean {
  return hasAnyFeatureReport(device) || isKnownReportZeroFeatureDevice(device);
}

function isKnownReportZeroFeatureDevice(device: HIDDevice): boolean {
  return (
    device.vendorId === RAZER_VENDOR_ID &&
    (device.productId === 0x00b3 ||
      device.productId === 0x00c5 ||
      device.productId === 0x00de ||
      device.productId === 0x00df)
  );
}

function chooseBestDevice(devices: HIDDevice[]): HIDDevice | null {
  const sortedDevices = sortDevicesByControlScore(devices);
  return (
    chooseControlDevice(sortedDevices) ??
    sortedDevices.find((candidate) => hasVendorDefinedCollection(candidate)) ??
    sortedDevices[0] ??
    null
  );
}

function chooseControlDevice(devices: HIDDevice[]): HIDDevice | null {
  return (
    devices.find((candidate) => hasFeatureReportZero(candidate) && hasVendorDefinedCollection(candidate)) ??
    devices.find((candidate) => hasFeatureReportZero(candidate)) ??
    devices.find((candidate) => hasAnyFeatureReport(candidate) && hasVendorDefinedCollection(candidate)) ??
    devices.find((candidate) => hasAnyFeatureReport(candidate)) ??
    null
  );
}

async function chooseBestDeviceWithProbe(devices: HIDDevice[]): Promise<DeviceSelection | null> {
  if (devices.length <= 1) {
    const device = chooseBestDevice(devices);
    return device ? { device, frameMode: null } : null;
  }

  const sortedDevices = sortDevicesByControlScore(devices);
  for (const candidate of sortedDevices) {
    const frameMode = await probeControlCandidate(candidate);
    if (frameMode) {
      return { device: candidate, frameMode };
    }
  }

  const device = chooseBestDevice(sortedDevices);
  return device ? { device, frameMode: null } : null;
}

function sortDevicesByControlScore(devices: HIDDevice[]): HIDDevice[] {
  return [...devices].sort((left, right) => getControlScore(right) - getControlScore(left));
}

function getControlScore(device: HIDDevice): number {
  let score = 0;

  if (hasFeatureReportZero(device)) {
    score += 80;
  }

  if (hasAnyFeatureReport(device)) {
    score += 40;
  }

  if (hasVendorDefinedCollection(device)) {
    score += 30;
  }

  if (hasFeatureReportZero(device) && hasVendorDefinedCollection(device)) {
    score += 40;
  }

  if (isKnownReportZeroFeatureDevice(device)) {
    score += 20;
  }

  return score;
}

async function probeControlCandidate(device: HIDDevice): Promise<ReportZeroFrameMode | null> {
  if (!canTryReportZeroFeatureProbe(device)) {
    return null;
  }

  const openedByProbe = !device.opened;

  try {
    if (!device.opened) {
      await device.open();
    }

    const result = await sendFeatureReportAndReceive({
      bytes: CONTROL_PROBE_REPORT,
      device,
      frameMode: null,
      kind: "read",
      reportId: RAZER_REPORT_ID,
      responseDelayMs: CONTROL_PROBE_RESPONSE_INITIAL_DELAY_MS
    });

    if (
      result.response.success &&
      result.response.commandClass === RAZER_COMMAND_CLASS_DEVICE &&
      result.response.commandId === BATTERY_COMMAND_ID
    ) {
      return result.frameMode;
    }
  } catch {
    // A failed safe read only removes this interface from the preferred-control candidates.
  }

  if (openedByProbe && device.opened) {
    await device.close();
  }

  return null;
}

function hasVendorDefinedCollection(device: HIDDevice): boolean {
  return device.collections.some((collection) => {
    const usagePage = collection.usagePage;
    return typeof usagePage === "number" && usagePage >= 0xff00 && usagePage <= 0xffff;
  });
}

async function sendFeatureReportAndReceive({
  assertActive,
  bytes,
  device,
  frameMode,
  kind,
  reportId,
  responseDelayMs
}: {
  assertActive?: () => void;
  bytes: Uint8Array;
  device: HIDDevice;
  frameMode: ReportZeroFrameMode | null;
  kind: ProtocolRequestKind;
  reportId: number;
  responseDelayMs: number;
}): Promise<CommandExchangeResult> {
  const candidates = buildSendCandidates(reportId, bytes, frameMode, kind);
  const attempts: string[] = [];

  for (const [index, candidate] of candidates.entries()) {
    try {
      assertActive?.();
      await device.sendFeatureReport(reportId, bytesToArrayBuffer(candidate.bytes));
      assertActive?.();
      const response = await receiveRazerResponseAfterBusyPoll(
        device,
        reportId,
        responseDelayMs,
        bytes,
        assertActive
      );
      assertActive?.();

      if (matchesRequestCommand(bytes, response)) {
        return {
          frameMode: candidate.frameMode,
          response,
          sendAttempts: [...attempts, `${formatSendAttempt(candidate)} ok`]
        };
      }

      attempts.push(`${formatSendAttempt(candidate)} ok, mismatched response ${formatCommandPair(response)}`);
    } catch (error) {
      if (error instanceof HidSessionChangedError) {
        throw error;
      }

      attempts.push(`${formatSendAttempt(candidate)} failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (kind === "write" || index === candidates.length - 1) {
      break;
    }
  }

  throw new CommandExchangeError(attempts.join(" | "), attempts);
}

async function receiveRazerResponseAfterBusyPoll(
  device: HIDDevice,
  reportId: number,
  initialDelayMs: number,
  requestBytes: Uint8Array,
  assertActive?: () => void
): Promise<ProtocolResponse> {
  await sleep(initialDelayMs);
  assertActive?.();

  let response = await receiveRazerResponse(device, reportId, requestBytes);

  for (let retry = 0; response.status === RAZER_STATUS_BUSY && retry < BUSY_RESPONSE_MAX_RETRIES; retry += 1) {
    await sleep(BUSY_RESPONSE_RETRY_DELAY_MS);
    assertActive?.();
    response = await receiveRazerResponse(device, reportId, requestBytes);
  }

  return response;
}

async function receiveRazerResponse(
  device: HIDDevice,
  reportId: number,
  requestBytes: Uint8Array
): Promise<ProtocolResponse> {
  const dataView = await device.receiveFeatureReport(reportId);
  return parseRazerResponse(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength), {
    expectedCommandClass: requestBytes[6],
    expectedCommandId: requestBytes[7]
  });
}

function buildSendCandidates(
  reportId: number,
  bytes: Uint8Array,
  frameMode: ReportZeroFrameMode | null,
  kind: ProtocolRequestKind
): SendCandidate[] {
  if (reportId !== RAZER_REPORT_ID || bytes.length === 0 || bytes[0] !== RAZER_REPORT_ID) {
    return [{ label: "original", bytes, frameMode: null }];
  }

  if (frameMode === "without-leading-report-byte") {
    return [{ label: "without leading report byte", bytes: bytes.slice(1), frameMode }];
  }

  if (frameMode === "with-leading-report-byte") {
    return [{ label: "with leading report byte", bytes, frameMode }];
  }

  if (kind === "write") {
    throw new Error(
      "Report-zero framing has not been established for this HID session. Run a safe read probe before writing settings."
    );
  }

  return [
    {
      label: "without leading report byte",
      bytes: bytes.slice(1),
      frameMode: "without-leading-report-byte"
    },
    {
      label: "with leading report byte",
      bytes,
      frameMode: "with-leading-report-byte"
    }
  ];
}

function resolveRequestKind(request: ProtocolRequest): ProtocolRequestKind {
  return request.kind ?? (WRITE_COMMAND_NAME_PATTERN.test(request.commandName) ? "write" : "read");
}

function formatSendAttempt(candidate: SendCandidate): string {
  return `${candidate.label}: ${candidate.bytes.byteLength} bytes`;
}

function matchesRequestCommand(requestBytes: Uint8Array, response: ProtocolResponse): boolean {
  return response.commandClass === requestBytes[6] && response.commandId === requestBytes[7];
}

function formatCommandPair(response: ProtocolResponse): string {
  return `0x${response.commandClass.toString(16)}/0x${response.commandId.toString(16)}`;
}

function describeReports(device: HIDDevice): string {
  const reports = device.collections.flatMap((collection, collectionIndex) => {
    const prefix = `c${collectionIndex} usagePage ${formatOptionalHex(collection.usagePage)} usage ${formatOptionalHex(
      collection.usage
    )}`;
    const reportGroups = [
      ...describeReportGroup("input", collection.inputReports),
      ...describeReportGroup("output", collection.outputReports),
      ...describeReportGroup("feature", collection.featureReports)
    ];

    if (reportGroups.length === 0) {
      return [`${prefix}: no reports exposed`];
    }

    return reportGroups.map((report) => `${prefix} ${report}`);
  });

  return reports.length > 0 ? reports.join(" | ") : "No reports exposed";
}

function describeReportGroup(label: string, reports: readonly HIDReportInfo[] | undefined): string[] {
  return (reports ?? []).map((report) => {
    const itemLengths = report.items?.map((item) => `${item.reportSize}b x ${item.reportCount}`).join(", ");
    const legacyLength =
      typeof report.reportSize === "number" && typeof report.reportCount === "number"
        ? `${report.reportSize}b x ${report.reportCount}`
        : null;

    return `${label} report ${report.reportId}: ${itemLengths ?? legacyLength ?? "size unknown"}`;
  });
}

function formatOptionalHex(value: number | undefined): string {
  return typeof value === "number" ? `0x${value.toString(16)}` : "unknown";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function copyLogEntry(entry: HidLogEntry): HidLogEntry {
  return {
    ...entry,
    parsed: isPlainObject(entry.parsed) ? { ...entry.parsed } : entry.parsed
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

async function closeIfNotCurrent(device: HIDDevice, currentDevice: HIDDevice | null): Promise<void> {
  if (device !== currentDevice && device.opened) {
    try {
      await device.close();
    } catch (error) {
      console.warn("Snap Razer could not close a stale HID device.", error);
    }
  }
}
