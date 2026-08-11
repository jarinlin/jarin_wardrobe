# MiSans 字体

本目录字体来自小米开源 [MiSans](https://hyperos.mi.com/font/zh/)，按许可协议在软件中注明使用了 MiSans。

- `MiSans-Regular.woff` / `MiSans-Medium.woff`：基于官方 TTF，裁剪为常用汉字（GB2312 一级约 3755 字）+ 拉丁/标点，以控制小程序包体积。
- 完整字库请从官网下载：https://hyperos.mi.com/font-download/MiSans.zip
- 加载方式：`src/assets/js/fonts.js` → `wx.loadFontFace`（见 `app.js`）
