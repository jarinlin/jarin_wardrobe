# AI 衣物识别设计（Phase 1）

日期：2026-08-12  
产品：Jarin衣柜  
状态：待实现（设计已确认）

## 1. 目标

在「新增/编辑衣物」流程中，用户拍照或选图后，由 AI 自动解析衣物并回填表单字段，用户可二次修改后保存，降低手工录入成本。

本期范围仅限**衣物识别**。饮食记录（身体档案、餐次、食物热量与建议）为 **Phase 2**，见文末。

## 2. 已确认决策

| 项 | 决策 |
|----|------|
| 优先级 | 先做衣物 AI，饮食后置 |
| 模型 | `qwen3.5-plus` |
| 接入 | OpenAI 兼容中转，Base URL `https://open.lastoken.cn/v1` |
| 配置 | `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` 等写入后端 `.env`，不进小程序 |
| 架构 | 后端统一识别接口（方案 A），密钥不下发客户端 |
| 触发 | 选图上传成功后自动识别 |
| 价格 | 有价签用价签；否则估算市场价，并标注「估算」 |

## 3. 架构与数据流

```
小程序 clothing-edit
  → 选图/拍照 → 压缩 → POST /api/upload → COS imageUrl
  → 自动 POST /api/ai/clothing/analyze { imageUrl }
       ↓
Go 后端（JWT）
  → 查当前用户 categories
  → 调用 AI_BASE_URL/chat/completions（model=qwen3.5-plus，图片 image_url）
  → 解析 JSON → 映射 categoryId
       ↓
小程序回填可编辑表单 → 用户确认 → 现有 POST/PUT /api/clothes
```

### 3.1 环境变量（后端 `.env` / `.env.example`）

```env
AI_BASE_URL=https://open.lastoken.cn/v1
AI_API_KEY=
AI_MODEL=qwen3.5-plus
AI_TIMEOUT_SEC=60
```

- 未配置 `AI_API_KEY` 时：识别接口返回明确业务错误（如「AI 未配置」），不影响手填保存。
- 不在仓库提交真实 Key。

## 4. API 契约

### 4.1 `POST /api/ai/clothing/analyze`

- 鉴权：Bearer JWT（与现有 API 一致）
- 请求体：

```json
{
  "imageUrl": "https://..."
}
```

- 成功响应 `data`：

```json
{
  "name": "白色圆领短袖T恤",
  "categoryId": 1,
  "categoryName": "上衣",
  "brand": "Uniqlo",
  "color": "白色",
  "size": "M",
  "price": 99,
  "priceEstimated": true,
  "priceNote": "未见价签，按品牌与品类估算",
  "confidence": {
    "category": 0.92,
    "color": 0.88,
    "brand": 0.55,
    "size": 0.35,
    "price": 0.4
  },
  "rawTags": ["短袖", "休闲"]
}
```

### 4.2 映射与规则

1. **分类**：模型输出类目名，后端与用户 `categories` 做名称匹配（精确优先，其次包含/别名）；匹配成功填 `categoryId`，否则 `categoryId` 为 `null`，仅返回 `categoryName` 建议。
2. **品牌 / 尺码**：图中看不清则空字符串，不编造。
3. **颜色 / 名称**：尽量给出简洁中文；`name` 形如「颜色+款式+品类」。
4. **价格**：价签/吊牌清晰 → 填数字且 `priceEstimated=false`；否则估算且 `priceEstimated=true`，并给 `priceNote`。
5. **思考模式**：调用时关闭 thinking（若中转支持 `enable_thinking=false` 或等价参数），要求 **JSON only** 输出，便于解析。
6. **失败**：网络/超时/非 JSON → 业务错误码 + message；前端 toast，不阻断保存。

### 4.3 Prompt 约束（实现要点）

- 输入：图片 URL + 用户可用分类名称列表。
- 输出：严格 JSON，字段与上表一致；禁止 markdown 代码块包裹（若模型仍包裹则后端 strip）。
- 明确价格估算策略与「看不清留空」规则。

## 5. 前端交互

页面：`pages/clothing-edit`

1. 用户选图 → 现有上传流程拿到 `imageUrl`。
2. 上传成功后自动调用 `analyze`；展示 loading（如「AI 识别中…」）。
3. **合并策略**：仅覆盖表单中当前为空的字段；用户已手填不被覆盖。
4. `priceEstimated===true` 时，价格旁展示提示（如「估算参考，可修改」）。
5. 换图：再次自动识别，仍按空字段合并。
6. 编辑已有衣物且未换图：不触发识别。
7. `rawTags`：本期可不写入 UI；后端可返回供后续标签功能使用。

## 6. 后端模块划分

建议新增（保持与现有分层一致）：

- `internal/ai/client.go`：OpenAI 兼容 Chat Completions 客户端（baseURL、key、timeout）
- `internal/ai/clothing.go`：prompt、JSON 解析、分类映射
- `internal/handler/ai.go`：`AnalyzeClothing` handler
- `cmd/server/main.go`：注册 `POST /api/ai/clothing/analyze`（`authMw`）
- `internal/config`：读取 `AI_*`

不改动衣物表结构即可完成本期（`priceEstimated` 仅作识别响应提示，不强制落库；若后续需要可再加列，本期不做 DB 变更）。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 未登录 | 401，与现有一致 |
| 无 AI Key | 业务失败「AI 未配置」 |
| 图片 URL 无效 / 模型拒识 | 业务失败，可手填 |
| 超时 | 业务失败「识别超时」 |
| 部分字段低置信度 | 仍回填，由用户改；不因低置信度整单失败 |

## 8. 非目标（本期不做）

- 小程序直调模型
- 异步队列 / 批量识别
- 衣物抠图、多件同框拆分
- 将估算价格强制写入不可编辑状态
- 饮食模块完整功能（见 Phase 2）

## 9. Phase 2 预留（饮食记录，未开工）

后续独立规格，原则：

- 用户身体档案：身高、体重、年龄、性别等 → 后端计算 BMI 等指标  
- 饮食记录：拍照/上传 → 标注早餐/午餐/晚餐/其他 → AI 识别食物、分量、卡路里 + 个性化建议  
- 请求携带：图片、身体信息、系统当前时间、餐次  
- 复用同一 `AI_*` 与 `internal/ai` 客户端，新增 `POST /api/ai/food/analyze` 与饮食 CRUD  

## 10. 验收标准

1. 配置好 `.env` 后，新增衣物选图可自动回填名称/分类/颜色等。  
2. 无价签时价格有值且界面提示「估算」。  
3. 用户改字段后保存，以用户值为准。  
4. 关闭或清空 `AI_API_KEY` 时，识别失败但不影响手动新增衣物。  
5. Key 与 Base URL 仅存在于服务端环境变量。
