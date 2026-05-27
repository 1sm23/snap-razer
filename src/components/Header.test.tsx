import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConnectedDevice } from "../domain/types";
import { Header } from "./Header";

const defaultProps = {
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
  });

  it("hides connection help once a device is connected", () => {
    const html = renderToStaticMarkup(<Header {...defaultProps} device={connectedDevice} />);

    expect(html).toContain("Connection actions");
    expect(html).not.toContain("Connection help");
  });
});
