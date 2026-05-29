import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FeaturePanels } from "./FeaturePanels";

describe("FeaturePanels", () => {
  it("groups controls into native tabs and opens performance by default", () => {
    const html = renderToStaticMarkup(
      <FeaturePanels
        applyingDpi={false}
        applyingPollingRate={false}
        battery={null}
        charging={null}
        dpi={{ x: 800, y: 800 }}
        dpiStages={{ activeStage: 2, stages: [{ id: 1, x: 400, y: 400 }, { id: 2, x: 800, y: 800 }] }}
        dpiStagesDraft={{ activeStage: 2, stages: [{ id: 1, x: 400, y: 400 }, { id: 2, x: 800, y: 800 }] }}
        onApplyDpiStages={vi.fn()}
        onApplyPollingRate={vi.fn()}
        onDpiStagesDraftChange={vi.fn()}
        pollingRate={1000}
        supportedPollingRates={[125, 500, 1000]}
      />
    );

    expect(html).toContain("role=\"tablist\"");
    expect(html).toContain("role=\"tab\"");
    expect(html).toContain("aria-selected=\"true\"");
    expect(html).toContain("Customize");
    expect(html).toContain("Performance");
    expect(html).toContain("Power");
    expect(html).toContain("Sensitivity");
    expect(html).toContain("Polling Rate");
    expect(html).toContain("Mouse Properties");
    expect(html).toContain("Mouse Test");
    expect(html).toContain("Move pending");
    expect(html).toContain("1000");
  });

  it("renders actionable DPI stage and polling rate controls only when probes succeeded", () => {
    const html = renderToStaticMarkup(
      <FeaturePanels
        applyingDpi={false}
        applyingPollingRate={false}
        battery={null}
        charging={null}
        dpi={{ x: 1600, y: 1600 }}
        dpiStages={{ activeStage: 2, stages: [{ id: 1, x: 800, y: 800 }, { id: 2, x: 1600, y: 1600 }] }}
        dpiStagesDraft={{ activeStage: 2, stages: [{ id: 1, x: 800, y: 800 }, { id: 2, x: 1600, y: 1600 }] }}
        onApplyDpiStages={vi.fn()}
        onApplyPollingRate={vi.fn()}
        onDpiStagesDraftChange={vi.fn()}
        pollingRate={1000}
        supportedPollingRates={[125, 500, 1000]}
      />
    );

    expect(html).not.toContain("Apply DPI");
    expect(html).toContain("Current DPI: 1600:1600");
    expect(html).toContain("1000 Hz");
    expect(html).not.toContain("2000 Hz");
    expect(html).not.toContain("4000 Hz");
    expect(html).not.toContain("8000 Hz");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("disables DPI and polling rate controls when probes did not confirm support", () => {
    const html = renderToStaticMarkup(
      <FeaturePanels
        applyingDpi={false}
        applyingPollingRate={false}
        battery={null}
        charging={null}
        dpi={null}
        dpiStages={null}
        dpiStagesDraft={{ activeStage: 1, stages: [{ id: 1, x: 800, y: 800 }] }}
        onApplyDpiStages={vi.fn()}
        onApplyPollingRate={vi.fn()}
        onDpiStagesDraftChange={vi.fn()}
        pollingRate={null}
        supportedPollingRates={[]}
      />
    );

    expect(html).toContain("DPI probe has not succeeded on this device.");
    expect(html).toContain("Polling rate probe has not succeeded on this device.");
    expect(html).toContain("disabled=\"\"");
  });

  it("renders local button mapping controls in the customize tab", () => {
    const html = renderToStaticMarkup(
      <FeaturePanels
        applyingDpi={false}
        applyingPollingRate={false}
        battery={null}
        charging={null}
        dpi={null}
        dpiStages={null}
        dpiStagesDraft={{ activeStage: 1, stages: [{ id: 1, x: 800, y: 800 }] }}
        initialTab="customize"
        onApplyDpiStages={vi.fn()}
        onApplyPollingRate={vi.fn()}
        onDpiStagesDraftChange={vi.fn()}
        pollingRate={null}
        supportedPollingRates={[]}
      />
    );

    expect(html).toContain("Button assignments");
    expect(html).toContain("DPI button");
    expect(html).toContain("role=\"combobox\"");
    expect(html).not.toContain("Browser limited");
  });

  it("renders advanced dynamic sensitivity and rotation controls when probes succeeded", () => {
    const html = renderToStaticMarkup(
      <FeaturePanels
        advancedSettings={{
          dynamicSensitivity: { enabled: true, mode: "natural", profileId: 1 },
          rotation: { angle: -12, enabled: true, profileId: 1 }
        }}
        applyingDpi={false}
        applyingPollingRate={false}
        battery={null}
        charging={null}
        dpi={null}
        dpiStages={null}
        dpiStagesDraft={{ activeStage: 1, stages: [{ id: 1, x: 800, y: 800 }] }}
        initialTab="advanced"
        onApplyDpiStages={vi.fn()}
        onApplyPollingRate={vi.fn()}
        onDpiStagesDraftChange={vi.fn()}
        pollingRate={null}
        supportedPollingRates={[]}
      />
    );

    expect(html).toContain("Dynamic Sensitivity");
    expect(html).toContain("Natural");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("Rotation");
    expect(html).toContain("-12°");
    expect(html).toContain("Rotation angle");
  });

  it("renders dynamic sensitivity custom template choices", () => {
    const html = renderToStaticMarkup(
      <FeaturePanels
        advancedSettings={{
          dynamicSensitivity: { enabled: true, mode: "custom", profileId: 1 },
          rotation: { angle: 0, enabled: false, profileId: 1 }
        }}
        applyingDpi={false}
        applyingPollingRate={false}
        battery={null}
        charging={null}
        dpi={null}
        dpiStages={null}
        dpiStagesDraft={{ activeStage: 1, stages: [{ id: 1, x: 800, y: 800 }] }}
        initialTab="advanced"
        onApplyDpiStages={vi.fn()}
        onApplyPollingRate={vi.fn()}
        onDpiStagesDraftChange={vi.fn()}
        pollingRate={null}
        supportedPollingRates={[]}
      />
    );

    expect(html).toContain("Custom");
    expect(html).toContain("Choose template");
    expect(html).toContain("role=\"combobox\"");
  });

  it("updates button mapping assignments and custom shortcut text", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onButtonMappingChange = vi.fn();
    const onButtonMappingCustomKeysChange = vi.fn();

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          buttonMappings={[
            { action: "custom", actionKind: "keyboard", buttonId: "left", customKeys: "Ctrl+S" },
            { action: "rightClick", actionKind: "mouse", buttonId: "right" }
          ]}
          charging={null}
          dpi={null}
          dpiStages={null}
          dpiStagesDraft={{ activeStage: 1, stages: [{ id: 1, x: 800, y: 800 }] }}
          initialTab="customize"
          onApplyDpiStages={vi.fn()}
          onApplyPollingRate={vi.fn()}
          onButtonMappingChange={onButtonMappingChange}
          onButtonMappingCustomKeysChange={onButtonMappingCustomKeysChange}
          onDpiStagesDraftChange={vi.fn()}
          pollingRate={null}
          supportedPollingRates={[]}
        />
      );
    });

    const assignmentTrigger = container.querySelector<HTMLButtonElement>(".buttonMappingSelectTrigger");
    expect(assignmentTrigger).not.toBeNull();

    await act(async () => {
      assignmentTrigger?.click();
    });

    const pasteOption = [...document.querySelectorAll<HTMLElement>("[role='option']")].find(
      (option) => option.textContent === "Paste"
    );
    expect(pasteOption).not.toBeUndefined();

    await act(async () => {
      pasteOption?.click();
    });

    expect(onButtonMappingChange).toHaveBeenCalledWith("left", "paste");

    const customInput = container.querySelector<HTMLInputElement>(".buttonMappingCustomKeys input");
    expect(customInput).not.toBeNull();

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInputValue?.call(customInput, "Ctrl+Shift+S");
      customInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onButtonMappingCustomKeysChange).toHaveBeenCalledWith("left", "Ctrl+Shift+S");

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it("applies DPI stages immediately when active stage changes and commits number edits on blur", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onApplyDpiStages = vi.fn();
    const onDpiStagesDraftChange = vi.fn();
    const dpiStagesDraft = {
      activeStage: 2,
      stages: [{ id: 1, x: 800, y: 800 }, { id: 2, x: 1600, y: 1600 }]
    };

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 1600, y: 1600 }}
          dpiStages={dpiStagesDraft}
          dpiStagesDraft={dpiStagesDraft}
          onApplyDpiStages={onApplyDpiStages}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const stageButtons = container.querySelectorAll<HTMLButtonElement>(".stageBadge");
    act(() => {
      stageButtons[0].click();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ activeStage: 1 }));
    expect(onApplyDpiStages).toHaveBeenCalledTimes(1);

    const numberInputs = container.querySelectorAll<HTMLInputElement>(".stageNumber");
    act(() => {
      numberInputs[1].focus();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ activeStage: 2 }));
    expect(onApplyDpiStages).toHaveBeenCalledTimes(2);

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInputValue?.call(numberInputs[1], "2400");
      numberInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onApplyDpiStages).toHaveBeenCalledTimes(2);

    act(() => {
      numberInputs[1].blur();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeStage: 2,
        stages: [
          { id: 1, x: 800, y: 800 },
          { id: 2, x: 2400, y: 2400 }
        ]
      })
    );
    expect(onApplyDpiStages).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeStage: 2,
        stages: [
          { id: 1, x: 800, y: 800 },
          { id: 2, x: 2400, y: 2400 }
        ]
      })
    );

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it("activates a DPI stage and commits number edits on Enter", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onApplyDpiStages = vi.fn();
    const onDpiStagesDraftChange = vi.fn();
    const dpiStagesDraft = {
      activeStage: 2,
      stages: [
        { id: 1, x: 800, y: 800 },
        { id: 2, x: 1600, y: 1600 },
        { id: 3, x: 3200, y: 3200 }
      ]
    };

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 1600, y: 1600 }}
          dpiStages={dpiStagesDraft}
          dpiStagesDraft={dpiStagesDraft}
          onApplyDpiStages={onApplyDpiStages}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const numberInputs = container.querySelectorAll<HTMLInputElement>(".stageNumber");
    act(() => {
      numberInputs[2].focus();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ activeStage: 3 }));
    expect(onApplyDpiStages).toHaveBeenLastCalledWith(expect.objectContaining({ activeStage: 3 }));

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInputValue?.call(numberInputs[2], "3600");
      numberInputs[2].dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onApplyDpiStages).toHaveBeenCalledTimes(1);

    act(() => {
      numberInputs[2].dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeStage: 3,
        stages: [
          { id: 1, x: 800, y: 800 },
          { id: 2, x: 1600, y: 1600 },
          { id: 3, x: 3600, y: 3600 }
        ]
      })
    );
    expect(onApplyDpiStages).toHaveBeenLastCalledWith(
      {
        activeStage: 3,
        stages: [
          { id: 1, x: 800, y: 800 },
          { id: 2, x: 1600, y: 1600 },
          { id: 3, x: 3600, y: 3600 }
        ]
      }
    );

    const sliders = container.querySelectorAll<HTMLInputElement>(".stageSlider");
    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInputValue?.call(sliders[0], "1200");
      sliders[0].dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      activeStage: 1,
      stages: [
        { id: 1, x: 1200, y: 1200 },
        { id: 2, x: 1600, y: 1600 },
        { id: 3, x: 3600, y: 3600 }
      ]
    });
    expect(onApplyDpiStages).toHaveBeenLastCalledWith(
      {
        activeStage: 1,
        stages: [
          { id: 1, x: 1200, y: 1200 },
          { id: 2, x: 1600, y: 1600 },
          { id: 3, x: 3600, y: 3600 }
        ]
      },
      "debounced"
    );

    act(() => {
      sliders[0].dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(onApplyDpiStages).toHaveBeenLastCalledWith({
      activeStage: 1,
      stages: [
        { id: 1, x: 1200, y: 1200 },
        { id: 2, x: 1600, y: 1600 },
        { id: 3, x: 3600, y: 3600 }
      ]
    });

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it("activates DPI stages on number focus and left mouse down before values change", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onApplyDpiStages = vi.fn();
    const onDpiStagesDraftChange = vi.fn();
    const dpiStagesDraft = {
      activeStage: 2,
      stages: [
        { id: 1, x: 800, y: 800 },
        { id: 2, x: 1600, y: 1600 },
        { id: 3, x: 3200, y: 3200 }
      ]
    };

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 1600, y: 1600 }}
          dpiStages={dpiStagesDraft}
          dpiStagesDraft={dpiStagesDraft}
          onApplyDpiStages={onApplyDpiStages}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const numberInputs = container.querySelectorAll<HTMLInputElement>(".stageNumber");
    act(() => {
      numberInputs[2].focus();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ activeStage: 3 }));
    expect(onApplyDpiStages).toHaveBeenLastCalledWith(expect.objectContaining({ activeStage: 3 }));

    const sliders = container.querySelectorAll<HTMLInputElement>(".stageSlider");
    act(() => {
      sliders[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ activeStage: 1 }));
    expect(onApplyDpiStages).toHaveBeenLastCalledWith(expect.objectContaining({ activeStage: 1 }));

    act(() => {
      sliders[1].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ activeStage: 1 }));

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it("focuses the edited DPI stage input when clicking its badge", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onApplyDpiStages = vi.fn();
    const onDpiStagesDraftChange = vi.fn();
    const dpiStagesDraft = {
      activeStage: 2,
      stages: [
        { id: 1, x: 800, y: 800 },
        { id: 2, x: 1600, y: 1600 }
      ]
    };

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 1600, y: 1600 }}
          dpiStages={dpiStagesDraft}
          dpiStagesDraft={dpiStagesDraft}
          onApplyDpiStages={onApplyDpiStages}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const stageButtons = container.querySelectorAll<HTMLButtonElement>(".stageBadge");
    const numberInputs = container.querySelectorAll<HTMLInputElement>(".stageNumber");

    act(() => {
      stageButtons[0].click();
    });

    expect(document.activeElement).toBe(numberInputs[0]);
    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      activeStage: 1
    });

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it("keeps DPI stage controls focusable while a previous DPI write is applying", () => {
    const html = renderToStaticMarkup(
      <FeaturePanels
        applyingDpi
        applyingPollingRate={false}
        battery={null}
        charging={null}
        dpi={{ x: 800, y: 800 }}
        dpiStages={{ activeStage: 1, stages: [{ id: 1, x: 800, y: 800 }, { id: 2, x: 1600, y: 1600 }] }}
        dpiStagesDraft={{ activeStage: 1, stages: [{ id: 1, x: 800, y: 800 }, { id: 2, x: 1600, y: 1600 }] }}
        onApplyDpiStages={vi.fn()}
        onApplyPollingRate={vi.fn()}
        onDpiStagesDraftChange={vi.fn()}
        pollingRate={1000}
        supportedPollingRates={[125, 500, 1000]}
      />
    );

    expect(html).toContain("aria-busy=\"true\"");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("enables and disables individual DPI stages with switches", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onApplyDpiStages = vi.fn();
    const onDpiStagesDraftChange = vi.fn();
    const dpiStagesDraft = {
      activeStage: 2,
      stages: [
        { enabled: true, id: 1, x: 800, y: 800 },
        { enabled: true, id: 2, x: 1600, y: 1600 },
        { enabled: true, id: 3, x: 3200, y: 3200 }
      ]
    };

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 1600, y: 1600 }}
          dpiStages={dpiStagesDraft}
          dpiStagesDraft={dpiStagesDraft}
          onApplyDpiStages={onApplyDpiStages}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const stageSwitches = container.querySelectorAll<HTMLButtonElement>(".stageEnableSwitch");

    act(() => {
      stageSwitches[1].click();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      activeStage: 1,
      stages: [
        { enabled: true, id: 1, x: 800, y: 800 },
        { enabled: false, id: 2, x: 1600, y: 1600 },
        { enabled: true, id: 3, x: 3200, y: 3200 }
      ]
    });
    expect(onApplyDpiStages).toHaveBeenLastCalledWith({
      activeStage: 1,
      stages: [
        { enabled: true, id: 1, x: 800, y: 800 },
        { enabled: false, id: 2, x: 1600, y: 1600 },
        { enabled: true, id: 3, x: 3200, y: 3200 }
      ]
    });

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 800, y: 800 }}
          dpiStages={{
            activeStage: 1,
            stages: [
              { enabled: true, id: 1, x: 800, y: 800 },
              { enabled: false, id: 2, x: 1600, y: 1600 },
              { enabled: true, id: 3, x: 3200, y: 3200 }
            ]
          }}
          dpiStagesDraft={{
            activeStage: 1,
            stages: [
              { enabled: true, id: 1, x: 800, y: 800 },
              { enabled: false, id: 2, x: 1600, y: 1600 },
              { enabled: true, id: 3, x: 3200, y: 3200 }
            ]
          }}
          onApplyDpiStages={onApplyDpiStages}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const numberInputs = container.querySelectorAll<HTMLInputElement>(".stageNumber");
    expect(numberInputs[1].disabled).toBe(true);

    act(() => {
      container.querySelectorAll<HTMLButtonElement>(".stageEnableSwitch")[1].click();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      activeStage: 1,
      stages: [
        { enabled: true, id: 1, x: 800, y: 800 },
        { enabled: true, id: 2, x: 1600, y: 1600 },
        { enabled: true, id: 3, x: 3200, y: 3200 }
      ]
    });

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it("keeps the final enabled DPI stage from being disabled", () => {
    const html = renderToStaticMarkup(
      <FeaturePanels
        applyingDpi={false}
        applyingPollingRate={false}
        battery={null}
        charging={null}
        dpi={{ x: 800, y: 800 }}
        dpiStages={{ activeStage: 1, stages: [{ enabled: true, id: 1, x: 800, y: 800 }] }}
        dpiStagesDraft={{ activeStage: 1, stages: [{ enabled: true, id: 1, x: 800, y: 800 }] }}
        onApplyDpiStages={vi.fn()}
        onApplyPollingRate={vi.fn()}
        onDpiStagesDraftChange={vi.fn()}
        pollingRate={1000}
        supportedPollingRates={[125, 500, 1000]}
      />
    );

    expect(html).toContain("class=\"ui-switch stageEnableSwitch\"");
    expect(html).toContain("disabled=\"\"");
  });

  it("reassigns DPI stage colors by enabled order after a stage is disabled", () => {
    const html = renderToStaticMarkup(
      <FeaturePanels
        applyingDpi={false}
        applyingPollingRate={false}
        battery={null}
        charging={null}
        dpi={{ x: 800, y: 800 }}
        dpiStages={{
          activeStage: 2,
          stages: [
            { enabled: false, id: 1, x: 400, y: 400 },
            { enabled: true, id: 2, x: 800, y: 800 },
            { enabled: true, id: 3, x: 1600, y: 1600 }
          ]
        }}
        dpiStagesDraft={{
          activeStage: 2,
          stages: [
            { enabled: false, id: 1, x: 400, y: 400 },
            { enabled: true, id: 2, x: 800, y: 800 },
            { enabled: true, id: 3, x: 1600, y: 1600 }
          ]
        }}
        onApplyDpiStages={vi.fn()}
        onApplyPollingRate={vi.fn()}
        onDpiStagesDraftChange={vi.fn()}
        pollingRate={1000}
        supportedPollingRates={[125, 500, 1000]}
      />
    );

    expect(html).toContain("--dpi-stage-color:var(--field-border)");
    expect(html).toContain("--dpi-stage-color:#ff1a1a");
    expect(html).toContain("--dpi-stage-color:#24ff00");
  });

  it("keeps DPI number inputs editable while empty and only commits a valid final value", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onApplyDpiStages = vi.fn();
    const onDpiStagesDraftChange = vi.fn();
    const dpiStagesDraft = {
      activeStage: 1,
      stages: [{ id: 1, x: 800, y: 800 }]
    };

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 800, y: 800 }}
          dpiStages={dpiStagesDraft}
          dpiStagesDraft={dpiStagesDraft}
          onApplyDpiStages={onApplyDpiStages}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const numberInput = container.querySelector<HTMLInputElement>(".stageNumber");
    expect(numberInput).not.toBeNull();

    act(() => {
      numberInput?.focus();
    });

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInputValue?.call(numberInput, "");
      numberInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(document.activeElement).toBe(numberInput);
    expect(onDpiStagesDraftChange).not.toHaveBeenCalled();
    expect(onApplyDpiStages).not.toHaveBeenCalled();

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInputValue?.call(numberInput, "1200");
      numberInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onDpiStagesDraftChange).not.toHaveBeenCalled();
    expect(onApplyDpiStages).not.toHaveBeenCalled();

    act(() => {
      numberInput?.blur();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      stages: [{ id: 1, x: 1200, y: 1200 }]
    });
    expect(onApplyDpiStages).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      stages: [{ id: 1, x: 1200, y: 1200 }]
    });

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it("does not shift the active DPI stage when committing another stage's value", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onApplyDpiStages = vi.fn();
    const onDpiStagesDraftChange = vi.fn();
    const dpiStagesDraft = {
      activeStage: 1,
      stages: [
        { id: 1, x: 800, y: 800 },
        { id: 2, x: 1600, y: 1600 }
      ]
    };

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 800, y: 800 }}
          dpiStages={dpiStagesDraft}
          dpiStagesDraft={dpiStagesDraft}
          onApplyDpiStages={onApplyDpiStages}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const numberInputs = container.querySelectorAll<HTMLInputElement>(".stageNumber");

    act(() => {
      numberInputs[1].focus();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      activeStage: 2
    });

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInputValue?.call(numberInputs[1], "2400");
      numberInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      activeStage: 2
    });

    act(() => {
      numberInputs[1].blur();
    });

    expect(onApplyDpiStages).toHaveBeenLastCalledWith({
      activeStage: 2,
      stages: [
        { id: 1, x: 800, y: 800 },
        { id: 2, x: 2400, y: 2400 }
      ]
    });

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it("updates DPI draft while dragging sliders and commits on release", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onApplyDpiStages = vi.fn();
    const onDpiStagesDraftChange = vi.fn();
    const dpiStagesDraft = {
      activeStage: 1,
      stages: [{ id: 1, x: 800, y: 800 }]
    };

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 800, y: 800 }}
          dpiStages={dpiStagesDraft}
          dpiStagesDraft={dpiStagesDraft}
          onApplyDpiStages={onApplyDpiStages}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const slider = container.querySelector<HTMLInputElement>(".stageSlider");
    expect(slider).not.toBeNull();

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInputValue?.call(slider, "1600");
      slider?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      stages: [{ id: 1, x: 1600, y: 1600 }]
    });
    expect(onApplyDpiStages).toHaveBeenLastCalledWith(
      {
        ...dpiStagesDraft,
        stages: [{ id: 1, x: 1600, y: 1600 }]
      },
      "debounced"
    );

    act(() => {
      slider?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(onApplyDpiStages).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      stages: [{ id: 1, x: 1600, y: 1600 }]
    });

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it("supports separate X/Y axis DPI edits and can relink the axes", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onApplyDpiStages = vi.fn();
    const onDpiStagesDraftChange = vi.fn();
    const dpiStagesDraft = {
      activeStage: 1,
      stages: [{ id: 1, x: 800, y: 800 }]
    };

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingIdleTime={false}
          applyingLowBatteryThreshold={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 800, y: 800 }}
          dpiStages={dpiStagesDraft}
          dpiStagesDraft={dpiStagesDraft}
          idleTime={null}
          lowBatteryThreshold={null}
          onApplyDpiStages={onApplyDpiStages}
          onApplyIdleTime={vi.fn()}
          onApplyLowBatteryThreshold={vi.fn()}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    const splitToggle = container.querySelector<HTMLButtonElement>(".axisModeButton");
    expect(splitToggle).not.toBeNull();

    act(() => {
      splitToggle?.click();
    });

    const numberInputs = container.querySelectorAll<HTMLInputElement>(".stageNumber");
    expect(numberInputs).toHaveLength(2);

    act(() => {
      numberInputs[1].focus();
    });

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInputValue?.call(numberInputs[1], "1200");
      numberInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onDpiStagesDraftChange).not.toHaveBeenCalled();
    expect(onApplyDpiStages).not.toHaveBeenCalled();

    act(() => {
      numberInputs[1].blur();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      stages: [{ id: 1, x: 800, y: 1200 }]
    });
    expect(onApplyDpiStages).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      stages: [{ id: 1, x: 800, y: 1200 }]
    });

    act(() => {
      root.render(
        <FeaturePanels
          applyingDpi={false}
          applyingIdleTime={false}
          applyingLowBatteryThreshold={false}
          applyingPollingRate={false}
          battery={null}
          charging={null}
          dpi={{ x: 800, y: 1200 }}
          dpiStages={{ ...dpiStagesDraft, stages: [{ id: 1, x: 800, y: 1200 }] }}
          dpiStagesDraft={{ ...dpiStagesDraft, stages: [{ id: 1, x: 800, y: 1200 }] }}
          idleTime={null}
          lowBatteryThreshold={null}
          onApplyDpiStages={onApplyDpiStages}
          onApplyIdleTime={vi.fn()}
          onApplyLowBatteryThreshold={vi.fn()}
          onApplyPollingRate={vi.fn()}
          onDpiStagesDraftChange={onDpiStagesDraftChange}
          pollingRate={1000}
          supportedPollingRates={[125, 500, 1000]}
        />
      );
    });

    act(() => {
      container.querySelector<HTMLButtonElement>(".axisModeButton")?.click();
    });

    expect(onDpiStagesDraftChange).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      stages: [{ id: 1, x: 800, y: 800 }]
    });
    expect(onApplyDpiStages).toHaveBeenLastCalledWith({
      ...dpiStagesDraft,
      stages: [{ id: 1, x: 800, y: 800 }]
    });

    act(() => {
      root.unmount();
      container.remove();
    });
  });
});
