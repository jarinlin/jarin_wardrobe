# 天气定位 + AI 穿搭建议 + 标签/设置

日期：2026-08-12

## 目标
用微信模糊定位 + 高德天气支撑首页「今日建议」；补齐标签管理与轻量设置页；云托管仅骨架文档。

## 方案（选定）
**后端代理高德 + 规则穿搭打分（可降级）**
- 小程序 `wx.getFuzzyLocation`（gcj02）→ 后端 `GET /api/weather?lat=&lng=` 反查城市并拉实况。
- `GET /api/suggest/outfit?lat=&lng=`：天气失败不阻断；按温度/天气关键词对 `clothes.tags` 打分，按分类去重取 3–6 件。
- 标签页：聚合衣物已出现 tags，点击带 `tag` 跳转衣柜筛选。
- 设置页：运行模式说明、清缓存、关于；不接复杂偏好。

## 接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/weather?lat=&lng=` | 温度、天气现象、城市、adcode |
| GET | `/api/suggest/outfit?lat=&lng=` | items + reason/tips + weather |
| GET | `/api/tags` | `{ fromClothes:[{name,count}], list:[] }` |

## 配置
- `AMAP_KEY`（backend/.env，勿入库）
- 小程序 `requiredPrivateInfos: getFuzzyLocation` + `scope.userFuzzyLocation` 说明
- 登录：已有 `WX_APPID`/`WX_SECRET`/`ALLOW_MOCK_LOGIN`

## 不做
改 SQL 迁移文件、真部署云托管、高精度定位、提交真实 Key。
