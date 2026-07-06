import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConnectedDevice } from "../domain/types";
import { Header } from "./Header";

vi.mock("@iconify/react", () => ({
  Icon: ({ className }: { className?: string }) => <span className={className} />
}));

const defaultProps = {
  battery: null,
  charging: null,
  hidSupported: true,
  connecting: false,
  error: null,
  themeMode: "system" as const,
  resolvedThemeMode: "light" as const,
  debugEnabled: false,
  installAvailable: false,
  onConnect: vi.fn(),
  onDisconnect: vi.fn(),
  onDebugEnabledChange: vi.fn(),
  onInstallApp: vi.fn(),
  onThemeModeChange: vi.fn(),
  onToggleTheme: vi.fn()
};

const connectedDevice: ConnectedDevice = {
  productName: "Razer Test Mouse",
  vendorId: 0x1532,
  productId: 0x00de,
  opened: true,
  writableReports: true,
  featureReportProbeAllowed: true,
  descriptorSummary: "feature report 0"
};

describe("Header", () => {
  it("shows connection help while disconnected", () => {
    const html = renderToStaticMarkup(<Header {...defaultProps} device={null} />);

    expect(html).toContain("Connection help");
    expect(html).not.toContain("Connection actions");
    expect(html).not.toContain("connectionButtonGroupConnected");
  });

  it("hides connection help once a device is connected", () => {
    const html = renderToStaticMarkup(<Header {...defaultProps} device={connectedDevice} />);

    expect(html).toContain("Connection actions");
    expect(html).not.toContain("Connection help");
    expect(html).toContain("connectionButtonGroupConnected");
  });

  it("shows battery next to the connected device name", () => {
    const html = renderToStaticMarkup(
      <Header {...defaultProps} battery={{ rawBattery: 204, percent: 80 }} device={connectedDevice} />
    );

    expect(html).toContain("Razer Test Mouse");
    expect(html).toContain("deviceBattery");
    expect(html).toContain("80%");
  });

  it("shows the charging battery icon next to the device name while charging", () => {
    const html = renderToStaticMarkup(
      <Header
        {...defaultProps}
        battery={{ rawBattery: 204, percent: 80 }}
        charging={{ rawCharging: 1, isCharging: true }}
        device={connectedDevice}
      />
    );

    expect(html).toContain("deviceBatteryIconCharging");
    expect(html).toContain("Battery 80% · Charging");
  });

  it("announces connection and error state changes", () => {
    const html = renderToStaticMarkup(
      <Header {...defaultProps} device={connectedDevice} error="Probe failed" />
    );

    expect(html).toContain("role=\"status\"");
    expect(html).toContain("aria-live=\"polite\"");
    expect(html).toContain("Razer Test Mouse connected");
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("Probe failed");
  });
});
