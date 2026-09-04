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
- [x] 衣物异步 AI 打标接线（保存有图自动打标，前台不展示进度）
- [x] 模糊定位 + 高德天气代理（`GET /api/weather`，失败可降级）
- [x] AI/规则穿搭建议（`GET /api/suggest/outfit`，首页「今日建议」）
- [x] 标签管理页（聚合衣物 tags，筛选跳转衣柜）
- [x] 设置页（运行模式说明 / 清缓存 / 关于 / 改昵称头像）
- [x] 微信登录：支持 `WX_APPID`/`WX_SECRET`；本地可 `ALLOW_MOCK_LOGIN=true`
- [x] 云托管部署骨架文档（`docs/deploy/weixin-cloud.md`，未真部署）
- [x] AI 增强穿搭建议（规则初筛 + 模型重排润色，失败回退）
- [x] 标签管理页（聚合衣物 tags，筛选跳转衣柜）
- [x] 衣柜数据导出（设置页复制 JSON）
- [x] 首页/饮食智能提醒（当前餐次未记）
- [x] 饮食今日热量（建议日摄入 / 今日摄入 / 还可摄入）
- [x] 衣柜多维筛选（场合/季节 chip）
- [x] 穿搭详情分享（onShareAppMessage + 复制文案）
- [x] Redis 缓存今日穿搭建议（Upstash TLS；失败降级）
- [x] 底栏改为 首页/衣柜/穿搭/饮食；「我的」弱化为首页头像进设置
- [x] 用户触发的 AI 接口按登录用户限流（Redis 优先，失败内存降级）
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
| 2026-08-12 | 首页「记为今日穿搭」预填建议单品与备注；无建议时引导去衣柜添加 |
| 2026-08-12 | 真机调试 80051 超包：忽略 docs/Medium 字体；压缩 logo.png；字体仅打 Regular |
| 2026-08-12 | backend/ 独立 Git 仓库（main）；主仓忽略 backend；云托管文档补充推送说明 |
| 2026-08-12 | 后端配置：无 .env 时明确回退进程环境变量（适配云托管） |
| 2026-08-12 | Dockerfile 构建镜像改为 golang:1.25-alpine，对齐 go.mod |
| 2026-08-12 | 云托管启动：DB 重试连接；远端库跳过自动建库；部署文档补充排障 |
| 2026-08-12 | 云托管连 Supabase：`network is unreachable` 根因 IPv6；后端强制 tcp4；文档补充改用 Pooler |
| 2026-08-12 | 主仓推送 GitHub `851422a`；后端 Gitee 已是 `1a20dc9`（tcp4） |
| 2026-08-12 | 云托管仍失败：`tcp4` + 无 A 记录；须改 Supabase Session Pooler（非代码能修） |
| 2026-08-12 | Pooler 实测：`aws-1-ap-northeast-2.pooler.supabase.com` + `DB_USER=postgres.<ref>` 可通；`aws-0` 会 ENOTFOUND |
| 2026-08-12 | 小程序切 `RUN_MODE=cloud`；上传改 COS 预签名直传；后端新增 `POST /api/upload/sign` |
| 2026-08-12 | 隐私指引用途文案：位置/选图/剪切板（复制分享与导出）；无客户端第三方 SDK |
| 2026-08-12 | 云托管图片不显示：列表曾返回 `127.0.0.1/api/media`；无公网基址时改回退 COS/CDN 直链 |
| 2026-08-13 | 私有桶未签名直链 403：无公网基址时改为 COS 预签名 GET（衣物/穿搭/饮食/头像/上传） |
| 2026-08-13 | 头像仍返回 127.0.0.1：库内旧代理链不再当外链透传；本机/tmp 地址不入库；前端过滤缓存 |
| 2026-08-13 | 文件地址策略统一：前端只拿 COS 预签名 GET；去掉 PUBLIC_BASE_URL / `/api/media` 分支 |
| 2026-08-13 | 打标对用户不可见：去掉打标中/已打标筛选、进度卡片、首页提醒、详情状态与重打按钮；后台仍静默打标 |
| 2026-08-12 | 身体档案改为选择出生日期并自动计算年龄；库表增加 birth_date |
| 2026-08-12 | 新建饮食记录按时段预选餐次：7–9 早餐 / 11–13 午餐 / 18–21 晚餐 / 其余其他 |
| 2026-08-12 | 产品能力加强：AI 穿搭精炼、打标中心、导出备份、智能提醒；设计见 docs/superpowers/specs/2026-08-12-product-capability-boost-design.md |
| 2026-08-12 | 饮食编辑页：饮食建议默认隐藏；上传图片或已有 advice/imageUrl 时再显示 |
| 2026-08-12 | **一餐多道菜**：`diet_logs.items` JSONB；AI 识别返回 items[]；编辑页列表增删改+总热量；列表展示「共 N 道」；旧单字段兼容为 1 条；`showAdvice` 逻辑保留 |
| 2026-08-12 | **演示能力补齐**：饮食周汇总、衣柜 tagsStatus/场合季节筛选、设置改资料、穿搭分享；设计见 docs/superpowers/specs/2026-08-12-demo-polish-design.md；`ai/client.go` 无死代码；`go build ./cmd/server` 通过；手动 SQL：无 |
| 2026-08-12 | **修复 WXML 编译错误**：`tags` 去掉 `{{... > 0}}`；`diet` 复杂拼接改 `metricsTip`；`outfit-detail` 去掉 `|| []` 并 `wx:for-item`；`wardrobe`/`index` 嵌套三元改 JS 字段 |
| 2026-08-12 | **修复饮食编辑选图无反应**：根因是 `onChooseImage` 空 `catch` + `util.chooseImage` 失败无提示；现失败明确 toast（隐私/权限/取消区分）、`scope.camera` 说明、识别遮罩全覆盖拦截误触；`requiredPrivateInfos` 无需 `chooseMedia`（仅地理位置类） |
| 2026-08-12 | **隐私指引审核通过后仍失败排查**：代码侧选图前主动 `requirePrivacyAuthorize`；errno 112/103/104 与 cancel 区分（隐私拒绝不再静默）；饮食页 `onLoad` 预拉隐私；定位未声明位置时提示更明确。最大概率仍是公众平台「选中的照片或视频 / 位置信息」未勾选或指引未**发布生效**（审核通过 ≠ 已对用户生效） |
| 2026-08-13 | **Redis 缓存今日建议** + 天气链路日志：key=`suggest:outfit:{uid}:{上海日期}`，TTL 到次日 0 点；首页先读缓存，无缓存再定位；`refresh=1` 强制重算。日志前缀 `[suggest]`/`[amap]`/`[redis]` 可区分没传坐标 / 缓存无天气 / Key 未配 / HTTP / infocode / 解析失败 / 成功。`.env` 与云托管需配 `REDIS_*`（example 仅占位）。手动 SQL：无 |
| 2026-08-13 | 天气一直失败：云托管 GET 日志只有 `refresh=1` 无 lat/lng；坐标改写 URL query；无定位不再空刷；记住上次模糊坐标 |
| 2026-08-13 | 模拟器 getFuzzyLocation 常失败：devtools 降级广州坐标联调；真机仍走真实定位 |
| 2026-08-13 | 身体档案进入闪一下错样式：性别/表单布局提到全局 css；数据回来再渲染，避免默认态和指标卡跳动 |
| 2026-08-13 | 设置页去掉运行信息（mock/local/云托管）；关于只保留产品介绍 |
| 2026-08-13 | 饮食「近日」对比改为日均 vs 建议日摄入，不再用建议周摄入 |
| 2026-08-13 | 饮食中间卡改为今日热量：建议日摄入 / 今日摄入 / 还可摄入；记一餐可不拍照，手填菜名热量即可保存 |
| 2026-08-13 | 四 Tab 落地：底栏 首页/衣柜/穿搭/饮食（第一项仍叫首页）；饮食升为 Tab；设置从首页头像进入；衣柜加分类/标签入口 |
| 2026-08-13 | 未登录进入任意 Tab / 启动小程序会直接进登录页，不必再点右上角头像；退出后同样回到登录 |
| 2026-08-13 | 手填饮食：热量框内显示「大卡」+「估」按钮；按菜名/分量 AI 估算大卡（`POST /api/ai/food/estimate`） |
| 2026-08-13 | 未填身高体重不能用饮食：饮食 Tab / 记一餐 / 首页入口会引导去身体档案 |
| 2026-08-13 | 穿搭广场/人气榜设计：穿搭 Tab 分「我的|广场」；发布时自选照片/文案/单品；点赞计热门。见 docs/superpowers/specs/2026-08-13-ootd-rank-design.md |
| 2026-08-14 | 对象存储开关已统一为 `STORAGE_DRIVER=cos|r2`；兼容读取 `STORAGE_PROVIDER`，任一设为 `r2` 即启用 R2；`.env` 保持 `cos`，R2 Access Key ID / Secret Access Key 填齐后再切换。 |
| 2026-08-14 | 本地 `.env` 已切 `STORAGE_DRIVER=r2` 并去掉重复空 Key；云托管文档补上 R2 环境变量 JSON，原有 `COS_*` 保留。 |
| 2026-08-14 | 首页今日建议空衣柜文案改为「衣柜暂无可匹配衣物」，去掉「等待 AI 打标」等表述。 |
| 2026-08-14 | 上传接口按用途限制类型与大小：照片 jpg/png/webp、2KB–8MB；头像 1KB–2MB。`/api/upload` 校验文件头，`/api/upload/sign` 校验声明类型并可带 size。 |
| 2026-08-14 | 照片上限改为 10MB（避开 callContainer 过大包）；超过 5MB 时小程序先压，本机 `/api/upload` 后端再压成 JPEG。格式为 jpg/png/webp/bmp，HEIC 明确拒绝。 |
| 2026-08-14 | 设置页个人资料：微信 button 默认撑满导致头像旁大块灰底，已锁死头像尺寸并改为左头像右昵称。 |
| 2026-08-17 | 饮食记录支持最多 9 张图一次识别；建议改为只读 Tips，拍照回填后生成一次，可手动重新生成，不再入库、不可手改。 |
| 2026-08-17 | 饮食页去掉「可拍照识别 / 手填热量 / 对照档案」这类说明文案。 |
| 2026-08-17 | 首页切换闪一下穿搭 tips：建议接口曾把同一段话写入提醒条，随后被饮食提醒覆盖；已不再往提醒条插入 weather-tip。 |
| 2026-08-17 | 饮食菜品分量旁增加「估」：按菜名给出常见份量（含快餐标准单位），并回填对应热量。 |
| 2026-08-17 | 分量输入框占位改为「1个」，避免和「估」挤在一起。 |
| 2026-08-17 | 饮食建议空态去掉「不会写入记录」。 |
| 2026-08-17 | 记录饮食时按图识别并绑定菜品；删除某张照片会同步去掉该图识别出的菜，手填菜保留。 |
| 2026-08-17 | 删掉最后一张饮食图会清空建议；多图删一张则后台静默按剩余菜品重新生成建议。 |
| 2026-08-17 | 首页穿搭建议不再对读缓存限流；仅模型润色占额度，并放宽到 20 次/分钟、80 次/小时，超限回退规则不 429。 |
| 2026-08-17 | 饮食建议重新入库：保存写入 `diet_logs.advice`，翻旧记录回显当时的提示，不再被空态盖住。 |
| 2026-09-04 | 饮食从单一热量扩展为核心 7 项：热量、蛋白质、碳水、脂肪、总糖、钠、膳食纤维。识图/估算/档案每日目标/日建议提示词按既有优化风格扩写；旧记录缺宏量显示为暂无，不误判超标。 |
| 2026-09-04 | 体脂并入档案营养建议的同一次 AI 生成，结合年龄、性别、BMI 与活动量估算；公式值负责限制异常偏离并在 AI 不可用时兜底，前端改为展示估算区间。 |

## 配置要点（天气 / 隐私）
1. 高德控制台创建 **Web 服务** Key → 写入 `backend/.env` 的 `AMAP_KEY=` 或 `AMAP_WEB_KEY=`（勿提交仓库）
2. 小程序 `wx.getFuzzyLocation` 接口权限**已审核通过**；`app.json` 已声明 `requiredPrivateInfos` + `scope.userFuzzyLocation`
3. 调用封装：`src/assets/js/location.js`（`type: gcj02`，对齐高德；失败降级不阻断）
4. 用户手动 `go run` 重启后端后生效（启动日志应见 `[amap] 高德天气已启用`；Redis 见 `[redis] 已连接`）
5. 文档：https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getFuzzyLocation.html
6. 若报 `api scope is not declared in the privacy agreement`：需在公众平台「用户隐私保护指引」中声明对应类型并**发布生效**（接口开通 / 审核通过 ≠ 已对用户生效）
7. 饮食选图需勾选并发布：**选中的照片或视频**（建议同时勾选摄像头相关说明）；天气需勾选：**位置信息**（模糊地理位置）
8. 开发者工具：清缓存授权数据 → 重新编译 → 基础库 ≥ 2.32.3（项目现 3.17.0）→ 优先真机；隐私变更后需删小程序重进
