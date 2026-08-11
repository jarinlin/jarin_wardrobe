# Jarin衣柜 — 项目进度

## 当前阶段
MVP 可本地预览（小程序 Mock 模式）

## 已完成
- [x] 产品规划文档确认（用户提供）
- [x] 项目目录与基础配置
- [x] 小程序端页面（首页 / 衣柜 / 穿搭 / 我的 / 登录 / 衣物编辑详情 / 分类 / 穿搭编辑详情）
- [x] 前端静态资源结构化：`client/src/assets/{css,js,icons}`
- [x] 本地 Mock 数据层（`USE_MOCK=true`，无需后端即可跑通闭环）
- [x] 后端 API 骨架（Express：登录 / 衣物 / 分类 / 穿搭 / 统计 / 标签）
- [x] 数据库改为 PostgreSQL（`pg` 驱动，命名参数适配）
- [x] 启动时自动建库建表（`src/initDb.js`）
- [x] 添加根目录 `.gitignore`（排除 node_modules、.env、小程序私有配置等）
- [ ] 对接真实微信 AppID + 关闭 Mock

## 技术选型（MVP）
| 层级 | 方案 |
|------|------|
| 前端 | 微信小程序原生 |
| 后端 | Node.js + Express |
| 数据库 | PostgreSQL（启动自动建库/建表） |
| 静态资源 | `client/src/assets`（css/js/icons） |
| 图片存储 | MVP 本地临时路径 / URL，后续接 OSS |

## 目录结构
```
wardrobe/
├── Projectprogress.md
├── client/                 # 微信小程序
│   ├── app.js / app.json / app.wxss
│   ├── pages/              # 业务页面
│   └── src/assets/         # css / js / icons
└── server/                 # Node API
    ├── package.json
    ├── .env.example
    └── src/
```

## MVP 功能状态
| 功能 | 状态 |
|------|------|
| 用户登录 | ✅ Mock / API 已就绪 |
| 添加衣物（拍照） | ✅ |
| 查看衣柜（网格+分类） | ✅ |
| 分类管理 | ✅ |
| 删除/修改衣物 | ✅ |
| 今日穿搭记录 | ✅ |
| 衣物统计（基础） | ✅ 我的页展示 |
| AI / 天气推荐 | ⏸ 二期 |

## 本地运行
1. 用微信开发者工具打开 `client/` 目录
2. 当前 `client/src/assets/js/config.js` 中 `USE_MOCK = true`，可直接体验
3. 接真实后端：复制 `server/.env.example` → `.env`（确保 PG 账号有建库权限），`npm install && npm start` 会自动建库建表；再将小程序 `USE_MOCK` 改为 `false`

## 暂缓（二期）
- AI 识别衣物
- 智能推荐 / 天气穿搭
- 完整统计看板
- Redis / OSS
- 数据备份

## 更新记录
| 日期 | 内容 |
|------|------|
| 2026-08-11 | 启动项目，搭建小程序 + Express MVP，Mock 可跑通核心闭环 |
| 2026-08-11 | 数据库由 MySQL 切换为 PostgreSQL，后端改用 `pg` |
| 2026-08-11 | 服务启动时自动创建数据库与表结构 |
| 2026-08-11 | 添加 `.gitignore` 提交排除规则 |
