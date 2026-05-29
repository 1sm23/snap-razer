import type { MessageKey, MessageParams } from "../i18n";

export type CapabilityKey = "battery" | "charging" | "dpi" | "pollingRate" | "lighting" | "buttons";

export type CapabilityState = "available" | "unsupported" | "probeFailed" | "notImplemented" | "browserLimited";

export interface LocalizedMessage {
  key: MessageKey;
  params?: MessageParams;
}

export interface CapabilityStatus {
  key: CapabilityKey;
  labelKey: MessageKey;
  state: CapabilityState;
  detail: string | LocalizedMessage;
}

export type CapabilityMap = Record<CapabilityKey, CapabilityStatus>;

export interface ConnectedDevice {
  productName: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  writableReports: boolean;
  featureReportProbeAllowed: boolean;
  descriptorSummary: string;
}

export interface ProtocolRequest {
  reportId: number;
  commandName: string;
  bytes: Uint8Array;
  log?: boolean;
}

export interface ProtocolResponse {
  raw: Uint8Array;
  status: number;
  transactionId: number;
  commandClass: number;
  commandId: number;
  value: number;
  success: boolean;
}

export interface HidLogEntry {
  id: string;
  timestamp: number;
  commandName: string;
  reportId: number;
  requestHex?: string;
  sendAttempts?: string[];
  descriptorSummary?: string;
  responseHex?: string;
  status?: number;
  commandClass?: number;
  commandId?: number;
  parsed?: unknown;
  error?: string;
}
