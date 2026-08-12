# Jarin衣柜 — 项目进度

## 当前阶段
已去掉 `1111/` 层级；小程序与 Go 后端均在仓库根目录

## 目录结构
```
wardrobe/                         ← 微信开发者工具打开这里
├── app.js / app.json / app.wxss  ← 小程序入口
├── pages/
├── src/assets/                   ← css / js / fonts / icons
├── backend/                      ← Go 后端（勿打包进小程序）
│   ├── cmd/server/
│   ├── internal/
│   ├── Dockerfile
│   └── start.bat
├── project.config.json
├── Projectprogress.md
└── .gitignore
```

## 已完成
- [x] 小程序 MVP + local 真实接口
- [x] Go 后端（Gin + PostgreSQL）
- [x] 克制多巴胺 UI + MiSans
- [x] 去掉 `1111` 中间目录，扁平化工程
- [x] 腾讯云 COS 图片上传（`POST /api/upload` + 小程序 `upload.js`）
- [x] COS 密钥已配置，上传可用
- [x] 启动自动 migrate（身体档案/饮食/tags_status）
- [x] 衣物异步 AI 打标接线（保存有图自动打标 + 详情展示）
- [x] 模糊定位 + 高德天气代理（`GET /api/weather`，失败可降级）
- [x] AI/规则穿搭建议（`GET /api/suggest/outfit`，首页「今日建议」）
- [x] 标签管理页（聚合衣物 tags，筛选跳转衣柜）
- [x] 设置页（运行模式说明 / 清缓存 / 关于）
- [x] 微信登录：支持 `WX_APPID`/`WX_SECRET`；本地可 `ALLOW_MOCK_LOGIN=true`
- [x] 云托管部署骨架文档（`docs/deploy/weixin-cloud.md`，未真部署）
- [ ] 微信云托管真实上线

## 本地运行
1. `backend\start.bat`（或 `cd backend && go run .\cmd\server`）
2. 开发者工具打开 `k:\desk\wardrobe`（不要再选 1111）
3. 勾选「不校验合法域名」→ 编译

小程序 `src/assets/js/config.js`：`RUN_MODE=local`，`BASE_URL=http://127.0.0.1:3000`

## 更新记录
| 日期 | 内容 |
|------|------|
| 2026-08-11 | MVP / Go 后端 / UI |
| 2026-08-11 | 移除 1111，目录提升到仓库根 |
| 2026-08-11 | 接入腾讯云 COS 上传（衣物/穿搭选图） |
| 2026-08-11 | 登录页说明头像需点选；登录后上传 COS 并 PUT /auth/profile |
| 2026-08-12 | 修复分类管理页：input 占位字压扁、底部添加条布局 |
| 2026-08-12 | 修复 MiSans 路径：改为根绝对路径，避免相对页面解析 500 |
| 2026-08-12 | 「我的」页移除数据备份入口 |
| 2026-08-12 | 产出 AI 衣物识别设计：docs/superpowers/specs/2026-08-12-ai-clothing-recognize-design.md |
| 2026-08-12 | 实现 AI 衣物识别：POST /api/ai/clothing/analyze + 选图自动回填（qwen3.5-plus） |
| 2026-08-12 | 衣物/穿搭硬删并同步删 COS；图片改走 /api/media 签名代理防盗刷 |
| 2026-08-12 | 饮食记录 Phase2：身体档案/BMI/体脂、拍照识食物、餐次与建议 |
| 2026-08-12 | 登录流程：首次授权头像昵称并持久化；再次登录一键复用 |
| 2026-08-12 | 修复把真实昵称「Jarin」误判为占位导致老用户无法一键登录 |
| 2026-08-12 | 登录改为先一键登录；仅 needProfile 新用户再补头像昵称 |
| 2026-08-12 | 登录页接入 Logo：src/assets/icons/logo.png |
| 2026-08-12 | 登录时刷新 users.updated_at |
| 2026-08-12 | start.bat 改为每次重新 go build，避免跑旧二进制 |
| 2026-08-12 | 衣物异步 AI 打标（tags/tags_status），供后续穿搭建议 |
| 2026-08-12 | 启动自动 migrate：补齐 user_body_profiles / diet_logs / clothes.tags_status；接线 Create/Update Enqueue、详情页展示打标状态 |
| 2026-08-12 | 修复再次登录：预填本地昵称/头像；空昵称不再写死「微信用户」覆盖；退出仅清 token；后端忽略占位昵称 |
| 2026-08-12 | **根因修复**：COS 私有桶导致 AI/打标拉图 403；改为预签名 URL；ExtractKey 不再误吃外链；更新衣物/饮食空图不覆盖；Enqueue 同步写 pending；服务已重启 /health 正常 |
| 2026-08-12 | 时区：连接/会话固定 Asia/Shanghai；API 时间输出带 +08:00；进程 Local=上海 |
| 2026-08-12 | 修复表单 input placeholder 被裁切：公共 form-input 定高/去上下 padding，并加 placeholder-class |
| 2026-08-12 | 衣柜分类标签重做：胶囊选中态珊瑚实心，「管理分类」改为文字入口 |
| 2026-08-12 | 衣柜页：去掉重复大标题；分类条改 inline-flex 横向滚动；标签改圆角软底非全圆胶囊 |
| 2026-08-12 | 产出 wx.getFuzzyLocation 审核示意截图：docs/audit-screenshots/ |
| 2026-08-12 | 天气/穿搭建议/标签/设置落地；兼容 AMAP_KEY 与 AMAP_WEB_KEY |
| 2026-08-12 | **天气+穿搭建议+标签/设置**：设计见 docs/superpowers/specs/2026-08-12-weather-outfit-suggest-design.md；后端 amap/suggest；首页今日建议；标签/设置页接通；app.json 声明 getFuzzyLocation；`.env.example` 增加 AMAP_KEY；云托管骨架 docs/deploy/weixin-cloud.md |
| 2026-08-12 | 手动 SQL：本次无新增表/列（复用 clothes.tags / tags_status / tags 表） |
| 2026-08-12 | 修复定位不弹授权：隐私失败仍继续 authorize/getFuzzyLocation；刷新可引导去设置 |

## 配置要点（天气）
1. 高德控制台创建 **Web 服务** Key → 写入 `backend/.env` 的 `AMAP_KEY=` 或 `AMAP_WEB_KEY=`（勿提交仓库）
2. 小程序 `wx.getFuzzyLocation` 接口权限**已审核通过**；`app.json` 已声明 `requiredPrivateInfos` + `scope.userFuzzyLocation`
3. 调用封装：`src/assets/js/location.js`（`type: gcj02`，对齐高德；失败降级不阻断）
4. 用户手动 `go run` 重启后端后生效（启动日志应见 `[amap] 高德天气已启用`）
5. 文档：https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getFuzzyLocation.html
6. 若报 `api scope is not declared in the privacy agreement`：需在公众平台「用户隐私保护指引」中声明「模糊/地理位置」用途并发布生效（接口开通 ≠ 隐私指引已声明）
