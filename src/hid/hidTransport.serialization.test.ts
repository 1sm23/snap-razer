import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRazerReport } from "../domain/razerProtocol";
import type { ProtocolRequest } from "../domain/types";
import { HidSessionChangedError, HidTransport } from "./hidTransport";

function makeResponse(commandClass: number, commandId: number, value = 0): DataView {
  const raw = new Uint8Array(90);
  raw[0] = 0x02;
  raw[1] = 0x1f;
  raw[6] = commandClass;
  raw[7] = commandId;
  raw[9] = value;
  return new DataView(raw.buffer);
}

function makeRequest(
  commandName: string,
  commandClass: number,
  commandId: number,
  kind?: ProtocolRequest["kind"]
): ProtocolRequest {
  return {
    bytes: buildRazerReport({ commandClass, commandId, dataSize: 0x02 }),
    commandName,
    kind,
    reportId: 0
  };
}

function makeDevice(
  productName: string,
  receiveFeatureReport: () => Promise<DataView>
): HIDDevice {
  return {
    close: vi.fn(async function close(this: HIDDevice) {
      Object.defineProperty(this, "opened", { configurable: true, value: false });
    }),
    collections: [{ usagePage: 0xff00, usage: 0x01, featureReports: [{ reportId: 0 }] }],
    open: vi.fn(async function open(this: HIDDevice) {
      Object.defineProperty(this, "opened", { configurable: true, value: true });
    }),
    opened: false,
    productId: 0x00de,
    productName,
    receiveFeatureReport: vi.fn(receiveFeatureReport),
    sendFeatureReport: vi.fn(async () => undefined),
    sendReport: vi.fn(async () => undefined),
    vendorId: 0x1532
  };
}

function installHidMock(requestDevice: () => Promise<HIDDevice[]>): void {
  vi.stubGlobal("navigator", {
    hid: {
      getDevices: vi.fn(async () => []),
      requestDevice: vi.fn(requestDevice)
    }
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HidTransport command serialization", () => {
  it("keeps concurrent commands in strict send/receive order", async () => {
    vi.useFakeTimers();
    const device = makeDevice(
      "Serialized Razer Mouse",
      vi
        .fn()
        .mockResolvedValueOnce(makeResponse(0x07, 0x80, 0x80))
        .mockResolvedValueOnce(makeResponse(0x07, 0x84, 0x01))
    );
    installHidMock(async () => [device]);

    const transport = new HidTransport();
    await transport.requestAndOpen();

    const batteryPromise = transport.command(makeRequest("Read battery", 0x07, 0x80));
    const chargingPromise = transport.command(makeRequest("Read charging", 0x07, 0x84));

    await flushMicrotasks();
    expect(device.sendFeatureReport).toHaveBeenCalledTimes(1);
    expect(device.receiveFeatureReport).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    await expect(batteryPromise).resolves.toMatchObject({ commandId: 0x80, value: 0x80 });

    await flushMicrotasks();
    expect(device.sendFeatureReport).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(100);
    await expect(chargingPromise).resolves.toMatchObject({ commandId: 0x84, value: 0x01 });
  });

  it("requires a safe read to establish report-zero framing before a write", async () => {
    vi.useFakeTimers();
    const device = makeDevice("Unknown-frame Razer Mouse", async () => makeResponse(0x04, 0x05));
    installHidMock(async () => [device]);

    const transport = new HidTransport();
    await transport.requestAndOpen();

    await expect(transport.command(makeRequest("Set DPI", 0x04, 0x05))).rejects.toThrow(
      "Report-zero framing has not been established"
    );
    expect(device.sendFeatureReport).not.toHaveBeenCalled();
  });

  it("uses the negotiated frame mode once and never retries a write with another frame shape", async () => {
    vi.useFakeTimers();
    const receiveFeatureReport = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(0x07, 0x80, 0x80))
      .mockResolvedValueOnce(makeResponse(0x04, 0x05));
    const device = makeDevice("Negotiated Razer Mouse", receiveFeatureReport);
    installHidMock(async () => [device]);

    const transport = new HidTransport();
    await transport.requestAndOpen();

    const readPromise = transport.command(makeRequest("Read battery", 0x07, 0x80));
    await vi.advanceTimersByTimeAsync(100);
    await readPromise;

    const writePromise = transport.command(makeRequest("Set DPI", 0x04, 0x05));
    await vi.advanceTimersByTimeAsync(100);
    await writePromise;

    expect(device.sendFeatureReport).toHaveBeenCalledTimes(2);
    const firstBytes = new Uint8Array(vi.mocked(device.sendFeatureReport).mock.calls[0][1] as ArrayBuffer);
    const secondBytes = new Uint8Array(vi.mocked(device.sendFeatureReport).mock.calls[1][1] as ArrayBuffer);
    expect(firstBytes).toHaveLength(89);
    expect(secondBytes).toHaveLength(89);
  });

  it("invalidates queued commands before reconnecting another device", async () => {
    vi.useFakeTimers();
    const firstDevice = makeDevice("First Razer Mouse", async () => makeResponse(0x07, 0x80, 0x80));
    const secondDevice = makeDevice("Second Razer Mouse", async () => makeResponse(0x07, 0x80, 0x90));
    const requestDevice = vi
      .fn(async () => [] as HIDDevice[])
      .mockResolvedValueOnce([firstDevice])
      .mockResolvedValueOnce([secondDevice]);
    installHidMock(requestDevice);

    const transport = new HidTransport();
    await transport.requestAndOpen();

    const inFlight = transport.command(makeRequest("Read battery", 0x07, 0x80));
    await flushMicrotasks();
    expect(firstDevice.sendFeatureReport).toHaveBeenCalledTimes(1);

    const queued = transport.command(makeRequest("Read charging", 0x07, 0x84));
    const disconnectPromise = transport.disconnect();
    const reconnectPromise = transport.requestAndOpen();

    const inFlightExpectation = expect(inFlight).rejects.toBeInstanceOf(HidSessionChangedError);
    const queuedExpectation = expect(queued).rejects.toBeInstanceOf(HidSessionChangedError);

    await vi.advanceTimersByTimeAsync(100);

    await inFlightExpectation;
    await queuedExpectation;
    await disconnectPromise;
    await expect(reconnectPromise).resolves.toMatchObject({ productName: "Second Razer Mouse" });

    expect(firstDevice.sendFeatureReport).toHaveBeenCalledTimes(1);
    expect(secondDevice.sendFeatureReport).not.toHaveBeenCalled();
  });
});
