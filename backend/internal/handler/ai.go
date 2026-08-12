package handler

import (
	"net/http"
	"strings"

	"jarin-wardrobe/internal/ai"
	"jarin-wardrobe/internal/apptime"
	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/cos"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/healthmetrics"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type AIHandler struct {
	Cfg    config.Config
	Client *ai.Client
	COS    *cos.Client
}

type analyzeClothingBody struct {
	ImageURL string `json:"imageUrl"`
}

func (h AIHandler) AnalyzeClothing(c *gin.Context) {
	if !h.Cfg.AIEnabled() || h.Client == nil {
		response.Fail(c, "AI 未配置", 1, http.StatusOK)
		return
	}

	var body analyzeClothingBody
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.ImageURL) == "" {
		response.Fail(c, "缺少图片地址", 1, http.StatusOK)
		return
	}

	uid := middleware.UserID(c)
	rows, err := db.Pool.Query(c.Request.Context(),
		`SELECT id, name FROM categories WHERE user_id=$1 ORDER BY sort_order ASC, id ASC`, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	defer rows.Close()

	cats := make([]ai.Category, 0)
	for rows.Next() {
		var cat ai.Category
		if err := rows.Scan(&cat.ID, &cat.Name); err != nil {
			response.Fail(c, err.Error(), 1, http.StatusOK)
			return
		}
		cats = append(cats, cat)
	}

	// AI 侧使用 COS 预签名拉图（私有桶；勿走本机 /api/media 代理）
	imageForAI := resolveImageForAI(c.Request.Context(), h.Cfg, h.COS, body.ImageURL)
	result, err := ai.AnalyzeClothing(c.Request.Context(), h.Client, imageForAI, cats)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, result)
}

type analyzeFoodBody struct {
	ImageURL string `json:"imageUrl"`
	MealType string `json:"mealType"`
}

func (h AIHandler) AnalyzeFood(c *gin.Context) {
	if !h.Cfg.AIEnabled() || h.Client == nil {
		response.Fail(c, "AI 未配置", 1, http.StatusOK)
		return
	}
	var body analyzeFoodBody
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.ImageURL) == "" {
		response.Fail(c, "缺少图片地址", 1, http.StatusOK)
		return
	}
	uid := middleware.UserID(c)
	var gender string
	var age int
	var height, weight float64
	_ = db.Pool.QueryRow(c, `
		SELECT gender, age, height_cm::float8, weight_kg::float8
		FROM user_body_profiles WHERE user_id=$1`, uid,
	).Scan(&gender, &age, &height, &weight)

	metrics := healthmetrics.Compute(healthmetrics.Input{
		Gender: gender, Age: age, HeightCM: height, WeightKG: weight,
	})
	mealType := normalizeMealType(body.MealType)
	imageForAI := resolveImageForAI(c.Request.Context(), h.Cfg, h.COS, body.ImageURL)

	result, err := ai.AnalyzeFood(c.Request.Context(), h.Client, ai.FoodAnalyzeInput{
		ImageURL: imageForAI,
		MealType: mealType,
		Now:      apptime.Now(),
		Gender:   gender,
		Age:      age,
		HeightCM: height,
		WeightKG: weight,
		BMI:      metrics.BMI,
		BMILevel: metrics.BMILevel,
		BodyFat:  metrics.BodyFatPct,
		SuggestK: metrics.SuggestKcal,
	})
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, result)
}
