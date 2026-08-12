# 微信云托管部署骨架（未真部署）

## 目标
将 `backend/` 以容器形式跑在微信云托管，小程序 `RUN_MODE=cloud` 走 `wx.cloud.callContainer`。

## 已有资产
- `backend/` 为**独立 Git 仓库**（云托管拉取此仓；主仓 `.gitignore` 已忽略 `backend/`）
- `backend/Dockerfile`：多阶段构建，监听 `PORT`（镜像默认 80）
- 小程序 `src/assets/js/config.js`：`CLOUD_ENV` / `CLOUD_SERVICE`（服务名如 `wardrobe-backend`）
- `api.js`：cloud 模式下已封装 `wx.cloud.callContainer`

## 后端独立仓库推送（首次）
```bash
cd backend
# 在 GitHub/Gitee 建空仓库后：
git remote add origin <你的后端仓库地址>
git push -u origin main
```
云托管「代码包 / Git」选该远程仓库与 Dockerfile 所在根目录即可。

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
- 服务端口需与容器一致（当前 Dockerfile 默认 `PORT=80`）

## 部署失败：Back-off / initenv.sh
镜像构建成功但 Pod 反复重启时，多半是**进程启动后立刻退出**（常见：数据库连不上）。
1. 打开云托管「日志」看是否有 `[db] 初始化失败`
2. 核对环境变量全为字符串：`DB_HOST` / `DB_PORT` / `DB_PASSWORD` 等
3. Supabase 需允许云托管出口访问（或临时放宽网络限制）
4. `initenv.sh` 报错通常是容器已退出后的连带现象，先修主进程退出原因

## Supabase：`network is unreachable`（IPv6）
微信云托管出口通常**只有 IPv4**。若日志出现连到 `[xxxx:xxxx:...]:5432` 且 `network is unreachable`，说明解析到了 IPv6。

后端已强制 `tcp4`。若仍失败（无 IPv4 地址），请改用 **Supabase Connection Pooler**（免费项目直连常仅 IPv6）：

1. Supabase Dashboard → 项目页顶部 **Connect** → **Session pooler**（以页面复制为准，不要手猜 `aws-0`）
2. 本项目实测可用（ap-northeast-2）：
   - `DB_HOST` = `aws-1-ap-northeast-2.pooler.supabase.com`（**不是** `aws-0-...`，tenant 会 ENOTFOUND）
   - `DB_PORT` = `"5432"`（Session；Transaction 用 `"6543"`）
   - `DB_USER` = `postgres.auxtanmkhzfwelytbslw`（必须带 project ref；只写 `postgres` 会报 no tenant identifier）
   - `DB_PASSWORD` / `DB_NAME` 不变（如 `jarin_wardrobe`）
3. 常见误判：Host 用 `db.xxx.supabase.co` → 仅 IPv6；Host 用错 `aws-0` → tenant not found；User 未带 ref → no tenant identifier
4. 或购买 **IPv4 add-on** 后继续用直连主机

## 隐私与定位
- 小程序后台配置《用户隐私保护指引》，声明「模糊位置」用途
- `app.json` 已含 `requiredPrivateInfos: getFuzzyLocation` 与 `scope.userFuzzyLocation` 说明
