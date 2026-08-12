package healthmetrics

import (
	"math"
	"strings"
)

type Input struct {
	Gender   string  // male / female / other
	Age      int
	HeightCM float64
	WeightKG float64
}

type Result struct {
	BMI          float64 `json:"bmi"`
	BMILevel     string  `json:"bmiLevel"`
	BodyFatPct   float64 `json:"bodyFatPct"`
	IdealWeight  float64 `json:"idealWeightKg"`
	BMR          float64 `json:"bmr"`
	SuggestKcal  float64 `json:"suggestKcal"`
}

func Compute(in Input) Result {
	var out Result
	if in.HeightCM <= 0 || in.WeightKG <= 0 {
		return out
	}
	hm := in.HeightCM / 100
	bmi := in.WeightKG / (hm * hm)
	out.BMI = round1(bmi)
	out.BMILevel = bmiLevel(bmi)
	out.IdealWeight = round1(22 * hm * hm)

	sex := 0.0 // female / other
	if strings.EqualFold(in.Gender, "male") || in.Gender == "男" {
		sex = 1
	}
	age := in.Age
	if age <= 0 {
		age = 30
	}
	// Deurenberg 估算体脂率
	bf := 1.20*bmi + 0.23*float64(age) - 10.8*sex - 5.4
	if bf < 3 {
		bf = 3
	}
	if bf > 60 {
		bf = 60
	}
	out.BodyFatPct = round1(bf)

	// Mifflin-St Jeor BMR
	if sex == 1 {
		out.BMR = round1(10*in.WeightKG + 6.25*in.HeightCM - 5*float64(age) + 5)
	} else {
		out.BMR = round1(10*in.WeightKG + 6.25*in.HeightCM - 5*float64(age) - 161)
	}
	// 轻度活动 TDEE ≈ BMR * 1.375
	out.SuggestKcal = round1(out.BMR * 1.375)
	return out
}

func bmiLevel(bmi float64) string {
	switch {
	case bmi < 18.5:
		return "偏瘦"
	case bmi < 24:
		return "正常"
	case bmi < 28:
		return "超重"
	default:
		return "肥胖"
	}
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}
