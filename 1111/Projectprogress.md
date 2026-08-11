# Jarin衣柜 — 项目进度

## 当前阶段
小程序 local 联调 + **Go 后端已跑通**；UI 为克制多巴胺 + MiSans

## 已完成
- [x] 小程序 MVP（衣柜 / 穿搭 / 登录 / 分类等）
- [x] UI：克制多巴胺配色；去掉 DOPAMINE 徽章与花哨 blob
- [x] 字体：MiSans Regular/Medium（`src/assets/fonts` + `wx.loadFontFace`）
- [x] 后端改为 **Go**（`1111/backend`，Gin + pgx + JWT）
- [x] 本地 `/health`、`/api/auth/login` 冒烟通过
- [x] 旧 Node 目录已重命名为 `_deprecated_server_node`（可删）
- [x] `backend/start.bat` 一键启动
- [ ] 微信云托管部署（需你提供云环境 ID）
- [ ] 图片上传到对象存储（当前多为本地临时路径）

## 技术栈
| 层 | 方案 |
|----|------|
| 小程序 | 原生，`RUN_MODE=local` |
| 后端 | Go → 日后云托管容器 |
| 数据库 | PostgreSQL（`.env`） |
| 字体 | MiSans |

## 本地怎么跑
1. 双击或执行：`1111\backend\start.bat`
2. 开发者工具打开 `k:\desk\wardrobe`，勾选「不校验合法域名」
3. 编译 → 登录 → 测衣柜/穿搭

```bat
cd k:\desk\wardrobe\1111\backend
go run .\cmd\server
```

## 云托管（下一步）
1. 控制台创建服务（建议名 `jarin-api`）
2. 部署目录：`1111/backend`（含 Dockerfile，端口 80）
3. 配置与 `.env` 相同的环境变量
4. 小程序 `config.js`：`RUN_MODE='cloud'`，填 `CLOUD_ENV` / `CLOUD_SERVICE`

## 更新记录
| 日期 | 内容 |
|------|------|
| 2026-08-11 | MVP / UI / MiSans / local |
| 2026-08-11 | 后端 Go 化；Node 废弃；登录冒烟通过 |
| 2026-08-11 | 修复登录页头像椭圆、昵称输入裁切 |
