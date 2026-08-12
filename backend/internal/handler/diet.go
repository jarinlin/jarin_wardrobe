package handler

import (
	"log"
	"net/http"
	"strings"
	"time"

	"jarin-wardrobe/internal/apptime"
	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/cos"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/media"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type DietHandler struct {
	Cfg config.Config
	COS *cos.Client
}

type dietBody struct {
	MealType string  `json:"mealType"`
	MealAt   string  `json:"mealAt"`
	ImageURL string  `json:"imageUrl"`
	FoodName string  `json:"foodName"`
	Portion  string  `json:"portion"`
	Calories float64 `json:"calories"`
	Advice   string  `json:"advice"`
}

func normalizeMealType(v string) string {
	v = strings.TrimSpace(v)
	switch strings.ToLower(v) {
	case "breakfast", "早餐":
		return "breakfast"
	case "lunch", "午餐":
		return "lunch"
	case "dinner", "晚餐":
		return "dinner"
	default:
		return "other"
	}
}

func mealTypeLabel(v string) string {
	switch v {
	case "breakfast":
		return "早餐"
	case "lunch":
		return "午餐"
	case "dinner":
		return "晚餐"
	default:
		return "其他"
	}
}

func (h DietHandler) mapLog(uid, id int64, mealType string, mealAt time.Time, image, food, portion string, calories float64, advice string, createdAt time.Time) gin.H {
	return gin.H{
		"id":            id,
		"mealType":      mealType,
		"mealTypeLabel": mealTypeLabel(mealType),
		"mealAt":        apptime.FormatRFC3339(mealAt),
		"imageUrl":      media.ProxyURL(h.Cfg, uid, image),
		"foodName":      food,
		"portion":       portion,
		"calories":      calories,
		"advice":        advice,
		"createdAt":     apptime.FormatRFC3339(createdAt),
	}
}

func (h DietHandler) List(c *gin.Context) {
	uid := middleware.UserID(c)
	sql := `
		SELECT id, meal_type, meal_at, image_url, food_name, portion, calories::float8, advice, created_at
		FROM diet_logs WHERE user_id=$1`
	args := []any{uid}
	if d := strings.TrimSpace(c.Query("date")); d != "" {
		sql += " AND meal_at::date=$2::date"
		args = append(args, d)
	}
	sql += " ORDER BY meal_at DESC, id DESC LIMIT 100"

	rows, err := db.Pool.Query(c, sql, args...)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	defer rows.Close()
	list := make([]gin.H, 0)
	var dayKcal float64
	for rows.Next() {
		var id int64
		var mealType, image, food, portion, advice string
		var mealAt, createdAt time.Time
		var calories float64
		if err := rows.Scan(&id, &mealType, &mealAt, &image, &food, &portion, &calories, &advice, &createdAt); err != nil {
			response.Fail(c, err.Error(), 1, http.StatusOK)
			return
		}
		dayKcal += calories
		list = append(list, h.mapLog(uid, id, mealType, mealAt, image, food, portion, calories, advice, createdAt))
	}
	response.OK(c, gin.H{"list": list, "totalCalories": dayKcal})
}

func (h DietHandler) Detail(c *gin.Context) {
	uid := middleware.UserID(c)
	var id int64
	var mealType, image, food, portion, advice string
	var mealAt, createdAt time.Time
	var calories float64
	err := db.Pool.QueryRow(c, `
		SELECT id, meal_type, meal_at, image_url, food_name, portion, calories::float8, advice, created_at
		FROM diet_logs WHERE id=$1 AND user_id=$2`, c.Param("id"), uid,
	).Scan(&id, &mealType, &mealAt, &image, &food, &portion, &calories, &advice, &createdAt)
	if err != nil {
		response.Fail(c, "记录不存在", 404, http.StatusNotFound)
		return
	}
	response.OK(c, h.mapLog(uid, id, mealType, mealAt, image, food, portion, calories, advice, createdAt))
}

func (h DietHandler) Create(c *gin.Context) {
	uid := middleware.UserID(c)
	var body dietBody
	_ = c.ShouldBindJSON(&body)
	mealType := normalizeMealType(body.MealType)
	imageKey := media.NormalizeForStore(h.Cfg, body.ImageURL)
	mealAt := apptime.Now()
	if strings.TrimSpace(body.MealAt) != "" {
		if t, err := time.Parse(time.RFC3339, body.MealAt); err == nil {
			mealAt = apptime.In(t)
		} else if t, err := time.ParseInLocation("2006-01-02 15:04", body.MealAt, apptime.Loc()); err == nil {
			mealAt = t
		}
	}
	var id int64
	err := db.Pool.QueryRow(c, `
		INSERT INTO diet_logs (user_id, meal_type, meal_at, image_url, food_name, portion, calories, advice)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		uid, mealType, mealAt, imageKey, strings.TrimSpace(body.FoodName), strings.TrimSpace(body.Portion),
		body.Calories, strings.TrimSpace(body.Advice),
	).Scan(&id)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	c.Params = gin.Params{{Key: "id", Value: itoa64(id)}}
	h.Detail(c)
}

func (h DietHandler) Update(c *gin.Context) {
	uid := middleware.UserID(c)
	var body dietBody
	_ = c.ShouldBindJSON(&body)
	mealType := normalizeMealType(body.MealType)
	imageKey := media.NormalizeForStore(h.Cfg, body.ImageURL)

	var oldImage string
	_ = db.Pool.QueryRow(c, `SELECT image_url FROM diet_logs WHERE id=$1 AND user_id=$2`, c.Param("id"), uid).Scan(&oldImage)
	oldKey := media.ExtractKey(h.Cfg, oldImage)
	if imageKey == "" && strings.TrimSpace(body.ImageURL) == "" {
		imageKey = oldKey
		if imageKey == "" {
			imageKey = oldImage
		}
	}

	mealAtSQL := "meal_at"
	args := []any{
		mealType, imageKey, strings.TrimSpace(body.FoodName), strings.TrimSpace(body.Portion),
		body.Calories, strings.TrimSpace(body.Advice), c.Param("id"), uid,
	}
	sql := `
		UPDATE diet_logs SET
		  meal_type=$1, image_url=$2, food_name=$3, portion=$4, calories=$5, advice=$6, updated_at=NOW()
		WHERE id=$7 AND user_id=$8`
	if strings.TrimSpace(body.MealAt) != "" {
		var t time.Time
		var ok bool
		if parsed, err := time.Parse(time.RFC3339, body.MealAt); err == nil {
			t, ok = apptime.In(parsed), true
		} else if parsed, err := time.ParseInLocation("2006-01-02 15:04", body.MealAt, apptime.Loc()); err == nil {
			t, ok = parsed, true
		}
		if ok {
			sql = `
				UPDATE diet_logs SET
				  meal_type=$1, image_url=$2, food_name=$3, portion=$4, calories=$5, advice=$6, meal_at=$7, updated_at=NOW()
				WHERE id=$8 AND user_id=$9`
			args = []any{
				mealType, imageKey, strings.TrimSpace(body.FoodName), strings.TrimSpace(body.Portion),
				body.Calories, strings.TrimSpace(body.Advice), t, c.Param("id"), uid,
			}
			_ = mealAtSQL
		}
	}
	_, err := db.Pool.Exec(c, sql, args...)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	if oldKey != "" && oldKey != imageKey && h.COS != nil && h.COS.Enabled() {
		if err := h.COS.Delete(c.Request.Context(), oldKey); err != nil {
			log.Printf("[cos] 删除旧饮食图失败 key=%s err=%v", oldKey, err)
		}
	}
	h.Detail(c)
}

func (h DietHandler) Delete(c *gin.Context) {
	uid := middleware.UserID(c)
	id := c.Param("id")
	var imageStored string
	err := db.Pool.QueryRow(c, `SELECT image_url FROM diet_logs WHERE id=$1 AND user_id=$2`, id, uid).Scan(&imageStored)
	if err != nil {
		response.Fail(c, "记录不存在", 404, http.StatusNotFound)
		return
	}
	tag, err := db.Pool.Exec(c, `DELETE FROM diet_logs WHERE id=$1 AND user_id=$2`, id, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	if tag.RowsAffected() == 0 {
		response.Fail(c, "记录不存在", 404, http.StatusNotFound)
		return
	}
	key := media.ExtractKey(h.Cfg, imageStored)
	if key != "" && h.COS != nil && h.COS.Enabled() {
		if err := h.COS.Delete(c.Request.Context(), key); err != nil {
			log.Printf("[cos] 删除饮食图失败 key=%s err=%v", key, err)
		}
	}
	response.OK(c, true)
}
