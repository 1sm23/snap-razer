import type { ConnectedDevice, HidLogEntry, ProtocolRequest, ProtocolResponse } from "../domain/types";
import { bytesToHex, parseRazerResponse, RAZER_VENDOR_ID } from "../domain/razerProtocol";

export type TransportCommand = (request: ProtocolRequest) => Promise<ProtocolResponse>;

export interface HidTransportSnapshot {
  device: ConnectedDevice | null;
  logs: HidLogEntry[];
}

const RAZER_CONTROL_REQUEST_FILTERS: HIDDeviceFilter[] = [
  { vendorId: RAZER_VENDOR_ID, usagePage: 0xff00, usage: 0x01 },
  { vendorId: RAZER_VENDOR_ID, usagePage: 0xff01, usage: 0x01 },
  { vendorId: RAZER_VENDOR_ID, usagePage: 0xff02, usage: 0x01 },
  { vendorId: RAZER_VENDOR_ID, usagePage: 0xff03, usage: 0x01 }
];

// Viper V3 Pro/SE exposes the report-zero feature path through generic mouse
// usages in Chrome. WebHID filters cannot target Windows MI/COL interfaces, so
// affected devices may show more than one same-named entry in the chooser.
const KNOWN_REPORT_ZERO_FEATURE_FILTERS: HIDDeviceFilter[] = [
  { vendorId: RAZER_VENDOR_ID, productId: 0x00de, usagePage: 0x01, usage: 0x02 },
  { vendorId: RAZER_VENDOR_ID, productId: 0x00df, usagePage: 0x01, usage: 0x02 }
];

const RAZER_REQUEST_FILTERS: HIDDeviceFilter[] = [
  ...RAZER_CONTROL_REQUEST_FILTERS,
  ...KNOWN_REPORT_ZERO_FEATURE_FILTERS
];

export class HidTransport {
  private device: HIDDevice | null = null;
  private logs: HidLogEntry[] = [];

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
            writableReports: hasAnyWritableReport(this.device),
            featureReportProbeAllowed: canTryReportZeroFeatureProbe(this.device),
            descriptorSummary: describeReports(this.device)
          }
        : null,
      logs: this.logs.map(copyLogEntry)
    };
  }

  clear(): void {
    this.device = null;
    this.logs = [];
  }

  async disconnect(): Promise<void> {
    const currentDevice = this.device;
    this.clear();

    if (currentDevice?.opened) {
      await currentDevice.close();
    }
  }

  async openAuthorized(): Promise<ConnectedDevice | null> {
    if (!navigator.hid) {
      throw new Error("WebHID is not available in this browser.");
    }

    const alreadyAllowed = await navigator.hid.getDevices();
    const alreadyAllowedRazerDevices = alreadyAllowed.filter((device) => device.vendorId === RAZER_VENDOR_ID);
    const device = chooseBestDevice(alreadyAllowedRazerDevices);

    if (!device) {
      return null;
    }

    await this.openDevice(device);
    return this.snapshot().device;
  }

  async requestAndOpen(): Promise<ConnectedDevice | null> {
    if (!navigator.hid) {
      throw new Error("WebHID is not available in this browser.");
    }

    const alreadyAllowed = await navigator.hid.getDevices();
    const alreadyAllowedRazerDevices = alreadyAllowed.filter((device) => device.vendorId === RAZER_VENDOR_ID);
    const existingControlDevice = chooseControlDevice(alreadyAllowedRazerDevices);

    const device =
      existingControlDevice ??
      chooseBestDevice(
        await navigator.hid.requestDevice({
          filters: RAZER_REQUEST_FILTERS
        })
      );

    if (!device) {
      throw new Error("No Razer HID device was selected.");
    }

    await this.openDevice(device);
    return this.snapshot().device;
  }

  private async openDevice(device: HIDDevice): Promise<void> {
    if (!device.opened) {
      await device.open();
    }

    this.device = device;
  }

  command: TransportCommand = async (request) => {
    if (!this.device) {
      throw new Error("No HID device is connected.");
    }

    if (!canTryReportZeroFeatureProbe(this.device)) {
      throw new Error(
        `The selected Razer HID interface exposes only input reports, so WebHID cannot send feature commands to it. In the Windows picker, select a Razer interface with vendor-defined, output, or feature reports. Current descriptors: ${describeReports(
          this.device
        )}`
      );
    }

    if (!this.device.opened) {
      await this.device.open();
    }

    const logBase: HidLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      commandName: request.commandName,
      reportId: request.reportId,
      requestHex: bytesToHex(request.bytes),
      descriptorSummary: describeReports(this.device)
    };

    try {
      const sendAttempts = await sendFeatureReportWithFallback(this.device, request.reportId, request.bytes);
      await sleep(100);
      const dataView = await this.device.receiveFeatureReport(request.reportId);
      const response = parseRazerResponse(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength));

      this.logs = [
        {
          ...logBase,
          sendAttempts,
          responseHex: bytesToHex(response.raw),
          status: response.status,
          commandClass: response.commandClass,
          commandId: response.commandId,
          parsed: {
            value: response.value,
            success: response.success
          }
        },
        ...this.logs
      ];

      return response;
    } catch (error) {
      this.logs = [
        {
          ...logBase,
          sendAttempts: buildSendCandidates(request.reportId, request.bytes).map(formatSendAttempt),
          error: error instanceof Error ? error.message : String(error)
        },
        ...this.logs
      ];
      throw error;
    }
  };
}

function hasFeatureReportZero(device: HIDDevice): boolean {
  return device.collections.some((collection) => collection.featureReports?.some((report) => report.reportId === 0));
}

function hasAnyFeatureReport(device: HIDDevice): boolean {
  return device.collections.some((collection) => (collection.featureReports?.length ?? 0) > 0);
}

function hasAnyOutputReport(device: HIDDevice): boolean {
  return device.collections.some((collection) => (collection.outputReports?.length ?? 0) > 0);
}

function hasAnyWritableReport(device: HIDDevice): boolean {
  return hasAnyFeatureReport(device) || hasAnyOutputReport(device);
}

function canTryReportZeroFeatureProbe(device: HIDDevice): boolean {
  return hasAnyWritableReport(device) || isKnownReportZeroFeatureDevice(device);
}

function isKnownReportZeroFeatureDevice(device: HIDDevice): boolean {
  return device.vendorId === RAZER_VENDOR_ID && (device.productId === 0x00de || device.productId === 0x00df);
}

function chooseBestDevice(devices: HIDDevice[]): HIDDevice | null {
  return (
    chooseControlDevice(devices) ??
    devices.find((candidate) => hasVendorDefinedCollection(candidate)) ??
    devices[0] ??
    null
  );
}

function chooseControlDevice(devices: HIDDevice[]): HIDDevice | null {
  return (
    devices.find((candidate) => hasFeatureReportZero(candidate) && hasVendorDefinedCollection(candidate)) ??
    devices.find((candidate) => hasFeatureReportZero(candidate)) ??
    devices.find((candidate) => hasAnyOutputReport(candidate) && hasVendorDefinedCollection(candidate)) ??
    devices.find((candidate) => hasAnyFeatureReport(candidate) && hasVendorDefinedCollection(candidate)) ??
    devices.find((candidate) => hasAnyWritableReport(candidate)) ??
    null
  );
}

function hasVendorDefinedCollection(device: HIDDevice): boolean {
  return device.collections.some((collection) => {
    const usagePage = collection.usagePage;
    return typeof usagePage === "number" && usagePage >= 0xff00 && usagePage <= 0xffff;
  });
}

async function sendFeatureReportWithFallback(device: HIDDevice, reportId: number, bytes: Uint8Array): Promise<string[]> {
  const candidates = buildSendCandidates(reportId, bytes);
  const attempts: string[] = [];

  for (const candidate of candidates) {
    try {
      await device.sendFeatureReport(reportId, bytesToArrayBuffer(candidate.bytes));
      return [...attempts, `${formatSendAttempt(candidate)} ok`];
    } catch (error) {
      attempts.push(`${formatSendAttempt(candidate)} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(attempts.join(" | "));
}

interface SendCandidate {
  label: string;
  bytes: Uint8Array;
}

function buildSendCandidates(reportId: number, bytes: Uint8Array): SendCandidate[] {
  if (reportId !== 0 || bytes.length === 0 || bytes[0] !== 0) {
    return [{ label: "original", bytes }];
  }

  return [
    { label: "without leading report byte", bytes: bytes.slice(1) },
    { label: "with leading report byte", bytes }
  ];
}

function formatSendAttempt(candidate: SendCandidate): string {
  return `${candidate.label}: ${candidate.bytes.byteLength} bytes`;
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
