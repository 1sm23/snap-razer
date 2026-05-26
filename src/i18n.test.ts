import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("i18n", () => {
  it("uses English copy by default", () => {
    expect(t("controls.performance")).toBe("Performance");
    expect(t("performance.sensitivity")).toBe("Sensitivity");
    expect(t("performance.pollingRate")).toBe("Polling Rate");
  });

  it("uses Simplified Chinese copy for the main UI", () => {
    expect(t("controls.performance", undefined, "zh-CN")).toBe("性能");
    expect(t("performance.sensitivity", undefined, "zh-CN")).toBe("灵敏度");
    expect(t("performance.pollingRate", undefined, "zh-CN")).toBe("轮询率");
    expect(t("settings.debug", undefined, "zh-CN")).toBe("调试");
  });
});
