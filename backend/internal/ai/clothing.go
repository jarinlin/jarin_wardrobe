package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

type Category struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Confidence struct {
	Category float64 `json:"category"`
	Color    float64 `json:"color"`
	Brand    float64 `json:"brand"`
	Size     float64 `json:"size"`
	Price    float64 `json:"price"`
}

type ClothingResult struct {
	Name           string     `json:"name"`
	CategoryID     *int64     `json:"categoryId"`
	CategoryName   string     `json:"categoryName"`
	Brand          string     `json:"brand"`
	Color          string     `json:"color"`
	Size           string     `json:"size"`
	Price          float64    `json:"price"`
	PriceEstimated bool       `json:"priceEstimated"`
	PriceNote      string     `json:"priceNote"`
	Confidence     Confidence `json:"confidence"`
	RawTags        []string   `json:"rawTags"`
}

type modelClothingJSON struct {
	Name           string          `json:"name"`
	CategoryName   string          `json:"categoryName"`
	Brand          string          `json:"brand"`
	Color          string          `json:"color"`
	Size           string          `json:"size"`
	Price          json.Number     `json:"price"`
	PriceEstimated bool            `json:"priceEstimated"`
	PriceNote      string          `json:"priceNote"`
	Confidence     Confidence      `json:"confidence"`
	RawTags        []string        `json:"rawTags"`
}

var fenceRe = regexp.MustCompile("(?s)^\\s*```(?:json)?\\s*(.*?)\\s*```\\s*$")

func StripJSONFence(s string) string {
	s = strings.TrimSpace(s)
	if m := fenceRe.FindStringSubmatch(s); len(m) == 2 {
		return strings.TrimSpace(m[1])
	}
	// 宽松：截取第一个 { 到最后一个 }
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

func ParseClothingJSON(raw string) (*modelClothingJSON, error) {
	clean := StripJSONFence(raw)
	var out modelClothingJSON
	if err := json.Unmarshal([]byte(clean), &out); err != nil {
		return nil, fmt.Errorf("识别结果不是合法 JSON: %w", err)
	}
	return &out, nil
}

// MapCategory 精确匹配优先，其次包含关系（忽略大小写与空格）。
func MapCategory(suggested string, cats []Category) (id *int64, name string) {
	suggested = strings.TrimSpace(suggested)
	if suggested == "" || len(cats) == 0 {
		return nil, suggested
	}
	norm := func(s string) string {
		return strings.ToLower(strings.ReplaceAll(strings.TrimSpace(s), " ", ""))
	}
	target := norm(suggested)
	for _, c := range cats {
		if norm(c.Name) == target {
			id := c.ID
			return &id, c.Name
		}
	}
	for _, c := range cats {
		a, b := norm(c.Name), target
		if strings.Contains(a, b) || strings.Contains(b, a) {
			id := c.ID
			return &id, c.Name
		}
	}
	return nil, suggested
}

func clothingSystemPrompt() string {
	return `你是服饰图像结构化助手。根据用户提供的衣物照片，输出且仅输出一个 JSON 对象（不要 Markdown、不要解释），字段：
{
  "name": "简洁中文名称，如白色圆领短袖T恤",
  "categoryName": "必须尽量从用户给出的分类列表中选一个",
  "brand": "品牌，看不清则空字符串",
  "color": "主色，中文",
  "size": "尺码，看不清则空字符串",
  "price": 数字,
  "priceEstimated": true/false,
  "priceNote": "说明",
  "confidence": {"category":0-1,"color":0-1,"brand":0-1,"size":0-1,"price":0-1},
  "rawTags": ["短标签"]
}
规则：
1. 图中有清晰价签/吊牌价格时：price 用该数字，priceEstimated=false，priceNote 说明来源。
2. 没有价签时：按品牌与品类估算市场参考价（人民币），priceEstimated=true，priceNote 写「估算」。
3. 品牌、尺码看不清不要编造，填空字符串。
4. categoryName 优先使用用户分类列表中的名称。`
}

func AnalyzeClothing(ctx context.Context, client *Client, imageURL string, cats []Category) (*ClothingResult, error) {
	if client == nil {
		return nil, fmt.Errorf("AI 未配置")
	}
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" {
		return nil, fmt.Errorf("缺少图片地址")
	}

	names := make([]string, 0, len(cats))
	for _, c := range cats {
		names = append(names, c.Name)
	}
	userText := "请识别这件衣物并按要求输出 JSON。\n用户可用分类：" + strings.Join(names, "、")
	if len(names) == 0 {
		userText = "请识别这件衣物并按要求输出 JSON。用户暂无分类列表，categoryName 自行给出品类中文名。"
	}

	raw, err := client.ChatVision(ctx, clothingSystemPrompt(), userText, imageURL)
	if err != nil {
		return nil, err
	}
	parsed, err := ParseClothingJSON(raw)
	if err != nil {
		return nil, err
	}

	catID, catName := MapCategory(parsed.CategoryName, cats)
	price, _ := parsed.Price.Float64()
	tags := parsed.RawTags
	if tags == nil {
		tags = []string{}
	}

	return &ClothingResult{
		Name:           strings.TrimSpace(parsed.Name),
		CategoryID:     catID,
		CategoryName:   catName,
		Brand:          strings.TrimSpace(parsed.Brand),
		Color:          strings.TrimSpace(parsed.Color),
		Size:           strings.TrimSpace(parsed.Size),
		Price:          price,
		PriceEstimated: parsed.PriceEstimated,
		PriceNote:      strings.TrimSpace(parsed.PriceNote),
		Confidence:     parsed.Confidence,
		RawTags:        tags,
	}, nil
}
