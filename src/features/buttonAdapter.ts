export type ButtonActionKind = "mouse" | "keyboard" | "disabled";

export type MouseButtonAction =
  | "leftClick"
  | "rightClick"
  | "middleClick"
  | "back"
  | "forward"
  | "dpiCycle"
  | "dpiUp"
  | "dpiDown";

export type KeyboardButtonAction =
  | "copy"
  | "paste"
  | "cut"
  | "undo"
  | "redo"
  | "playPause"
  | "volumeUp"
  | "volumeDown"
  | "mute"
  | "custom";

export interface ButtonMapping {
  buttonId: string;
  actionKind: ButtonActionKind;
  action: MouseButtonAction | KeyboardButtonAction | "none";
  customKeys?: string;
}

export interface ButtonDefinition {
  id: string;
  labelKey: ButtonLabelKey;
  defaultMapping: ButtonMapping;
}

export type ButtonLabelKey =
  | "buttonMap.button.left"
  | "buttonMap.button.right"
  | "buttonMap.button.middle"
  | "buttonMap.button.back"
  | "buttonMap.button.forward"
  | "buttonMap.button.dpi";

export type ButtonActionLabelKey =
  | "buttonMap.action.leftClick"
  | "buttonMap.action.rightClick"
  | "buttonMap.action.middleClick"
  | "buttonMap.action.back"
  | "buttonMap.action.forward"
  | "buttonMap.action.dpiCycle"
  | "buttonMap.action.dpiUp"
  | "buttonMap.action.dpiDown"
  | "buttonMap.action.copy"
  | "buttonMap.action.paste"
  | "buttonMap.action.cut"
  | "buttonMap.action.undo"
  | "buttonMap.action.redo"
  | "buttonMap.action.playPause"
  | "buttonMap.action.volumeUp"
  | "buttonMap.action.volumeDown"
  | "buttonMap.action.mute"
  | "buttonMap.action.custom"
  | "buttonMap.action.none";

export interface ButtonActionOption {
  kind: ButtonActionKind;
  action: ButtonMapping["action"];
  labelKey: ButtonActionLabelKey;
}

export const BUTTON_DEFINITIONS: readonly ButtonDefinition[] = [
  {
    id: "left",
    labelKey: "buttonMap.button.left",
    defaultMapping: { action: "leftClick", actionKind: "mouse", buttonId: "left" }
  },
  {
    id: "right",
    labelKey: "buttonMap.button.right",
    defaultMapping: { action: "rightClick", actionKind: "mouse", buttonId: "right" }
  },
  {
    id: "middle",
    labelKey: "buttonMap.button.middle",
    defaultMapping: { action: "middleClick", actionKind: "mouse", buttonId: "middle" }
  },
  {
    id: "back",
    labelKey: "buttonMap.button.back",
    defaultMapping: { action: "back", actionKind: "mouse", buttonId: "back" }
  },
  {
    id: "forward",
    labelKey: "buttonMap.button.forward",
    defaultMapping: { action: "forward", actionKind: "mouse", buttonId: "forward" }
  },
  {
    id: "dpi",
    labelKey: "buttonMap.button.dpi",
    defaultMapping: { action: "dpiCycle", actionKind: "mouse", buttonId: "dpi" }
  }
];

export const BUTTON_ACTION_OPTIONS: readonly ButtonActionOption[] = [
  { action: "leftClick", kind: "mouse", labelKey: "buttonMap.action.leftClick" },
  { action: "rightClick", kind: "mouse", labelKey: "buttonMap.action.rightClick" },
  { action: "middleClick", kind: "mouse", labelKey: "buttonMap.action.middleClick" },
  { action: "back", kind: "mouse", labelKey: "buttonMap.action.back" },
  { action: "forward", kind: "mouse", labelKey: "buttonMap.action.forward" },
  { action: "dpiCycle", kind: "mouse", labelKey: "buttonMap.action.dpiCycle" },
  { action: "dpiUp", kind: "mouse", labelKey: "buttonMap.action.dpiUp" },
  { action: "dpiDown", kind: "mouse", labelKey: "buttonMap.action.dpiDown" },
  { action: "copy", kind: "keyboard", labelKey: "buttonMap.action.copy" },
  { action: "paste", kind: "keyboard", labelKey: "buttonMap.action.paste" },
  { action: "cut", kind: "keyboard", labelKey: "buttonMap.action.cut" },
  { action: "undo", kind: "keyboard", labelKey: "buttonMap.action.undo" },
  { action: "redo", kind: "keyboard", labelKey: "buttonMap.action.redo" },
  { action: "playPause", kind: "keyboard", labelKey: "buttonMap.action.playPause" },
  { action: "volumeUp", kind: "keyboard", labelKey: "buttonMap.action.volumeUp" },
  { action: "volumeDown", kind: "keyboard", labelKey: "buttonMap.action.volumeDown" },
  { action: "mute", kind: "keyboard", labelKey: "buttonMap.action.mute" },
  { action: "custom", kind: "keyboard", labelKey: "buttonMap.action.custom" },
  { action: "none", kind: "disabled", labelKey: "buttonMap.action.none" }
];

export function createDefaultButtonMappings(): ButtonMapping[] {
  return BUTTON_DEFINITIONS.map((definition) => ({ ...definition.defaultMapping }));
}

export function sanitizeButtonMappings(value: unknown): ButtonMapping[] {
  if (!Array.isArray(value)) {
    return createDefaultButtonMappings();
  }

  const allowedActions = new Map(BUTTON_ACTION_OPTIONS.map((option) => [option.action, option]));
  const valueByButtonId = new Map<string, Record<string, unknown>>();
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const buttonId = String(item.buttonId ?? "");
    if (BUTTON_DEFINITIONS.some((definition) => definition.id === buttonId)) {
      valueByButtonId.set(buttonId, item);
    }
  }

  return BUTTON_DEFINITIONS.map((definition) => {
    const saved = valueByButtonId.get(definition.id);
    const option = saved ? allowedActions.get(String(saved.action) as ButtonMapping["action"]) : undefined;

    if (!saved || !option) {
      return { ...definition.defaultMapping };
    }

    return {
      action: option.action,
      actionKind: option.kind,
      buttonId: definition.id,
      customKeys: option.action === "custom" && typeof saved.customKeys === "string" ? saved.customKeys : undefined
    };
  });
}

export function updateButtonMapping(
  mappings: readonly ButtonMapping[],
  buttonId: string,
  action: ButtonMapping["action"]
): ButtonMapping[] {
  const option = BUTTON_ACTION_OPTIONS.find((item) => item.action === action);

  if (!option) {
    return mappings.map((mapping) => ({ ...mapping }));
  }

  return mappings.map((mapping) =>
    mapping.buttonId === buttonId
      ? {
          action: option.action,
          actionKind: option.kind,
          buttonId,
          customKeys: option.action === "custom" ? mapping.customKeys : undefined
        }
      : { ...mapping }
  );
}

export function updateButtonMappingCustomKeys(
  mappings: readonly ButtonMapping[],
  buttonId: string,
  customKeys: string
): ButtonMapping[] {
  return mappings.map((mapping) =>
    mapping.buttonId === buttonId ? { ...mapping, customKeys: customKeys.slice(0, 40) } : { ...mapping }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
