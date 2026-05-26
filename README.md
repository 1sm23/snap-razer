# Snap Razer

Chinese version: [README.zh-CN.md](./README.zh-CN.md)

Start with the official Razer web driver:

[http://synapse.razer.com/](http://synapse.razer.com/)

If your mouse is supported there, that is the first place to try. The catch is simple: its device coverage is still pretty small, and a lot of mice do not show up at all. This project came out of that gap.

Snap Razer is a WebHID console for Razer devices. It tries to discover what the browser can actually reach, read the safe bits first, write the confirmed bits next, and label everything else honestly.

## What it does

- Connects to Razer devices
- Probes battery, charging, DPI, and polling rate
- Shows raw HID logs
- Marks unsupported, browser-limited, and probe-failed capabilities clearly

## TODO

- [ ] Confirm read/write behavior across more Razer mice and receivers
- [ ] Add Razer keyboard discovery and basic capability probing
- [ ] Improve HID interface selection when the browser exposes duplicate-looking devices
- [ ] Expand protocol coverage for DPI stages, polling rate, lighting, power, and button features
- [ ] Add safer write guards before sending feature commands to unknown devices
- [ ] Add profile import/export so confirmed settings can be saved locally
- [ ] Build a device compatibility table from real test reports
- [ ] Improve diagnostics for Synapse conflicts, stale permissions, and input-only interfaces

## Why `probe failed` happens

`probe failed` does not automatically mean the mouse is incompatible.

More often it means one of these:

- The browser picked an input-only HID interface, so it cannot send control commands
- Razer Synapse or another app is already using the real control interface
- The receiver or browser still has stale HID state after a firmware update, sleep, or reconnect
- The device does expose a WebHID-visible path, but this project has not yet confirmed that specific feature protocol

So the status usually means "this capability path was not established yet," not "the whole mouse is broken."

If every active probe fails at once, unplug and replug the Razer receiver, then clear this site's HID permission in the browser and connect again. Replugging forces Windows and the browser to enumerate the device again, which can clear stale report descriptors or cached interface choices after firmware updates.

On Windows, closing Razer Synapse from the tray or stopping services may still leave drivers or background services that retake the HID control interface. If WebHID still cannot reach the control interface, uninstall Razer Synapse / Razer Central / Razer App Engine, restart Windows, unplug and replug the receiver, then clear this site's HID permission and connect again. Reinstall the native Razer software only after you are done using this WebHID page.

## Q&A

### Why do I see two same-named devices in the browser site info?

That usually means one physical mouse exposes multiple HID interfaces. In Chrome's site info / site permissions, the HID device list may therefore specifically show 2 devices.

For example, a Razer Viper V3 Pro SE can appear through more than one HID path, such as a normal mouse input interface and another collection on the same USB device. Chrome lists each matching HID path as a separate entry, but the picker only shows the product name, so they can look duplicated.

WebHID filters can match fields like `vendorId`, `productId`, `usagePage`, and `usage`. They cannot target Windows-specific interface identifiers such as `MI_00` or `MI_01&COL02`, so two identical-looking entries may be the narrowest browser-visible result. This is not two mice and not a duplicate React render.
## Good fit

- You want to inspect what a Razer device exposes in the browser
- You do not want to depend on a single vendor tool
- You are fine with "usable first, complete later"

## Built-in limits

- This is not a native driver
- It is not a system-wide replacement for Synapse
- Not every Razer mouse can expose every feature through WebHID
- System-wide remapping, macros, and deep firmware control are usually out of reach in a browser

## Run locally

```bash
npm install
npm run dev
```

Then open the local address in a Chromium-based browser.

## Practical note

If the official web driver already supports your device, use that first.
If it does not cover enough ground, this project is the other path.

Snap Razer does not promise identical behavior to Synapse or other Razer tools. It is more like a browser-based lab bench for device capability discovery.
