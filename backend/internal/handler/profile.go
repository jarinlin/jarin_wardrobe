package handler

import (
	"net/http"
	"strings"

	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/healthmetrics"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type ProfileHandler struct{}

type bodyProfileBody struct {
	Gender   string  `json:"gender"`
	Age      int     `json:"age"`
	HeightCM float64 `json:"heightCm"`
	WeightKG float64 `json:"weightKg"`
}

func (ProfileHandler) GetBody(c *gin.Context) {
	uid := middleware.UserID(c)
	var gender string
	var age int
	var height, weight float64
	err := db.Pool.QueryRow(c, `
		SELECT gender, age, height_cm::float8, weight_kg::float8
		FROM user_body_profiles WHERE user_id=$1`, uid,
	).Scan(&gender, &age, &height, &weight)
	if err != nil {
		response.OK(c, gin.H{
			"gender": "", "age": 0, "heightCm": 0, "weightKg": 0,
			"metrics": healthmetrics.Compute(healthmetrics.Input{}),
		})
		return
	}
	metrics := healthmetrics.Compute(healthmetrics.Input{
		Gender: gender, Age: age, HeightCM: height, WeightKG: weight,
	})
	response.OK(c, gin.H{
		"gender": gender, "age": age, "heightCm": height, "weightKg": weight,
		"metrics": metrics,
	})
}

func (ProfileHandler) UpsertBody(c *gin.Context) {
	uid := middleware.UserID(c)
	var body bodyProfileBody
	_ = c.ShouldBindJSON(&body)
	body.Gender = strings.TrimSpace(body.Gender)
	if body.HeightCM <= 0 || body.WeightKG <= 0 {
		response.Fail(c, "请填写身高和体重", 1, http.StatusOK)
		return
	}
	if body.Age < 0 || body.Age > 120 {
		response.Fail(c, "年龄不合法", 1, http.StatusOK)
		return
	}

	_, err := db.Pool.Exec(c, `
		INSERT INTO user_body_profiles (user_id, gender, age, height_cm, weight_kg, updated_at)
		VALUES ($1,$2,$3,$4,$5,NOW())
		ON CONFLICT (user_id) DO UPDATE SET
		  gender=EXCLUDED.gender,
		  age=EXCLUDED.age,
		  height_cm=EXCLUDED.height_cm,
		  weight_kg=EXCLUDED.weight_kg,
		  updated_at=NOW()`,
		uid, body.Gender, body.Age, body.HeightCM, body.WeightKG,
	)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	ProfileHandler{}.GetBody(c)
}
