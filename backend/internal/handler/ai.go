package handler

import (
	"net/http"
	"strings"

	"jarin-wardrobe/internal/ai"
	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type AIHandler struct {
	Cfg    config.Config
	Client *ai.Client
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

	result, err := ai.AnalyzeClothing(c.Request.Context(), h.Client, body.ImageURL, cats)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, result)
}
