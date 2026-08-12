# 微信云托管部署骨架（未真部署）

## 目标
将 `backend/` 以容器形式跑在微信云托管，小程序 `RUN_MODE=cloud` 走 `wx.cloud.callContainer`。

## 已有资产
- `backend/Dockerfile`：多阶段构建，监听 `PORT`（镜像默认 80）
- 小程序 `src/assets/js/config.js`：`CLOUD_ENV` / `CLOUD_SERVICE`
- `api.js`：cloud 模式下已封装 `wx.cloud.callContainer`

## 建议步骤（控制台操作）
1. 开通微信云托管，创建环境，记下环境 ID → 填入 `CLOUD_ENV`
2. 创建服务（如 `jarin-api`）→ 填入 `CLOUD_SERVICE`
3. 代码包上传 `backend/`，使用仓库内 Dockerfile 构建
4. 配置环境变量（与 `.env.example` 对齐）：
   - `DB_*` / `JWT_SECRET` / `PUBLIC_BASE_URL`
   - `WX_APPID` / `WX_SECRET`（云托管也可依赖网关注入的 `x-wx-openid`）
   - `ALLOW_MOCK_LOGIN=false`（正式环境）
   - `COS_*` / `AI_*` / `AMAP_KEY`
5. 数据库：使用云托管 PostgreSQL 或自建；首次启动会 auto-migrate
6. 小程序：`RUN_MODE='cloud'`，基础库 ≥ 2.23.0；云托管免备案域名

## 健康检查
- 路径：`GET /health`
- 成功响应含 `"ok": true`

## 隐私与定位
- 小程序后台配置《用户隐私保护指引》，声明「模糊位置」用途
- `app.json` 已含 `requiredPrivateInfos: getFuzzyLocation` 与 `scope.userFuzzyLocation` 说明
