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
   - `TZ=Asia/Shanghai`（容器默认 UTC，不设则日志/部分时间会显示成早上的 UTC）
   - `DB_*` / `JWT_SECRET` / `PUBLIC_BASE_URL`
   - `WX_APPID` / `WX_SECRET`（云托管也可依赖网关注入的 `x-wx-openid`）
   - `ALLOW_MOCK_LOGIN=false`（正式环境）
   - `STORAGE_DRIVER=cos|r2`，并按后端配置 `COS_*` 或 `R2_*`；R2 的 Access Key ID / Secret Access Key 填齐后再切为 `r2`
   - `AI_*` / `AMAP_KEY`
   - `REDIS_HOST` / `REDIS_PORT` / `REDIS_USER` / `REDIS_PASSWORD` / `REDIS_TLS`（Upstash 填 `"true"`）/ 可选 `REDIS_DB`
5. 数据库：使用云托管 PostgreSQL 或自建；首次启动会 auto-migrate
6. 小程序：`src/assets/js/config.js` 设 `RUN_MODE='cloud'`，填写 `CLOUD_ENV` / `CLOUD_SERVICE`（本项目：`prod-d5grcb82q8a137e9c` / `warerobe-backend`）
7. 基础库 ≥ 2.23.0；API 走 `wx.cloud.callContainer`，**无需**配置 request 合法域名（业务 API）
8. 图片上传：cloud 模式先 `POST /api/upload/sign` 再直传当前对象存储；需在公众平台配置：
   - COS：**request / downloadFile / 图片合法域名**使用桶域名（及 CDN 若使用）
   - R2：加入 `https://5c93c53be15906fca262e84d5717e1fb.r2.cloudflarestorage.com`
9. 开发者工具：重新编译 → 清缓存 → 真机预览/上传体验版；正式发布走「上传 → 提交审核」
10. 图片：接口一律返回当前存储的**预签名 GET**（库内只存 key，桶保持私有）。不要用 `/api/media` 给小程序当图床；小程序需配置所选存储的 downloadFile/图片域名。

## Redis（今日穿搭建议缓存）
- 用途：缓存 `GET /api/suggest/outfit` 的完整业务 data，按用户 + 上海日历日隔离
- Key：`suggest:outfit:{userId}:{YYYY-MM-DD}`（Asia/Shanghai）
- TTL：从现在到**次日 00:00 Asia/Shanghai** 的剩余秒数（不是固定 24h）
- 未配置或连不上 Redis 时**降级为不缓存**，服务仍可出建议，不会 CrashLoop
- Upstash 必须 `REDIS_TLS=true`（控制台 JSON 里值用字符串 `"true"`）
- 云托管环境变量示例（值全部为字符串）：

```json
{
  "REDIS_HOST": "nearby-possum-82824.upstash.io",
  "REDIS_PORT": "6379",
  "REDIS_USER": "default",
  "REDIS_PASSWORD": "<写在控制台，勿提交仓库>",
  "REDIS_TLS": "true",
  "REDIS_DB": "0"
}
```

- 对象存储（在原有 `COS_*` 上追加；值全部为字符串）。切 R2 前先填齐 Key，再把 `STORAGE_DRIVER` 设为 `r2`：

```json
{
  "STORAGE_DRIVER": "r2",
  "R2_ACCOUNT_ID": "5c93c53be15906fca262e84d5717e1fb",
  "R2_ACCESS_KEY_ID": "<写在控制台，勿提交仓库>",
  "R2_SECRET_ACCESS_KEY": "<写在控制台，勿提交仓库>",
  "R2_BUCKET": "jarin",
  "R2_ENDPOINT": "https://5c93c53be15906fca262e84d5717e1fb.r2.cloudflarestorage.com",
  "R2_REGION": "auto",
  "R2_PREFIX": "wardrobe"
}
```

- 首页默认读缓存，不重复调高德/AI；无缓存且无坐标时后端返回 `needLocation`，前端再定位后重试
- 点「刷新」走 `refresh=1` 强制重算并覆盖缓存；无天气的旧缓存在带坐标时会重算
- 排障请在云托管日志搜 `[suggest]` / `[amap]` / `[redis]`：可区分没传坐标、缓存无天气、Key 未配置、HTTP 失败、业务 infocode、解析失败、天气成功

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
