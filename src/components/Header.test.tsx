import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConnectedDevice } from "../domain/types";
import { Header } from "./Header";

const defaultProps = {
  battery: null,
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
