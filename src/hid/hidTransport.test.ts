import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RAZER_COMMAND_CLASS_DEVICE,
  RAZER_REPORT_ID,
  buildRazerReport
} from "../domain/razerProtocol";
import type { HidLogEntry, ProtocolRequest } from "../domain/types";
import { HidTransport } from "./hidTransport";

function makeDevice(receiveFeatureReport: () => Promise<DataView>, override: Partial<HIDDevice> = {}): HIDDevice {
  return {
    opened: false,
    productId: 0x00a1,
    productName: "Razer Test Device",
    vendorId: 0x1532,
    collections: [{ usagePage: 0xff00, usage: 0x01, featureReports: [{ reportId: 0 }] }],
    open: vi.fn(async function open(this: HIDDevice) {
      Object.defineProperty(this, "opened", { value: true, configurable: true });
    }),
    close: vi.fn(async function close(this: HIDDevice) {
      Object.defineProperty(this, "opened", { value: false, configurable: true });
    }),
    sendReport: vi.fn(),
    sendFeatureReport: vi.fn(),
    receiveFeatureReport: vi.fn(receiveFeatureReport),
    ...override
  };
}

function makeRequest(): ProtocolRequest {
  return {
    reportId: RAZER_REPORT_ID,
    commandName: "Read battery",
    bytes: buildRazerReport({
      commandClass: RAZER_COMMAND_CLASS_DEVICE,
      commandId: 0x80,
      dataSize: 0x02
    })
  };
}

function makeOffsetResponse(): DataView {
  return makeOffsetRazerResponse({
    commandClass: 0x07,
    commandId: 0x80,
    status: 0x02,
    value: 0x80
  });
}

function makeOffsetRazerResponse({
  commandClass,
  commandId,
  status,
  value
}: {
  commandClass: number;
  commandId: number;
  status: number;
  value: number;
}): DataView {
  const buffer = new ArrayBuffer(128);
  const response = new Uint8Array(buffer, 16, 90);

  response[0] = status;
  response[1] = 0x1f;
  response[6] = commandClass;
  response[7] = commandId;
  response[9] = value;

  return new DataView(buffer, 16, 90);
}

async function connectTransport(device: HIDDevice): Promise<HidTransport> {
  vi.stubGlobal("navigator", {
    hid: {
      getDevices: vi.fn(async () => []),
      requestDevice: vi.fn(async () => [device])
    }
  });

  const transport = new HidTransport();
  await transport.requestAndOpen();
  return transport;
}

async function connectTransportToDevices(devices: HIDDevice[]): Promise<HidTransport> {
  vi.stubGlobal("navigator", {
    hid: {
      getDevices: vi.fn(async () => []),
      requestDevice: vi.fn(async () => devices)
    }
  });

  const transport = new HidTransport();
  await transport.requestAndOpen();
  return transport;
}

async function runCommand(transport: HidTransport): Promise<Awaited<ReturnType<HidTransport["command"]>>> {
  const result = transport.command(makeRequest());
  await vi.advanceTimersByTimeAsync(100);
  return result;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HidTransport", () => {
  it("requests control interfaces and known report-zero Viper interfaces", async () => {
    const requestDevice = vi.fn(async () => []);
    vi.stubGlobal("navigator", {
      hid: {
        getDevices: vi.fn(async () => []),
        requestDevice
      }
    });

    const transport = new HidTransport();

    await expect(transport.requestAndOpen()).rejects.toThrow("No Razer HID device was selected");
    expect(requestDevice).toHaveBeenCalledOnce();
    expect(requestDevice).toHaveBeenCalledWith({
      filters: [
        { vendorId: 0x1532, usagePage: 0xff00, usage: 0x01 },
        { vendorId: 0x1532, usagePage: 0xff01, usage: 0x01 },
        { vendorId: 0x1532, usagePage: 0xff02, usage: 0x01 },
        { vendorId: 0x1532, usagePage: 0xff03, usage: 0x01 },
        { vendorId: 0x1532, productId: 0x00de, usagePage: 0x01, usage: 0x02 },
        { vendorId: 0x1532, productId: 0x00df, usagePage: 0x01, usage: 0x02 }
      ]
    });
  });

  it("parses and logs a feature report from a DataView window", async () => {
    vi.useFakeTimers();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const device = makeDevice(async () => makeOffsetResponse());
    const transport = await connectTransport(device);

    const response = await runCommand(transport);

    expect(response.status).toBe(0x02);
    expect(response.commandClass).toBe(0x07);
    expect(response.commandId).toBe(0x80);
    expect(response.value).toBe(0x80);
    expect(response.raw).toHaveLength(90);
    expect(transport.snapshot().logs[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      commandName: "Read battery",
      descriptorSummary: "c0 usagePage 0xff00 usage 0x1 feature report 0: size unknown",
      sendAttempts: ["without leading report byte: 89 bytes ok"],
      status: 0x02,
      commandClass: 0x07,
      commandId: 0x80,
      parsed: {
        value: 0x80,
        success: true
      }
    });
    expect(device.sendFeatureReport).toHaveBeenCalledWith(RAZER_REPORT_ID, expect.any(ArrayBuffer));
    expect(new Uint8Array(vi.mocked(device.sendFeatureReport).mock.calls[0][1] as ArrayBuffer)).toHaveLength(89);
  });

  it("falls back to including the leading report byte for report zero writes", async () => {
    vi.useFakeTimers();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const device = makeDevice(async () => makeOffsetResponse());
    const sendFeatureReport = vi
      .mocked(device.sendFeatureReport)
      .mockRejectedValueOnce(new Error("Failed to write the feature report."))
      .mockResolvedValueOnce(undefined);
    const transport = await connectTransport(device);

    await runCommand(transport);

    expect(sendFeatureReport).toHaveBeenCalledTimes(2);
    expect(new Uint8Array(sendFeatureReport.mock.calls[0][1] as ArrayBuffer)).toHaveLength(89);
    expect(new Uint8Array(sendFeatureReport.mock.calls[1][1] as ArrayBuffer)).toHaveLength(90);
    expect(transport.snapshot().logs[0].sendAttempts).toEqual([
      "without leading report byte: 89 bytes failed: Failed to write the feature report.",
      "with leading report byte: 90 bytes ok"
    ]);
  });

  it("selects a Razer interface that exposes feature reports", async () => {
    const inputOnlyDevice = makeDevice(async () => makeOffsetResponse(), {
      productName: "Razer Mouse Input",
      collections: [{ usagePage: 0x01, usage: 0x02 }]
    });
    const featureDevice = makeDevice(async () => makeOffsetResponse(), {
      productName: "Razer Control Interface"
    });

    const transport = await connectTransportToDevices([inputOnlyDevice, featureDevice]);

    expect(transport.snapshot().device?.productName).toBe("Razer Control Interface");
    expect(inputOnlyDevice.open).not.toHaveBeenCalled();
    expect(featureDevice.open).toHaveBeenCalledOnce();
  });

  it("actively probes candidate control interfaces and skips mismatched responses", async () => {
    const wrongFeatureDevice = makeDevice(
      async () =>
        makeOffsetRazerResponse({
          commandClass: 0x04,
          commandId: 0x85,
          status: 0x02,
          value: 0x80
        }),
      {
        productName: "Razer Wrong Feature Interface",
        collections: [{ usagePage: 0xff00, usage: 0x01, featureReports: [{ reportId: 0 }] }]
      }
    );
    const controlDevice = makeDevice(async () => makeOffsetResponse(), {
      productName: "Razer Battery Probe Interface",
      collections: [{ usagePage: 0xff01, usage: 0x01, featureReports: [{ reportId: 0 }] }]
    });

    const transport = await connectTransportToDevices([wrongFeatureDevice, controlDevice]);

    expect(transport.snapshot().device?.productName).toBe("Razer Battery Probe Interface");
    expect(wrongFeatureDevice.open).toHaveBeenCalledOnce();
    expect(wrongFeatureDevice.close).toHaveBeenCalledOnce();
    expect(controlDevice.open).toHaveBeenCalledOnce();
    expect(wrongFeatureDevice.receiveFeatureReport).toHaveBeenCalledWith(RAZER_REPORT_ID);
    expect(controlDevice.receiveFeatureReport).toHaveBeenCalledWith(RAZER_REPORT_ID);
  });

  it("checks same-product authorized interfaces after the chooser returns an input path", async () => {
    const inputOnlyDevice = makeDevice(async () => makeOffsetResponse(), {
      productId: 0x00de,
      productName: "Razer Mouse Input",
      collections: [{ usagePage: 0x01, usage: 0x02 }]
    });
    const featureDevice = makeDevice(async () => makeOffsetResponse(), {
      productId: 0x00de,
      productName: "Razer Control Interface"
    });
    const otherRazerDevice = makeDevice(async () => makeOffsetResponse(), {
      productId: 0x00df,
      productName: "Other Razer Interface"
    });
    const getDevices = vi.fn(async () =>
      getDevices.mock.calls.length === 1 ? [] : [inputOnlyDevice, featureDevice, otherRazerDevice]
    );

    vi.stubGlobal("navigator", {
      hid: {
        getDevices,
        requestDevice: vi.fn(async () => [inputOnlyDevice])
      }
    });

    const transport = new HidTransport();
    await transport.requestAndOpen();

    expect(transport.snapshot().device?.productName).toBe("Razer Control Interface");
    expect(featureDevice.open).toHaveBeenCalledOnce();
    expect(otherRazerDevice.open).not.toHaveBeenCalled();
  });

  it("prefers an already-authorized control interface", async () => {
    const inputOnlyDevice = makeDevice(async () => makeOffsetResponse(), {
      productName: "Razer Mouse Input",
      collections: [{ usagePage: 0x01, usage: 0x02 }]
    });
    const featureDevice = makeDevice(async () => makeOffsetResponse(), {
      productName: "Razer Control Interface"
    });
    const requestDevice = vi.fn(async () => [inputOnlyDevice]);

    vi.stubGlobal("navigator", {
      hid: {
        getDevices: vi.fn(async () => [inputOnlyDevice, featureDevice]),
        requestDevice
      }
    });

    const transport = new HidTransport();
    await transport.requestAndOpen();

    expect(transport.snapshot().device?.productName).toBe("Razer Control Interface");
    expect(requestDevice).not.toHaveBeenCalled();
    expect(inputOnlyDevice.open).not.toHaveBeenCalled();
    expect(featureDevice.open).toHaveBeenCalledOnce();
  });

  it("does not reuse an already-authorized input-only interface when requesting a control path", async () => {
    const alreadyAllowedInputOnlyDevice = makeDevice(async () => makeOffsetResponse(), {
      productName: "Already Allowed Razer Mouse Input",
      collections: [{ usagePage: 0x01, usage: 0x02 }]
    });
    const selectedFeatureDevice = makeDevice(async () => makeOffsetResponse(), {
      productName: "Selected Razer Control Interface"
    });
    const requestDevice = vi.fn(async () => [selectedFeatureDevice]);

    vi.stubGlobal("navigator", {
      hid: {
        getDevices: vi.fn(async () => [alreadyAllowedInputOnlyDevice]),
        requestDevice
      }
    });

    const transport = new HidTransport();
    await transport.requestAndOpen();

    expect(transport.snapshot().device?.productName).toBe("Selected Razer Control Interface");
    expect(requestDevice).toHaveBeenCalledOnce();
    expect(alreadyAllowedInputOnlyDevice.open).not.toHaveBeenCalled();
  });

  it("opens already-authorized devices without requesting a new selection", async () => {
    const device = makeDevice(async () => makeOffsetResponse());
    const requestDevice = vi.fn(async () => []);

    vi.stubGlobal("navigator", {
      hid: {
        getDevices: vi.fn(async () => [device]),
        requestDevice
      }
    });

    const transport = new HidTransport();

    await expect(transport.openAuthorized()).resolves.toMatchObject({
      productName: "Razer Test Device"
    });
    expect(requestDevice).not.toHaveBeenCalled();
    expect(device.open).toHaveBeenCalledOnce();
  });

  it("returns null when no authorized Razer devices are available", async () => {
    const requestDevice = vi.fn(async () => []);

    vi.stubGlobal("navigator", {
      hid: {
        getDevices: vi.fn(async () => []),
        requestDevice
      }
    });

    const transport = new HidTransport();

    await expect(transport.openAuthorized()).resolves.toBeNull();
    expect(requestDevice).not.toHaveBeenCalled();
  });

  it("connects input-only selections for diagnostics and rejects commands", async () => {
    vi.useFakeTimers();
    const inputOnlyDevice = makeDevice(async () => makeOffsetResponse(), {
      productName: "Razer Mouse Input",
      collections: [{ usagePage: 0x01, usage: 0x02 }]
    });

    vi.stubGlobal("navigator", {
      hid: {
        getDevices: vi.fn(async () => []),
        requestDevice: vi.fn(async () => [inputOnlyDevice])
      }
    });

    const transport = new HidTransport();

    await expect(transport.requestAndOpen()).resolves.toMatchObject({
      productName: "Razer Mouse Input",
      writableReports: false,
      descriptorSummary: "c0 usagePage 0x1 usage 0x2: no reports exposed"
    });
    expect(inputOnlyDevice.open).toHaveBeenCalledOnce();

    await expect(transport.command(makeRequest())).rejects.toThrow("exposes only input reports");
    expect(inputOnlyDevice.sendFeatureReport).not.toHaveBeenCalled();
  });

  it("allows report-zero feature probes for known Viper V3 Pro SE interfaces", async () => {
    vi.useFakeTimers();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const device = makeDevice(async () => makeOffsetResponse(), {
      productId: 0x00df,
      productName: "Razer Viper V3 Pro SE",
      collections: [{ usagePage: 0x01, usage: 0x02 }]
    });
    const transport = await connectTransport(device);

    expect(transport.snapshot().device).toMatchObject({
      writableReports: false,
      featureReportProbeAllowed: true
    });

    await runCommand(transport);

    expect(device.sendFeatureReport).toHaveBeenCalledWith(RAZER_REPORT_ID, expect.any(ArrayBuffer));
    expect(device.receiveFeatureReport).toHaveBeenCalledWith(RAZER_REPORT_ID);
  });

  it("returns log entry copies from snapshot", async () => {
    vi.useFakeTimers();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const device = makeDevice(async () => makeOffsetResponse());
    const transport = await connectTransport(device);

    await runCommand(transport);

    const firstSnapshot = transport.snapshot();
    firstSnapshot.logs[0].commandName = "Mutated";
    (firstSnapshot.logs[0].parsed as { value: number }).value = 0xff;

    const laterLog = transport.snapshot().logs[0] as HidLogEntry & {
      parsed: { value: number; success: boolean };
    };
    expect(laterLog.commandName).toBe("Read battery");
    expect(laterLog.parsed.value).toBe(0x80);
  });

  it("clears the selected device and logs", async () => {
    vi.useFakeTimers();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const device = makeDevice(async () => makeOffsetResponse());
    const transport = await connectTransport(device);

    await runCommand(transport);
    transport.clear();

    expect(transport.snapshot()).toEqual({
      device: null,
      logs: []
    });
  });

  it("closes the selected device when disconnecting", async () => {
    const device = makeDevice(async () => makeOffsetResponse());
    const transport = await connectTransport(device);

    await transport.disconnect();

    expect(device.close).toHaveBeenCalledOnce();
    expect(transport.snapshot()).toEqual({
      device: null,
      logs: []
    });
  });
});
