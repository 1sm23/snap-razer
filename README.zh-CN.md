# Snap Razer

English version: [README.md](./README.md)

先看官方的 Razer Web 驱动：

[https://synapse.razer.com/](https://synapse.razer.com/)

如果你的鼠标刚好被它支持，那它应该是第一选择。问题也很现实：它支持的设备还是偏少，很多鼠标不在支持列表里。这个项目就是从这个缺口里长出来的。

Snap Razer 是一个基于 WebHID 的 Razer 设备控制台，目标是先摸清浏览器到底能碰到什么，再把能确认的功能做出来，不能确认的就老老实实标出来。

## 它能做什么

- 连接 Razer 设备
- 探测电池、充电、DPI、轮询率
- 显示原始 HID 日志
- 明确标出不支持、浏览器受限、探测失败的能力

## TODO

- [ ] 在更多 Razer 鼠标和接收器上确认读写行为
- [ ] 增加雷蛇键盘发现和基础能力探测支持
- [ ] 扩展 DPI 档位、轮询率、灯光、电源、按键等功能协议覆盖
- [ ] 给未知设备发送功能命令前增加更安全的写入保护
- [ ] 增加配置导入/导出，让已确认的设置可以本地保存
- [ ] 基于真实测试反馈整理设备兼容性表
- [ ] 改进权限缓存、旧 HID 状态、input-only 接口等问题的诊断提示

## 为什么会出现 `probe failed`

`probe failed` 不等于“这台鼠标不兼容”。

更常见的是：

- 浏览器选到了只有 input report 的接口，不能往里发控制命令
- 固件更新、休眠唤醒或重新连接之后，接收器/浏览器还留着旧的 HID 状态
- 设备确实暴露了 WebHID 可见的路径，但这个项目还没确认到对应功能协议

所以这个状态更像是“这条能力链路暂时没打通”，不是“整只鼠标坏了”。

如果所有主动探测同时失败，先拔插 Razer 接收器，再清掉浏览器里这个站点的 HID 设备权限，然后重新连接。拔插会强制系统和浏览器重新枚举设备，能清掉固件更新后残留的 report 描述符或旧接口选择。

## 适合什么场景

- 你想在浏览器里看看 Razer 设备到底暴露了什么
- 你不想被单一厂商工具绑死
- 你接受“可用优先，完整性后补”

## 天然限制

- 这不是原生驱动
- 不是系统级替代 Synapse 的方案
- 不是所有 Razer 鼠标都能通过 WebHID 暴露全部功能
- 系统级重映射、宏、深度固件控制，浏览器里通常做不到

## 本地运行

```bash
npm install
npm run dev
```

然后用 Chromium 系浏览器打开本地地址。

## 致谢

- [Razer Synapse](https://synapse.razer.com/)
- [OpenRazer](https://openrazer.github.io/)
- [uk0/web_driver_mouse](https://github.com/uk0/web_driver_mouse)
- [robatwilliams/awesome-webhid](https://github.com/robatwilliams/awesome-webhid)

## 现实一点说

如果官方 Web 驱动已经支持你的设备，优先用它。
如果它覆盖得不够，这里就是另一条路。

Snap Razer 不保证和 Synapse 或其他 Razer 工具的行为完全一致。它更像是一个浏览器里的设备能力实验台。
