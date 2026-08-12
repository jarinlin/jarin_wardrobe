package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type FoodResult struct {
	FoodName   string   `json:"foodName"`
	Portion    string   `json:"portion"`
	Calories   float64  `json:"calories"`
	Advice     string   `json:"advice"`
	Items      []string `json:"items"`
	Confidence float64  `json:"confidence"`
}

type FoodAnalyzeInput struct {
	ImageURL string
	MealType string // breakfast / lunch / dinner / other
	Now      time.Time
	Gender   string
	Age      int
	HeightCM float64
	WeightKG float64
	BMI      float64
	BMILevel string
	BodyFat  float64
	SuggestK float64
}

type modelFoodJSON struct {
	FoodName   string      `json:"foodName"`
	Portion    string      `json:"portion"`
	Calories   json.Number `json:"calories"`
	Advice     string      `json:"advice"`
	Items      []string    `json:"items"`
	Confidence float64     `json:"confidence"`
}

func foodSystemPrompt() string {
	return `你是营养饮食助手。根据食物照片与用户身体信息，输出且仅输出一个 JSON（不要 Markdown）：
{
  "foodName": "主食/菜品概括",
  "portion": "分量估计，如约350g / 1碗",
  "calories": 数字千卡,
  "advice": "结合餐次、时间与身体指标的简短饮食建议（中文，2-4句）",
  "items": ["识别到的食物项"],
  "confidence": 0-1
}
规则：看不清的分量给合理估计；热量用常见中国餐饮估算；建议要具体可执行，避免恐吓措辞。`
}

func AnalyzeFood(ctx context.Context, client *Client, in FoodAnalyzeInput) (*FoodResult, error) {
	if client == nil {
		return nil, fmt.Errorf("AI 未配置")
	}
	if strings.TrimSpace(in.ImageURL) == "" {
		return nil, fmt.Errorf("缺少图片地址")
	}
	mealLabel := map[string]string{
		"breakfast": "早餐",
		"lunch":     "午餐",
		"dinner":    "晚餐",
		"other":     "加餐/其他",
	}[in.MealType]
	if mealLabel == "" {
		mealLabel = "其他"
	}
	now := in.Now
	if now.IsZero() {
		now = time.Now()
	}
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.FixedZone("CST", 8*3600)
	}

	userText := fmt.Sprintf(`请识别这餐食物并输出 JSON。
餐次：%s
当前时间：%s
用户：性别=%s，年龄=%d，身高=%.1fcm，体重=%.1fkg，BMI=%.1f（%s），体脂率约%.1f%%，建议日摄入约%.0fkcal。`,
		mealLabel,
		now.In(loc).Format("2006-01-02 15:04"),
		in.Gender, in.Age, in.HeightCM, in.WeightKG, in.BMI, in.BMILevel, in.BodyFat, in.SuggestK,
	)

	raw, err := client.ChatVision(ctx, foodSystemPrompt(), userText, in.ImageURL)
	if err != nil {
		return nil, err
	}
	clean := StripJSONFence(raw)
	var parsed modelFoodJSON
	if err := json.Unmarshal([]byte(clean), &parsed); err != nil {
		return nil, fmt.Errorf("识别结果不是合法 JSON: %w", err)
	}
	cal, _ := parsed.Calories.Float64()
	items := parsed.Items
	if items == nil {
		items = []string{}
	}
	return &FoodResult{
		FoodName:   strings.TrimSpace(parsed.FoodName),
		Portion:    strings.TrimSpace(parsed.Portion),
		Calories:   cal,
		Advice:     strings.TrimSpace(parsed.Advice),
		Items:      items,
		Confidence: parsed.Confidence,
	}, nil
}
