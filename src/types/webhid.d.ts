interface HIDDevice {
  readonly opened: boolean;
  readonly productId: number;
  readonly productName: string;
  readonly vendorId: number;
  readonly collections: HIDCollectionInfo[];
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
}

interface HIDCollectionInfo {
  readonly usage?: number;
  readonly usagePage?: number;
  readonly inputReports?: HIDReportInfo[];
  readonly outputReports?: HIDReportInfo[];
  readonly featureReports?: HIDReportInfo[];
}

interface HIDReportInfo {
  readonly reportId: number;
  readonly items?: HIDReportItem[];
  readonly reportSize?: number;
  readonly reportCount?: number;
}

interface HIDReportItem {
  readonly reportSize: number;
  readonly reportCount: number;
}

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
  usage?: number;
  usagePage?: number;
}

interface HIDDeviceRequestOptions {
  filters: HIDDeviceFilter[];
}

interface HID extends EventTarget {
  getDevices(): Promise<HIDDevice[]>;
  requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]>;
}

interface Navigator {
  readonly hid?: HID;
}
