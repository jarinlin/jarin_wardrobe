package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

type TagResult struct {
	Tags       []string `json:"tags"`
	Style      string   `json:"style"`
	Season     string   `json:"season"`
	Occasion   string   `json:"occasion"`
	Material   string   `json:"material"`
	ColorTone  string   `json:"colorTone"`
	Pattern    string   `json:"pattern"`
	Fit        string   `json:"fit"`
	Summary    string   `json:"summary"`
	Confidence float64  `json:"confidence"`
}

type modelTagJSON struct {
	Tags       []string `json:"tags"`
	Style      string   `json:"style"`
	Season     string   `json:"season"`
	Occasion   string   `json:"occasion"`
	Material   string   `json:"material"`
	ColorTone  string   `json:"colorTone"`
	Pattern    string   `json:"pattern"`
	Fit        string   `json:"fit"`
	Summary    string   `json:"summary"`
	Confidence float64  `json:"confidence"`
}

func tagSystemPrompt() string {
	return `你是服饰标签助手，为「AI 穿搭建议」生成可检索标签。只输出 JSON：
{
  "tags": ["短中文标签，8-16个"],
  "style": "风格，如休闲/正式/运动/甜美",
  "season": "季节，如春夏/秋冬/四季",
  "occasion": "场合，如日常/通勤/约会/运动",
  "material": "材质观感，如棉/牛仔/针织",
  "colorTone": "色系，如黑白/暖色/冷色/彩色",
  "pattern": "图案，如纯色/条纹/印花",
  "fit": "版型，如修身/宽松/直筒",
  "summary": "一句话描述，便于穿搭匹配",
  "confidence": 0-1
}
规则：tags 必须覆盖风格、季节、场合、颜色、品类关键词；不要价格；不要空标签；中文为主。`
}

// TagClothingImage 异步打标专用（与表单识别分离，标签更面向穿搭）
func TagClothingImage(ctx context.Context, client *Client, imageURL, name, category, color, brand string) (*TagResult, error) {
	if client == nil {
		return nil, fmt.Errorf("AI 未配置")
	}
	if strings.TrimSpace(imageURL) == "" {
		return nil, fmt.Errorf("缺少图片地址")
	}
	userText := fmt.Sprintf(`请为这件衣物打标。
已知信息（可参考，以图片为准）：名称=%s；分类=%s；颜色=%s；品牌=%s。`,
		name, category, color, brand)

	raw, err := client.ChatVision(ctx, tagSystemPrompt(), userText, imageURL)
	if err != nil {
		return nil, err
	}
	var parsed modelTagJSON
	if err := json.Unmarshal([]byte(StripJSONFence(raw)), &parsed); err != nil {
		return nil, fmt.Errorf("打标结果不是合法 JSON: %w", err)
	}

	tags := normalizeTagList(parsed.Tags)
	// 结构化字段并入 tags，便于后续穿搭检索
	for _, extra := range []string{parsed.Style, parsed.Season, parsed.Occasion, parsed.Material, parsed.ColorTone, parsed.Pattern, parsed.Fit} {
		extra = strings.TrimSpace(extra)
		if extra != "" {
			tags = appendUnique(tags, extra)
		}
	}
	return &TagResult{
		Tags:       tags,
		Style:      strings.TrimSpace(parsed.Style),
		Season:     strings.TrimSpace(parsed.Season),
		Occasion:   strings.TrimSpace(parsed.Occasion),
		Material:   strings.TrimSpace(parsed.Material),
		ColorTone:  strings.TrimSpace(parsed.ColorTone),
		Pattern:    strings.TrimSpace(parsed.Pattern),
		Fit:        strings.TrimSpace(parsed.Fit),
		Summary:    strings.TrimSpace(parsed.Summary),
		Confidence: parsed.Confidence,
	}, nil
}

func normalizeTagList(in []string) []string {
	out := make([]string, 0, len(in))
	for _, t := range in {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		out = appendUnique(out, t)
	}
	return out
}

func appendUnique(list []string, v string) []string {
	for _, x := range list {
		if x == v {
			return list
		}
	}
	return append(list, v)
}
