import {
  RAZER_REPORT_ID,
  WORKING_TRANSACTION_ID,
  buildRazerReport,
  formatRazerStatus
} from "../domain/razerProtocol";
import type { ProtocolRequest, ProtocolResponse } from "../domain/types";
import type { TransportCommand } from "../hid/hidTransport";

export type ButtonActionKind = "mouse" | "keyboard" | "disabled";
export type ButtonProtocol = "official-obm" | "legacy-rep4";

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

const BUTTON_COMMAND_CLASS = 0x02;
const BUTTON_SET_COMMAND_ID = 0x0c;
const BUTTON_GET_COMMAND_ID = 0x8c;
const BUTTON_DATA_SIZE = 0x50;
const PROFILE_ID = 0x01;
const NORMAL_MODE = 0x00;
const LEGACY_BUTTON_DATA_SIZE = 0x0a;

const buttonIdToDeviceId: Record<string, number> = {
  left: 0x01,
  right: 0x02,
  middle: 0x03,
  back: 0x04,
  forward: 0x05,
  dpi: 0x60
};

const mouseActionToAssignment: Partial<Record<MouseButtonAction, ButtonAssignment>> = {
  leftClick: { data: [0x01], functionId: 0x01 },
  rightClick: { data: [0x02], functionId: 0x01 },
  middleClick: { data: [0x03], functionId: 0x01 },
  back: { data: [0x04], functionId: 0x01 },
  forward: { data: [0x05], functionId: 0x01 },
  dpiCycle: { data: [0x06], functionId: 0x06 },
  dpiUp: { data: [0x01], functionId: 0x06 },
  dpiDown: { data: [0x02], functionId: 0x06 }
};

const keyboardActionToShortcut: Partial<Record<KeyboardButtonAction, string>> = {
  copy: "Ctrl+C",
  paste: "Ctrl+V",
  cut: "Ctrl+X",
  undo: "Ctrl+Z",
  redo: "Ctrl+Y"
};

const mediaActionToUsage: Partial<Record<KeyboardButtonAction, number>> = {
  mute: 0x00e2,
  playPause: 0x00cd,
  volumeUp: 0x00e9,
  volumeDown: 0x00ea
};

const keyNameToUsage: Record<string, number> = {
  backspace: 0x2a,
  delete: 0x4c,
  down: 0x51,
  end: 0x4d,
  enter: 0x28,
  esc: 0x29,
  escape: 0x29,
  home: 0x4a,
  insert: 0x49,
  left: 0x50,
  pagedown: 0x4e,
  pageup: 0x4b,
  right: 0x4f,
  space: 0x2c,
  tab: 0x2b,
  up: 0x52
};

const modifierNameToBit: Record<string, number> = {
  alt: 0x04,
  ctrl: 0x01,
  control: 0x01,
  meta: 0x08,
  shift: 0x02,
  win: 0x08,
  windows: 0x08
};

interface ButtonAssignment {
  functionId: number;
  data: number[];
}

export function getButtonProtocol(productId: number): ButtonProtocol {
  return productId === 0x00c0 || productId === 0x00c1 ? "legacy-rep4" : "official-obm";
}

export async function readButtonMappings(
  command: TransportCommand,
  protocol: ButtonProtocol = "official-obm"
): Promise<ButtonMapping[]> {
  const mappings: ButtonMapping[] = [];

  for (const definition of BUTTON_DEFINITIONS) {
    mappings.push(await readButtonMapping(command, definition.id, protocol));
  }

  return mappings;
}

export async function writeButtonMappings(
  command: TransportCommand,
  mappings: readonly ButtonMapping[],
  protocol: ButtonProtocol = "official-obm"
): Promise<ButtonMapping[]> {
  const sanitized = sanitizeButtonMappings(mappings);
  const encodedMappings = sanitized.map((mapping) => ({
    mapping,
    payload: protocol === "legacy-rep4" ? encodeLegacyButtonMapping(mapping) : encodeOfficialButtonMapping(mapping)
  }));
  const currentMappings = await readButtonMappings(command, protocol);
  const currentByButtonId = new Map(currentMappings.map((mapping) => [mapping.buttonId, mapping]));
  const encoded = encodedMappings.filter(({ mapping }) => {
    const current = currentByButtonId.get(mapping.buttonId);
    return !current || !areButtonMappingsEqual(mapping, current);
  });

  for (const item of encoded) {
    const { mapping, payload } = item;
    const response = await command(buildButtonWriteRequest(mapping.buttonId, payload, protocol));
    assertButtonResponse(response, BUTTON_SET_COMMAND_ID, `Set ${mapping.buttonId} button mapping`);

    const verified = await readButtonMapping(command, mapping.buttonId, protocol, `Verify ${mapping.buttonId} button mapping`);

    if (!areButtonMappingsEqual(mapping, verified)) {
      throw new Error(`Button mapping verification failed for ${mapping.buttonId}`);
    }
  }

  return sanitized;
}

async function readButtonMapping(
  command: TransportCommand,
  buttonId: string,
  protocol: ButtonProtocol,
  commandName = `Read ${buttonId} button mapping`
): Promise<ButtonMapping> {
  const response = await command(buildButtonReadRequest(buttonId, protocol, commandName));
  assertButtonResponse(response, BUTTON_GET_COMMAND_ID, commandName);
  const mapping = protocol === "legacy-rep4"
    ? decodeLegacyButtonMapping(buttonId, response.raw)
    : decodeOfficialButtonMapping(buttonId, response.raw);

  if (protocol === "legacy-rep4") {
    const stableResponse = await command(buildButtonReadRequest(buttonId, protocol, `${commandName} stability check`));
    assertButtonResponse(stableResponse, BUTTON_GET_COMMAND_ID, `${commandName} stability check`);
    const stableMapping = decodeLegacyButtonMapping(buttonId, stableResponse.raw);
    if (!areButtonMappingsEqual(mapping, stableMapping)) {
      throw new Error(`Legacy button mapping read was unstable for ${buttonId}`);
    }
  }

  return mapping;
}

function buildButtonReadRequest(
  buttonId: string,
  protocol: ButtonProtocol,
  commandName = `Read ${buttonId} button mapping`
): ProtocolRequest {
  if (protocol === "legacy-rep4") {
    const source = getDeviceButtonId(buttonId);
    return buildButtonRequest(
      commandName,
      BUTTON_GET_COMMAND_ID,
      LEGACY_BUTTON_DATA_SIZE,
      new Uint8Array([PROFILE_ID, source & 0xff, (source >> 8) & 0xff])
    );
  }

  return buildButtonRequest(
    commandName,
    BUTTON_GET_COMMAND_ID,
    BUTTON_DATA_SIZE,
    new Uint8Array([PROFILE_ID, getDeviceButtonId(buttonId), NORMAL_MODE])
  );
}

function buildButtonWriteRequest(buttonId: string, payload: Uint8Array, protocol: ButtonProtocol): ProtocolRequest {
  return buildButtonRequest(
    `Set ${buttonId} button mapping`,
    BUTTON_SET_COMMAND_ID,
    protocol === "legacy-rep4" ? LEGACY_BUTTON_DATA_SIZE : BUTTON_DATA_SIZE,
    payload
  );
}

function encodeOfficialButtonMapping(mapping: ButtonMapping): Uint8Array {
  const assignment = encodeButtonAssignment(mapping);
  const payload = new Uint8Array(10);
  payload[0] = PROFILE_ID;
  payload[1] = getDeviceButtonId(mapping.buttonId);
  payload[2] = NORMAL_MODE;
  payload[3] = assignment.functionId;
  payload[4] = assignment.data.length;
  payload.set(assignment.data.slice(0, 5), 5);
  return payload;
}

function encodeLegacyButtonMapping(mapping: ButtonMapping): Uint8Array {
  const assignment = encodeButtonAssignment(mapping);
  let quadlet: number[];

  if (assignment.functionId === 0x00) {
    quadlet = [0x01, 0x01, 0x00, 0x00];
  } else if (assignment.functionId === 0x01) {
    quadlet = [0x01, 0x01, assignment.data[0], 0x00];
  } else if (assignment.functionId === 0x06 && assignment.data[0] === 0x06) {
    quadlet = [0x06, 0x01, 0x06, 0x00];
  } else if (assignment.functionId === 0x02) {
    quadlet = [0x02, 0x02, assignment.data[0], assignment.data[1]];
  } else if (assignment.functionId === 0x0a) {
    quadlet = [0x0a, 0x02, assignment.data[1], assignment.data[0]];
  } else {
    throw new Error(`Action ${mapping.action} is not verified for the legacy REP4 button protocol`);
  }

  const source = getDeviceButtonId(mapping.buttonId);
  return new Uint8Array([PROFILE_ID, source & 0xff, (source >> 8) & 0xff, ...quadlet, 0x00, 0x00, 0x00]);
}

function buildButtonRequest(commandName: string, commandId: number, dataSize: number, payload: Uint8Array): ProtocolRequest {
  return {
    reportId: RAZER_REPORT_ID,
    commandName,
    bytes: buildRazerReport({
      commandClass: BUTTON_COMMAND_CLASS,
      commandId,
      dataSize,
      transactionId: WORKING_TRANSACTION_ID,
      payload
    })
  };
}

function encodeButtonAssignment(mapping: ButtonMapping): ButtonAssignment {
  if (mapping.action === "none") {
    return { data: [], functionId: 0x00 };
  }

  const mouseAssignment = mouseActionToAssignment[mapping.action as MouseButtonAction];
  if (mouseAssignment) {
    return mouseAssignment;
  }

  const mediaUsage = mediaActionToUsage[mapping.action as KeyboardButtonAction];
  if (mediaUsage !== undefined) {
    return { data: [mediaUsage & 0xff, (mediaUsage >> 8) & 0xff], functionId: 0x0a };
  }

  const shortcut =
    mapping.action === "custom"
      ? mapping.customKeys
      : keyboardActionToShortcut[mapping.action as KeyboardButtonAction];
  const parsedShortcut = parseShortcut(shortcut ?? "");
  return { data: [parsedShortcut.modifiers, parsedShortcut.usage], functionId: 0x02 };
}

function decodeOfficialButtonMapping(buttonId: string, raw: Uint8Array): ButtonMapping {
  const functionId = raw[11];
  const dataSize = raw[12];
  const data = raw.slice(13, 13 + Math.min(dataSize, 5));

  if (functionId === 0x00) {
    return { action: "none", actionKind: "disabled", buttonId };
  }

  if (functionId === 0x01 && dataSize >= 1) {
    const actionByTarget: Record<number, MouseButtonAction> = {
      0x01: "leftClick",
      0x02: "rightClick",
      0x03: "middleClick",
      0x04: "back",
      0x05: "forward"
    };
    const action = actionByTarget[data[0]];
    if (action) {
      return { action, actionKind: "mouse", buttonId };
    }
  }

  if (functionId === 0x06 && dataSize >= 1) {
    const actionByDpiCode: Record<number, MouseButtonAction> = {
      0x01: "dpiUp",
      0x02: "dpiDown",
      0x06: "dpiCycle"
    };
    const action = actionByDpiCode[data[0]];
    if (action) {
      return { action, actionKind: "mouse", buttonId };
    }
  }

  if (functionId === 0x0a && dataSize >= 2) {
    const usage = data[0] | (data[1] << 8);
    const action = Object.entries(mediaActionToUsage).find(([, value]) => value === usage)?.[0] as
      | KeyboardButtonAction
      | undefined;
    if (action) {
      return { action, actionKind: "keyboard", buttonId };
    }
  }

  if (functionId === 0x02 && dataSize >= 2) {
    const customKeys = formatShortcut(data[0], data[1]);
    const action = Object.entries(keyboardActionToShortcut).find(([, shortcut]) => shortcut === customKeys)?.[0] as
      | KeyboardButtonAction
      | undefined;
    return action
      ? { action, actionKind: "keyboard", buttonId }
      : { action: "custom", actionKind: "keyboard", buttonId, customKeys };
  }

  throw new Error(
    `Unsupported button assignment for ${buttonId}: function 0x${functionId.toString(16)}, data ${[...data]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join(" ")}`
  );
}

function decodeLegacyButtonMapping(buttonId: string, raw: Uint8Array): ButtonMapping {
  const source = getDeviceButtonId(buttonId);
  const sourceEcho = raw[9] | (raw[10] << 8);
  if (raw[8] !== PROFILE_ID || sourceEcho !== source) {
    throw new Error(`Legacy button mapping response did not echo ${buttonId}`);
  }

  const [functionId, dataSize, data0, data1] = raw.slice(11, 15);
  if (functionId === 0x01 && dataSize === 0x01) {
    if (data0 === 0x00) return { action: "none", actionKind: "disabled", buttonId };
    return decodeOfficialButtonMapping(buttonId, officialRaw(0x01, [data0]));
  }
  if (functionId === 0x06 && dataSize === 0x01 && data0 === 0x06) {
    return { action: "dpiCycle", actionKind: "mouse", buttonId };
  }
  if (functionId === 0x02 && dataSize === 0x02) {
    return decodeOfficialButtonMapping(buttonId, officialRaw(0x02, [data0, data1]));
  }
  if (functionId === 0x0a && dataSize === 0x02) {
    return decodeOfficialButtonMapping(buttonId, officialRaw(0x0a, [data1, data0]));
  }

  throw new Error(
    `Unsupported legacy button assignment for ${buttonId}: ${[functionId, dataSize, data0, data1]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join(" ")}`
  );
}

function officialRaw(functionId: number, data: number[]): Uint8Array {
  const raw = new Uint8Array(90);
  raw[11] = functionId;
  raw[12] = data.length;
  raw.set(data, 13);
  return raw;
}

function parseShortcut(shortcut: string): { modifiers: number; usage: number } {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  let modifiers = 0;
  let usage = 0;

  for (const part of parts) {
    const normalized = part.toLowerCase();
    const modifier = modifierNameToBit[normalized];
    if (modifier !== undefined) {
      modifiers |= modifier;
      continue;
    }

    if (usage !== 0) {
      throw new Error("Custom shortcuts can contain only one non-modifier key");
    }
    usage = keyUsageFromName(normalized);
  }

  if (usage === 0) {
    throw new Error("Custom shortcut must include one non-modifier key");
  }

  return { modifiers, usage };
}

function keyUsageFromName(name: string): number {
  if (/^[a-z]$/.test(name)) {
    return name.charCodeAt(0) - "a".charCodeAt(0) + 0x04;
  }
  if (/^[1-9]$/.test(name)) {
    return Number(name) - 1 + 0x1e;
  }
  if (name === "0") {
    return 0x27;
  }
  if (/^f([1-9]|1[0-2])$/.test(name)) {
    return Number(name.slice(1)) - 1 + 0x3a;
  }

  const usage = keyNameToUsage[name.replace(/\s+/g, "")];
  if (usage === undefined) {
    throw new Error(`Unsupported custom shortcut key: ${name}`);
  }
  return usage;
}

function formatShortcut(modifiers: number, usage: number): string {
  const parts: string[] = [];
  if (modifiers & 0x01) parts.push("Ctrl");
  if (modifiers & 0x02) parts.push("Shift");
  if (modifiers & 0x04) parts.push("Alt");
  if (modifiers & 0x08) parts.push("Win");
  parts.push(keyNameFromUsage(usage));
  return parts.join("+");
}

function keyNameFromUsage(usage: number): string {
  if (usage >= 0x04 && usage <= 0x1d) {
    return String.fromCharCode("A".charCodeAt(0) + usage - 0x04);
  }
  if (usage >= 0x1e && usage <= 0x26) {
    return String(usage - 0x1e + 1);
  }
  if (usage === 0x27) {
    return "0";
  }
  if (usage >= 0x3a && usage <= 0x45) {
    return `F${usage - 0x3a + 1}`;
  }

  const name = Object.entries(keyNameToUsage).find(([, value]) => value === usage)?.[0];
  if (!name) {
    throw new Error(`Unsupported keyboard usage 0x${usage.toString(16)}`);
  }
  return name === "esc" ? "Esc" : name.charAt(0).toUpperCase() + name.slice(1);
}

function areButtonMappingsEqual(left: ButtonMapping, right: ButtonMapping): boolean {
  if (left.buttonId !== right.buttonId || left.action !== right.action || left.actionKind !== right.actionKind) {
    return false;
  }
  if (left.action !== "custom") {
    return true;
  }

  try {
    const leftShortcut = parseShortcut(left.customKeys ?? "");
    const rightShortcut = parseShortcut(right.customKeys ?? "");
    return leftShortcut.modifiers === rightShortcut.modifiers && leftShortcut.usage === rightShortcut.usage;
  } catch {
    return false;
  }
}

function getDeviceButtonId(buttonId: string): number {
  const deviceButtonId = buttonIdToDeviceId[buttonId];
  if (deviceButtonId === undefined) {
    throw new Error(`Unsupported button id: ${buttonId}`);
  }
  return deviceButtonId;
}

function assertButtonResponse(response: ProtocolResponse, expectedCommandId: number, label: string): void {
  if (!response.success) {
    throw new Error(`${label} command failed with status ${response.status} (${formatRazerStatus(response.status)})`);
  }
  if (response.commandClass !== BUTTON_COMMAND_CLASS || response.commandId !== expectedCommandId) {
    throw new Error(
      `${label} command response mismatch: expected 0x${BUTTON_COMMAND_CLASS.toString(16)}/0x${expectedCommandId.toString(
        16
      )}, got 0x${response.commandClass.toString(16)}/0x${response.commandId.toString(16)}`
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
