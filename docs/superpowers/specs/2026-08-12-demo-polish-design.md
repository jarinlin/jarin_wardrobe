# 演示能力补齐设计（短）

日期：2026-08-12

## 目标
补齐可演示项：饮食周汇总、衣柜多维筛选、设置改资料、穿搭分享；顺带确认 AI client 无死代码。

## 方案
1. **饮食周汇总**：`GET /api/diet/week`（须注册在 `/diet/:id` 前）聚合近 7 日总热量、有记录天数；前端结合身体档案 `suggestKcal` 展示对比条。
2. **衣柜筛选**：列表支持 `tagsStatus`；前端增加打标状态 chip + 从已有 tags 聚合的场合/季节关键词 chip，与分类/标签共存。
3. **设置资料**：复用 `chooseAvatar` + COS `upload` + `PUT /api/auth/profile`。
4. **穿搭分享**：详情页开启 `onShareAppMessage`（标题含日期+单品数，有图用图）+ 复制文案按钮。
5. **SQL**：无表结构变更。
