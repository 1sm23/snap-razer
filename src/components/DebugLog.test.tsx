import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HidLogEntry } from "../domain/types";
import { DebugLog, formatDebugLogs } from "./DebugLog";

describe("DebugLog", () => {
  const logs: HidLogEntry[] = [
    {
      id: "1",
      timestamp: 1,
      commandName: "Read DPI",
      reportId: 0,
      requestHex: "00",
      responseHex: "02"
    }
  ];

  it("renders the log count and HID traffic inside a debug card", () => {
    const html = renderToStaticMarkup(<DebugLog logs={logs} open onOpenChange={() => undefined} />);

    expect(html).toContain("debugPanel");
    expect(html).toContain("Debug Log (1)");
    expect(html).toContain("Read DPI");
    expect(html).toContain("Copy all logs");
  });

  it("formats all HID traffic for clipboard copying", () => {
    const text = formatDebugLogs(logs, (key) => {
      const labels = {
        "debug.report": "Report",
        "debug.request": "Request",
        "debug.send": "Send",
        "debug.descriptor": "Descriptor",
        "debug.response": "Response",
        "debug.noResponse": "No response"
      };

      return labels[key as keyof typeof labels] ?? key;
    });

    expect(text).toContain("#1 Read DPI - 1970-01-01T00:00:00.001Z");
    expect(text).toContain("Report: 0");
    expect(text).toContain("Request: 00");
    expect(text).toContain("Response: 02");
  });
});
