import { describe, expect, it } from "vitest";
import { createInitialCapabilities, didAllActiveProbesFail, updateCapability } from "./capabilities";

describe("capabilities", () => {
  it("starts with conservative default states", () => {
    const capabilities = createInitialCapabilities();

    expect(capabilities.battery.state).toBe("unsupported");
    expect(capabilities.charging.state).toBe("unsupported");
    expect(capabilities.dpi.state).toBe("notImplemented");
    expect(capabilities.pollingRate.state).toBe("notImplemented");
    expect(capabilities.lighting.state).toBe("notImplemented");
    expect(capabilities.buttons.state).toBe("browserLimited");
  });

  it("updates one capability without mutating the previous map", () => {
    const before = createInitialCapabilities();
    const after = updateCapability(before, "battery", {
      state: "available",
      detail: "Battery is readable."
    });

    expect(before.battery.state).toBe("unsupported");
    expect(after.battery.state).toBe("available");
    expect(after.battery.detail).toBe("Battery is readable.");
    expect(after.charging).toBe(before.charging);
  });

  it("detects when every active probe failed", () => {
    let capabilities = createInitialCapabilities();

    capabilities = updateCapability(capabilities, "battery", { state: "probeFailed", detail: "no response" });
    capabilities = updateCapability(capabilities, "charging", { state: "probeFailed", detail: "no response" });
    capabilities = updateCapability(capabilities, "dpi", { state: "probeFailed", detail: "no response" });
    capabilities = updateCapability(capabilities, "pollingRate", { state: "probeFailed", detail: "no response" });

    expect(didAllActiveProbesFail(capabilities)).toBe(true);
  });

  it("does not treat one failed probe as a receiver-level failure", () => {
    const capabilities = updateCapability(createInitialCapabilities(), "battery", {
      state: "probeFailed",
      detail: "no response"
    });

    expect(didAllActiveProbesFail(capabilities)).toBe(false);
  });
});
