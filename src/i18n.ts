import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const enMessages = {
  "app.eyebrow": "WebHID Razer Console",
  "app.subtitle": "Connect a Razer HID device and expose only browser-verified controls.",
  "app.webHidUnavailable": "WebHID is unavailable. Use a Chromium-based browser on localhost or HTTPS.",
  "language.label": "Language",
  "settings.label": "Settings",
  "settings.debug": "Debug",
  "settings.installApp": "Install app",
  "settings.installAppSuccess": "Snap Razer is ready as an installed app.",
  "settings.installAppUnavailable": "Use your browser menu to install this page as an app.",
  "settings.github": "GitHub",
  "theme.label": "Theme",
  "theme.toggle": "Switch to {theme} theme",
  "theme.current": "Theme, currently {theme}",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "connection.connect": "Connect Razer Device",
  "connection.connecting": "Connecting...",
  "connection.actions": "Connection actions",
  "connection.disconnect": "Disconnect",
  "connection.conflictHelp": "Connection help",
  "connection.conflictQuickFix": "Quick fixes",
  "connection.conflictStepQuit":
    "Uninstall Razer Synapse, Razer Central, Razer App Engine, or other mouse tools that can take the HID control interface.",
  "connection.conflictStepWindowsService":
    "On Windows, uninstalling is often required because tray quit and stopped services can still leave drivers or services that retake the interface.",
  "connection.conflictStepReplug": "Restart Windows, then unplug and replug the receiver or USB cable so the browser can enumerate HID again.",
  "connection.conflictStepPermission": "Clear this site's HID permission in the browser, then reconnect so the control interface can be probed again.",
  "connection.nativeDriverConflict":
    "Installed Razer software can occupy the HID interface and conflict with WebHID. On Windows, uninstalling it may be required.",
  "connection.noDevice": "No device connected",
  "connection.controlReportsAvailable": "control reports available",
  "connection.probingReport": "probing report 0",
  "connection.inputOnlyInterface": "input-only interface",
  "controls.title": "Controls",
  "controls.customize": "Customize",
  "controls.performance": "Performance",
  "controls.power": "Power",
  "controls.advanced": "Advanced",
  "controls.sections": "Control sections",
  "customize.buttons": "Button Mapping",
  "customize.browserLimited": "Browser limited",
  "customize.buttonsDescription": "System-wide remapping is not exposed until firmware-level reports are known.",
  "buttonMap.title": "Button assignments",
  "buttonMap.description": "Edit a local draft profile for the buttons most Razer mice expose.",
  "buttonMap.firmwareNotice":
    "Changes below are not sent to the mouse. Razer button writes need a verified vendor report; browser mouse input collections are protected by WebHID.",
  "buttonMap.localDraft": "Local draft",
  "buttonMap.applyUnavailable": "Apply unavailable",
  "buttonMap.savedDraft": "Saved local draft",
  "buttonMap.savedDraftDescription": "This has not been written to the device because button firmware reports are not verified yet.",
  "buttonMap.resetDraft": "Reset local draft",
  "buttonMap.reset": "Reset",
  "buttonMap.buttonLabel": "Button",
  "buttonMap.assignment": "Assignment",
  "buttonMap.customKeys": "Keys",
  "buttonMap.customPlaceholder": "Ctrl+Shift+S",
  "buttonMap.type": "Type",
  "buttonMap.type.mouse": "Mouse",
  "buttonMap.type.keyboard": "Keyboard",
  "buttonMap.type.disabled": "Disabled",
  "buttonMap.button.left": "Left click",
  "buttonMap.button.right": "Right click",
  "buttonMap.button.middle": "Wheel click",
  "buttonMap.button.back": "Back side",
  "buttonMap.button.forward": "Forward side",
  "buttonMap.button.dpi": "DPI button",
  "buttonMap.action.leftClick": "Left click",
  "buttonMap.action.rightClick": "Right click",
  "buttonMap.action.middleClick": "Wheel click",
  "buttonMap.action.back": "Back",
  "buttonMap.action.forward": "Forward",
  "buttonMap.action.dpiCycle": "DPI cycle",
  "buttonMap.action.dpiUp": "DPI up",
  "buttonMap.action.dpiDown": "DPI down",
  "buttonMap.action.copy": "Copy",
  "buttonMap.action.paste": "Paste",
  "buttonMap.action.cut": "Cut",
  "buttonMap.action.undo": "Undo",
  "buttonMap.action.redo": "Redo",
  "buttonMap.action.playPause": "Play/Pause",
  "buttonMap.action.volumeUp": "Volume up",
  "buttonMap.action.volumeDown": "Volume down",
  "buttonMap.action.mute": "Mute",
  "buttonMap.action.custom": "Custom shortcut",
  "buttonMap.action.none": "Disable button",
  "performance.sensitivity": "Sensitivity",
  "performance.sensitivityDescription": "Mouse movement dots per inch (DPI).",
  "performance.currentDpi": "Current DPI: {x}:{y}",
  "performance.dpiProbeFailed": "DPI probe has not succeeded on this device.",
  "performance.xAxis": "X axis DPI",
  "performance.yAxis": "Y axis DPI",
  "performance.enableSeparateAxes": "Enable separate X/Y axis DPI",
  "performance.disableSeparateAxes": "Disable separate X/Y axis DPI",
  "performance.enableDpiStage": "Enable DPI stage {stage}",
  "performance.disableDpiStage": "Disable DPI stage {stage}",
  "performance.pollingRate": "Polling Rate",
  "performance.pollingRateDescription": "Data update frequency in one second (Hz).",
  "performance.inGamePollingRate": "In-game polling rate",
  "performance.pollingFullscreenUnavailable":
    "Change polling rate while games are running in fullscreen mode is not available in WebHID.",
  "performance.pollingProbeFailed": "Polling rate probe has not succeeded on this device.",
  "performance.mouseProperties": "Mouse Properties",
  "performance.systemSetting": "System setting",
  "performance.mousePropertiesDescription": "Browsers cannot directly open system mouse settings from this page.",
  "mouseTest.title": "Mouse Test",
  "mouseTest.waiting": "Move pending",
  "mouseTest.rateValue": "{rate} Hz",
  "mouseTest.reset": "Reset mouse test",
  "mouseTest.areaLabel": "Mouse test area",
  "mouseTest.chartLabel": "Polling rate history",
  "mouseTest.peak": "Peak",
  "mouseTest.jitter": "Jitter",
  "mouseTest.interval": "Interval",
  "mouseTest.speed": "Speed",
  "mouseTest.position": "Position",
  "power.battery": "Battery",
  "power.charging": "Charging",
  "power.wirelessPowerSaving": "Wireless Power Saving",
  "power.lowPowerMode": "Low Power Mode",
  "power.notAvailable": "Not available",
  "power.rawValue": "Raw value {value}",
  "power.connectWirelessDevice": "Connect and probe a supported wireless device.",
  "power.chargingNotConfirmed": "Charging report has not been confirmed.",
  "power.isCharging": "Charging",
  "power.notCharging": "Not charging",
  "power.minutesUnit": " min",
  "power.wirelessPowerSavingDescription": "Go to sleep after this idle time while wireless.",
  "power.lowPowerModeDescription": "Enter low-power mode below this battery percentage while wireless.",
  "power.wirelessPowerSavingProbeFailed": "Idle-time reports have not succeeded on this device.",
  "power.lowPowerModeProbeFailed": "Low-battery threshold reports have not succeeded on this device.",
  "advanced.dynamicSensitivity": "Dynamic Sensitivity",
  "advanced.dynamicSensitivityDescription": "Choose an acceleration curve that scales output with mouse speed.",
  "advanced.dynamicSensitivity.classic": "Classic",
  "advanced.dynamicSensitivity.natural": "Natural",
  "advanced.dynamicSensitivity.jump": "Jump",
  "advanced.dynamicSensitivity.custom": "Custom",
  "advanced.dynamicSensitivity.template": "Choose template",
  "advanced.dynamicSensitivity.template.none": "None",
  "advanced.rotation": "Rotation",
  "advanced.rotationDescription": "Rotate the mouse angle to keep horizontal movement straight with your grip.",
  "advanced.rotationDetails": "Details are available in",
  "advanced.rotationToolLink": "this tool",
  "advanced.rotationAngle": "Rotation angle",
  "advanced.probeFailed": "Advanced sensor reports have not succeeded on this device.",
  "capability.title": "Capability Matrix",
  "capability.battery": "Battery",
  "capability.charging": "Charging",
  "capability.dpi": "DPI",
  "capability.pollingRate": "Polling Rate",
  "capability.lighting": "Lighting",
  "capability.buttons": "Buttons",
  "capability.state.available": "Available",
  "capability.state.unsupported": "Unsupported",
  "capability.state.probeFailed": "Probe failed",
  "capability.state.notImplemented": "Not implemented",
  "capability.state.browserLimited": "Browser limited",
  "capability.detail.battery.unsupported": "Battery has not been confirmed on this device.",
  "capability.detail.charging.unsupported": "Charging state has not been confirmed on this device.",
  "capability.detail.dpi.notImplemented": "DPI controls will be enabled after a device-safe adapter is implemented.",
  "capability.detail.pollingRate.notImplemented":
    "Polling rate controls will be enabled after a device-safe adapter is implemented.",
  "capability.detail.lighting.notImplemented": "Lighting controls will be enabled after a device-safe adapter is added.",
  "capability.detail.buttons.browserLimited":
    "WebHID cannot reliably remap system-wide mouse input without firmware-level reports.",
  "capability.detail.battery.available": "Battery is readable. Last value: {percent}%.",
  "capability.detail.charging.availableCharging": "Device reports that it is charging.",
  "capability.detail.charging.availableNotCharging": "Device reports that it is not charging.",
  "capability.detail.dpi.available": "DPI is readable. Last value: {x}:{y}.",
  "capability.detail.pollingRate.available": "Polling rate is readable. Last value: {rate} Hz.",
  "debug.title": "Debug Log ({count})",
  "debug.noTraffic": "No HID traffic yet.",
  "debug.report": "Report",
  "debug.request": "Request",
  "debug.send": "Send",
  "debug.descriptor": "Descriptor",
  "debug.response": "Response",
  "debug.noResponse": "No response",
  "debug.open": "Open debug log",
  "debug.clear": "Clear history",
  "debug.copy": "Copy all logs",
  "debug.copySuccess": "Debug log copied.",
  "debug.copyFailed": "Could not copy debug log.",
  "debug.close": "Close",
  "error.inputOnlyInterface":
    "This selected HID interface exposes only input reports. Pick another Razer interface in the browser device chooser, or uninstall Razer Synapse/other native software that may own the control interface. On Windows, uninstalling and restarting may be required.",
  "error.allActiveProbesFailed":
    "All active probes failed. If this happened after a firmware update or sleep/reconnect, unplug and replug the Razer receiver, then clear the browser HID permission and connect again."
} as const;

export type MessageKey = keyof typeof enMessages;
export type MessageParams = Record<string, string | number | boolean | null | undefined>;

interface LocaleDefinition {
  label: string;
  nativeName: string;
  messages: Record<MessageKey, string>;
}

const zhCNMessages: Record<MessageKey, string> = {
  "app.eyebrow": "WebHID 雷蛇控制台",
  "app.subtitle": "连接雷蛇 HID 设备，只显示浏览器已验证的控制项。",
  "app.webHidUnavailable": "当前浏览器不支持 WebHID。请在 localhost 或 HTTPS 下使用 Chromium 系浏览器。",
  "language.label": "语言",
  "settings.label": "设置",
  "settings.debug": "调试",
  "settings.installApp": "安装应用",
  "settings.installAppSuccess": "Snap Razer 已可作为已安装应用使用。",
  "settings.installAppUnavailable": "请使用浏览器菜单将此页面安装成应用。",
  "settings.github": "GitHub",
  "theme.label": "主题",
  "theme.toggle": "切换到{theme}主题",
  "theme.current": "当前主题：{theme}",
  "theme.system": "跟随系统",
  "theme.light": "浅色",
  "theme.dark": "深色",
  "connection.connect": "连接雷蛇设备",
  "connection.connecting": "正在连接...",
  "connection.actions": "连接操作",
  "connection.disconnect": "断开连接",
  "connection.conflictHelp": "连接帮助",
  "connection.conflictQuickFix": "快速处理",
  "connection.conflictStepQuit":
    "卸载 Razer Synapse、Razer Central、Razer App Engine 或其他可能占用 HID 控制接口的鼠标工具。",
  "connection.conflictStepWindowsService":
    "Windows 上通常需要卸载，因为托盘退出、停止服务后，驱动或后台服务仍可能重新抢占接口。",
  "connection.conflictStepReplug": "重启 Windows，然后拔插接收器或 USB 线，让浏览器重新枚举 HID 设备。",
  "connection.conflictStepPermission": "清除浏览器里此站点的 HID 权限，然后重新连接，让控制接口重新探测。",
  "connection.nativeDriverConflict":
    "安装的 Razer 软件可能会占用 HID 接口并与 WebHID 冲突。Windows 上可能需要卸载后才能使用。",
  "connection.noDevice": "未连接设备",
  "connection.controlReportsAvailable": "控制报告可用",
  "connection.probingReport": "正在探测报告 0",
  "connection.inputOnlyInterface": "仅输入接口",
  "controls.title": "控制",
  "controls.customize": "自定义",
  "controls.performance": "性能",
  "controls.power": "电源",
  "controls.advanced": "高级",
  "controls.sections": "控制分区",
  "customize.buttons": "按键映射",
  "customize.browserLimited": "浏览器受限",
  "customize.buttonsDescription": "在确认固件级报告前，系统级重映射不会开放。",
  "buttonMap.title": "按键分配",
  "buttonMap.description": "编辑一份本地草稿，用于记录大多数雷蛇鼠标会暴露的按键配置。",
  "buttonMap.firmwareNotice":
    "下面的改动不会发送到鼠标。雷蛇按键写入需要先确认厂商自定义报告；浏览器会保护普通鼠标输入集合。",
  "buttonMap.localDraft": "本地草稿",
  "buttonMap.applyUnavailable": "暂不能应用",
  "buttonMap.savedDraft": "已保存本地草稿",
  "buttonMap.savedDraftDescription": "尚未写入设备，因为还没有确认此设备的按键固件报告。",
  "buttonMap.resetDraft": "已重置本地草稿",
  "buttonMap.reset": "重置",
  "buttonMap.buttonLabel": "按键",
  "buttonMap.assignment": "分配",
  "buttonMap.customKeys": "按键",
  "buttonMap.customPlaceholder": "Ctrl+Shift+S",
  "buttonMap.type": "类型",
  "buttonMap.type.mouse": "鼠标",
  "buttonMap.type.keyboard": "键盘",
  "buttonMap.type.disabled": "禁用",
  "buttonMap.button.left": "左键",
  "buttonMap.button.right": "右键",
  "buttonMap.button.middle": "滚轮键",
  "buttonMap.button.back": "侧后键",
  "buttonMap.button.forward": "侧前键",
  "buttonMap.button.dpi": "DPI 键",
  "buttonMap.action.leftClick": "左键单击",
  "buttonMap.action.rightClick": "右键单击",
  "buttonMap.action.middleClick": "滚轮单击",
  "buttonMap.action.back": "后退",
  "buttonMap.action.forward": "前进",
  "buttonMap.action.dpiCycle": "DPI 循环",
  "buttonMap.action.dpiUp": "DPI 增加",
  "buttonMap.action.dpiDown": "DPI 降低",
  "buttonMap.action.copy": "复制",
  "buttonMap.action.paste": "粘贴",
  "buttonMap.action.cut": "剪切",
  "buttonMap.action.undo": "撤销",
  "buttonMap.action.redo": "重做",
  "buttonMap.action.playPause": "播放/暂停",
  "buttonMap.action.volumeUp": "音量增加",
  "buttonMap.action.volumeDown": "音量降低",
  "buttonMap.action.mute": "静音",
  "buttonMap.action.custom": "自定义快捷键",
  "buttonMap.action.none": "禁用按键",
  "performance.sensitivity": "灵敏度",
  "performance.sensitivityDescription": "鼠标移动的每英寸点数（DPI）。",
  "performance.currentDpi": "当前 DPI：{x}:{y}",
  "performance.dpiProbeFailed": "此设备的 DPI 探测尚未成功。",
  "performance.xAxis": "X 轴 DPI",
  "performance.yAxis": "Y 轴 DPI",
  "performance.enableSeparateAxes": "启用 X/Y 轴分别设置",
  "performance.disableSeparateAxes": "禁用 X/Y 轴分别设置",
  "performance.enableDpiStage": "启用 DPI 档位 {stage}",
  "performance.disableDpiStage": "禁用 DPI 档位 {stage}",
  "performance.pollingRate": "轮询率",
  "performance.pollingRateDescription": "每秒数据更新频率（Hz）。",
  "performance.inGamePollingRate": "游戏内轮询率",
  "performance.pollingFullscreenUnavailable": "WebHID 无法在游戏全屏运行时更改轮询率。",
  "performance.pollingProbeFailed": "此设备的轮询率探测尚未成功。",
  "performance.mouseProperties": "鼠标属性",
  "performance.systemSetting": "系统设置",
  "performance.mousePropertiesDescription": "浏览器无法从此页面直接打开系统鼠标设置。",
  "mouseTest.title": "鼠标测试",
  "mouseTest.waiting": "等待移动",
  "mouseTest.rateValue": "{rate} Hz",
  "mouseTest.reset": "重置鼠标测试",
  "mouseTest.areaLabel": "鼠标测试区域",
  "mouseTest.chartLabel": "轮询率历史",
  "mouseTest.peak": "峰值",
  "mouseTest.jitter": "抖动",
  "mouseTest.interval": "间隔",
  "mouseTest.speed": "速度",
  "mouseTest.position": "位置",
  "power.battery": "电池",
  "power.charging": "充电",
  "power.wirelessPowerSaving": "无线省电",
  "power.lowPowerMode": "低功耗模式",
  "power.notAvailable": "不可用",
  "power.rawValue": "原始值 {value}",
  "power.connectWirelessDevice": "连接并探测支持的无线设备。",
  "power.chargingNotConfirmed": "充电报告尚未确认。",
  "power.isCharging": "正在充电",
  "power.notCharging": "未充电",
  "power.minutesUnit": " 分钟",
  "power.wirelessPowerSavingDescription": "无线状态下闲置达到此时间后进入睡眠。",
  "power.lowPowerModeDescription": "无线状态下电池低于此百分比后进入低功耗模式。",
  "power.wirelessPowerSavingProbeFailed": "此设备的闲置时间报告尚未成功。",
  "power.lowPowerModeProbeFailed": "此设备的低电量阈值报告尚未成功。",
  "advanced.dynamicSensitivity": "动态灵敏度",
  "advanced.dynamicSensitivityDescription": "选择鼠标速度到输出倍率的加速曲线。",
  "advanced.dynamicSensitivity.classic": "经典",
  "advanced.dynamicSensitivity.natural": "自然",
  "advanced.dynamicSensitivity.jump": "跳跃",
  "advanced.dynamicSensitivity.custom": "自定义",
  "advanced.dynamicSensitivity.template": "选择模板",
  "advanced.dynamicSensitivity.template.none": "无",
  "advanced.rotation": "旋转",
  "advanced.rotationDescription": "按握持角度旋转鼠标输入，让水平移动保持直线。",
  "advanced.rotationDetails": "详情请访问",
  "advanced.rotationToolLink": "此工具",
  "advanced.rotationAngle": "旋转角度",
  "advanced.probeFailed": "此设备的高级传感器报告尚未成功。",
  "capability.title": "能力矩阵",
  "capability.battery": "电池",
  "capability.charging": "充电",
  "capability.dpi": "DPI",
  "capability.pollingRate": "轮询率",
  "capability.lighting": "灯光",
  "capability.buttons": "按键",
  "capability.state.available": "可用",
  "capability.state.unsupported": "不支持",
  "capability.state.probeFailed": "探测失败",
  "capability.state.notImplemented": "未实现",
  "capability.state.browserLimited": "浏览器受限",
  "capability.detail.battery.unsupported": "此设备尚未确认支持读取电池。",
  "capability.detail.charging.unsupported": "此设备尚未确认支持读取充电状态。",
  "capability.detail.dpi.notImplemented": "实现设备安全的适配器后，将启用 DPI 控制。",
  "capability.detail.pollingRate.notImplemented": "实现设备安全的适配器后，将启用轮询率控制。",
  "capability.detail.lighting.notImplemented": "添加灯光适配器后，将启用灯光控制。",
  "capability.detail.buttons.browserLimited": "没有固件级报告时，WebHID 无法可靠地进行系统级鼠标输入重映射。",
  "capability.detail.battery.available": "电池可读取。上次值：{percent}%。",
  "capability.detail.charging.availableCharging": "设备报告正在充电。",
  "capability.detail.charging.availableNotCharging": "设备报告未在充电。",
  "capability.detail.dpi.available": "DPI 可读取。上次值：{x}:{y}。",
  "capability.detail.pollingRate.available": "轮询率可读取。上次值：{rate} Hz。",
  "debug.title": "调试日志（{count}）",
  "debug.noTraffic": "还没有 HID 通信记录。",
  "debug.report": "报告",
  "debug.request": "请求",
  "debug.send": "发送",
  "debug.descriptor": "描述符",
  "debug.response": "响应",
  "debug.noResponse": "无响应",
  "debug.open": "打开调试日志",
  "debug.clear": "清除历史记录",
  "debug.copy": "拷贝所有日志",
  "debug.copySuccess": "调试日志已复制。",
  "debug.copyFailed": "调试日志复制失败。",
  "debug.close": "关闭",
  "error.inputOnlyInterface":
    "当前选择的 HID 接口只暴露输入报告。请在浏览器设备选择器中选择另一个雷蛇接口，或卸载可能占用控制接口的 Razer Synapse/其他原生软件。Windows 上可能需要卸载并重启。",
  "error.allActiveProbesFailed":
    "所有主动探测都失败了。如果这是在固件更新、睡眠或重连后发生的，请拔下并重新插入雷蛇接收器，然后清除浏览器 HID 权限并重新连接。"
};

export const locales = {
  en: {
    label: "English",
    nativeName: "English",
    messages: enMessages
  },
  "zh-CN": {
    label: "Chinese (Simplified)",
    nativeName: "简体中文",
    messages: zhCNMessages
  }
} satisfies Record<string, LocaleDefinition>;

export type SupportedLanguage = keyof typeof locales;

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";
const STORAGE_KEY = "snap-razer-language";

interface I18nContextValue {
  language: SupportedLanguage;
  availableLanguages: Array<{ code: SupportedLanguage; label: string; nativeName: string }>;
  setLanguage: (language: SupportedLanguage) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
}

const availableLanguages = (Object.keys(locales) as SupportedLanguage[]).map((code) => ({
  code,
  label: locales[code].label,
  nativeName: locales[code].nativeName
}));

const I18nContext = createContext<I18nContextValue>({
  language: DEFAULT_LANGUAGE,
  availableLanguages,
  setLanguage: () => undefined,
  t: (key, params) => t(key, params)
});

export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return language in locales;
}

export function resolveLanguage(language?: string | null): SupportedLanguage {
  if (!language) {
    return DEFAULT_LANGUAGE;
  }

  if (isSupportedLanguage(language)) {
    return language;
  }

  const languagePrefix = language.toLowerCase().split("-")[0];
  const matchedLanguage = availableLanguages.find((item) => item.code.toLowerCase().split("-")[0] === languagePrefix);
  return matchedLanguage?.code ?? DEFAULT_LANGUAGE;
}

export function hasMessage(key: string): key is MessageKey {
  return key in enMessages;
}

export function t(key: MessageKey, params?: MessageParams, language: SupportedLanguage = DEFAULT_LANGUAGE): string {
  const message = locales[language]?.messages[key] ?? locales[DEFAULT_LANGUAGE].messages[key] ?? key;
  return formatMessage(message, params);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_LANGUAGE;
    }

    const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
    return resolveLanguage(savedLanguage ?? window.navigator.language);
  });

  const setLanguage = useCallback((nextLanguage: SupportedLanguage) => {
    setLanguageState(nextLanguage);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, language);
    }

    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      availableLanguages,
      setLanguage,
      t: (key, params) => t(key, params, language)
    }),
    [language, setLanguage]
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

function formatMessage(message: string, params?: MessageParams): string {
  if (!params) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? placeholder : String(value);
  });
}
