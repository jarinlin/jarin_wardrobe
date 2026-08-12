# AI 衣物识别 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增衣物选图上传后，经后端调用 `qwen3.5-plus`（OpenAI 兼容中转）自动回填名称/分类/品牌/颜色/尺码/价格，用户可改再保存。

**Architecture:** 小程序上传 COS → `POST /api/ai/clothing/analyze` → Go `internal/ai` 调 `AI_BASE_URL/chat/completions` → JSON 解析并映射用户类目 → 前端空字段合并回填。

**Tech Stack:** 微信小程序 · Go/Gin · OpenAI Chat Completions 兼容 API · 现有 COS 上传

**Spec:** `docs/superpowers/specs/2026-08-12-ai-clothing-recognize-design.md`

---

## File map

| 文件 | 职责 |
|------|------|
| `backend/internal/config/config.go` | 读取 `AI_*` |
| `backend/.env.example` | 模板变量 |
| `backend/internal/ai/client.go` | OpenAI 兼容 HTTP 客户端 |
| `backend/internal/ai/clothing.go` | Prompt、解析、类目映射 |
| `backend/internal/ai/clothing_test.go` | 映射/JSON 解析单测 |
| `backend/internal/handler/ai.go` | HTTP handler |
| `backend/cmd/server/main.go` | 注册路由 |
| `src/assets/js/api.js` | `analyzeClothing` |
| `pages/clothing-edit/clothing-edit.js` | 上传后自动识别 + 空字段合并 |
| `pages/clothing-edit/clothing-edit.wxml` | loading / 价格估算提示 |
| `pages/clothing-edit/clothing-edit.wxss` | 提示样式 |
| `Projectprogress.md` | 进度 |

---

### Task 1: Config + AI client

**Files:**
- Modify: `backend/internal/config/config.go`
- Modify: `backend/.env.example`
- Create: `backend/internal/ai/client.go`

- [x] **Step 1:** 在 `Config` 增加 `AIBaseURL`、`AIAPIKey`、`AIModel`、`AITimeoutSec`；`AIEnabled() bool`
- [x] **Step 2:** `.env.example` 写入默认 `AI_BASE_URL=https://open.lastoken.cn/v1`、`AI_MODEL=qwen3.5-plus`
- [x] **Step 3:** 实现 `Client.ChatVision(ctx, system, userText, imageURL) (string, error)`，POST `{base}/chat/completions`，body 含 `messages` 多模态 content、`enable_thinking: false`（若对方忽略则无害）

---

### Task 2: Clothing analyze + unit tests

**Files:**
- Create: `backend/internal/ai/clothing.go`
- Create: `backend/internal/ai/clothing_test.go`

- [x] **Step 1:** 写 `ParseClothingJSON` / `MapCategory` 测试（含 markdown 代码块剥离、类目精确匹配）
- [x] **Step 2:** 实现 `AnalyzeClothing(ctx, client, imageURL, categories) (*Result, error)`
- [x] **Step 3:** `go test ./internal/ai/ -count=1` 通过

---

### Task 3: Handler + route

**Files:**
- Create: `backend/internal/handler/ai.go`
- Modify: `backend/cmd/server/main.go`

- [x] **Step 1:** `POST /api/ai/clothing/analyze`，JWT，查 categories，调 AI，返回统一 `response.OK`
- [x] **Step 2:** 未配置 AI Key → 业务错误「AI 未配置」
- [x] **Step 3:** `go build ./cmd/server`

---

### Task 4: Mini-program

**Files:**
- Modify: `src/assets/js/api.js`
- Modify: `pages/clothing-edit/*`

- [x] **Step 1:** `analyzeClothing(imageUrl)` → `POST /api/ai/clothing/analyze`
- [x] **Step 2:** `onChooseImage` 上传成功后自动识别；空字段合并；`analyzing` / `priceEstimated` UI
- [x] **Step 3:** 更新 `Projectprogress.md`

---

### Task 5: Manual verify notes

- [ ] 后端 `.env` 填入真实 `AI_API_KEY`（不提交）
- [ ] 重启 Go，小程序新增衣物选图，确认回填与估算提示
- [ ] Commit（用户未要求 push）

---

## Spec coverage

- 自动识别 / 空字段合并 / 价格估算标注 / `.env` / 后端统一接口 / 类目映射 / 失败可手填 → Tasks 1–4
- Phase 2 饮食 → 不在本计划
