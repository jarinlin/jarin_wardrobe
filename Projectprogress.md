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
- [ ] 微信云托管部署

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
